// Today screen: recovery banner, session start, quick logs, and the live
// weights-session flow (set entry, timer, next-load suggestion).
//
// User-entered text (exercise names, notes, program names) is only ever
// written through textContent; this module never uses innerHTML.

import { t, getLang } from "../i18n.js";
import { getAll, getSettings, saveSettings, put, newId, getWater, putWater } from "../store.js";
import { scheduleRestPush, cancelRestPush } from "../push.js";
import * as rules from "../rules.js";

export const titleKey = "tab.today";
export const subKey = "screen.today.sub.idle";

// Pain area map keys (v1.1.1 polish item 6). These are data keys stored in
// session.daily.pain, not UI copy; each one resolves to a label through
// pain.area.<slug> in i18n. Older sessions may carry other (legacy) keys,
// e.g. the pre-item-6 Korean literal "무릎"; painAreaLabel renders those
// raw rather than dropping or crashing on them.
const PAIN_AREA_SLUGS = ["knee", "lowback", "shoulder", "elbow", "wrist"];

function painAreaLabel(slug) {
  return PAIN_AREA_SLUGS.includes(slug) ? t(`pain.area.${slug}`) : slug;
}

// Summary text for the daily-check chip: only areas with a value > 0, known
// slugs first in fixed order, then any other (legacy) keys present in the
// map, e.g. "무릎 2 · 허리 1". Empty string when nothing is painful.
function painSummaryText(pain) {
  const map = pain || {};
  const parts = [];
  for (const slug of PAIN_AREA_SLUGS) {
    const v = num(map[slug]);
    if (v > 0) parts.push(`${painAreaLabel(slug)} ${v}`);
  }
  for (const [slug, v] of Object.entries(map)) {
    if (PAIN_AREA_SLUGS.includes(slug)) continue;
    const n = num(v);
    if (n > 0) parts.push(`${painAreaLabel(slug)} ${n}`);
  }
  return parts.join(" · ");
}

const EFFORT_LEVELS = ["hard", "normal", "easy"];
const EFFORT_CHIP = { hard: "bad", normal: "neutral", easy: "good" };

// RPE reuses the same 3-level scale/styling as set-effort chips (B1).
const RPE_LEVELS = ["easy", "normal", "hard"];
const CARDIO_ACTIVITIES = ["running", "cycling", "rowing", "swimming", "hiking", "walking"];

// ---------------------------------------------------------------- helpers

// Local calendar date, not UTC: sessions belong to the day the user sees.
function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dateLabel(d = new Date()) {
  // Follow the app language, not the device locale.
  return d.toLocaleDateString(getLang(), { month: "long", day: "numeric", weekday: "short" });
}

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmtNum(v) {
  return String(Number(num(v).toFixed(2)));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function field(labelText, input) {
  const wrap = el("div", "field");
  const label = el("label", null, labelText);
  wrap.append(label, input);
  return wrap;
}

function numberInput(value, { min, max, step } = {}) {
  const input = document.createElement("input");
  input.type = "number";
  if (min != null) input.min = String(min);
  if (max != null) input.max = String(max);
  if (step != null) input.step = String(step);
  if (value != null) input.value = String(value);
  return input;
}

function textInput(value) {
  const input = document.createElement("input");
  input.type = "text";
  if (value != null) input.value = String(value);
  return input;
}

// Multi-line note input that grows with its content (v1.2): a fixed
// single-line input made long notes unreadable and hard to keep editing.
function textareaInput(value) {
  const input = document.createElement("textarea");
  input.rows = 3;
  if (value != null) input.value = String(value);
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight + 2}px`;
  });
  return input;
}

// Conventions that get an entry hint under the weight stepper.
const LOAD_HINT_CONVENTIONS = ["excludes-bar", "per-hand", "stack"];

function checkboxField(labelText, checked) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!checked;
  const label = el("label", null, null);
  label.style.display = "flex";
  label.style.alignItems = "center";
  label.style.gap = "6px";
  label.append(input, el("span", null, labelText));
  const wrap = el("div", "field");
  wrap.appendChild(label);
  return { wrap, input };
}

function storedUnitOf(exercise) {
  return exercise?.unit === "kg" ? "kg" : "lb";
}

function loadText(exercise, load, settings) {
  if (exercise?.equipment === "bodyweight") return t("common.bodyweight.load");
  return rules.formatLoad(load, storedUnitOf(exercise), settings?.displayUnit || "both");
}

// Split rendering for the compact set-entry stepper: primary text is the
// stored-unit value (matches what +/- actually steps through); the small
// secondary line only appears in "both" mode, showing the converted unit.
function stepperWeightDisplay(exercise, value, settings) {
  const su = storedUnitOf(exercise);
  const displayUnit = settings?.displayUnit || "both";
  if (displayUnit === "kg" || displayUnit === "lb") {
    return { main: rules.formatLoad(value, su, displayUnit), small: null };
  }
  const otherUnit = su === "kg" ? "lb" : "kg";
  return { main: rules.formatLoad(value, su, su), small: rules.formatLoad(value, su, otherUnit) };
}

function repsText(reps) {
  return reps === "max" ? t("common.max.reps") : String(num(reps));
}

function stepsFor(exercise, settings) {
  const ex = exercise || { id: "", equipment: "machine" };
  return rules.inventorySteps(ex, settings.inventory);
}

function byId(list) {
  const map = {};
  for (const item of list) map[item.id] = item;
  return map;
}

function completedWeights(sessions) {
  return sessions
    .filter((s) => s.kind === "weights" && s.endedAt)
    .sort((a, b) => (a.date === b.date ? (a.endedAt || 0) - (b.endedAt || 0) : a.date.localeCompare(b.date)));
}

function findActiveSession(sessions) {
  return sessions
    .filter((s) => s.kind === "weights" && s.startedAt && !s.endedAt)
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))[0] || null;
}

function emptyDaily() {
  return { sleepH: null, condition: null, pain: {}, heat: false, proteinOk: false, note: "" };
}

// Did the previous completed session holding this exercise miss its target reps?
function prevMissedReps(sessions, currentSession, exerciseId) {
  const prior = completedWeights(sessions)
    .filter((s) => s.id !== currentSession.id && (s.entries || []).some((e) => e.exerciseId === exerciseId));
  const last = prior[prior.length - 1];
  if (!last) return false;
  const entry = last.entries.find((e) => e.exerciseId === exerciseId);
  return !rules.repsMet(rules.workingSets(entry.sets), entry.targetReps);
}

function itemFor(program, exerciseId) {
  const found = (program?.items || []).find((i) => i.exerciseId === exerciseId);
  return found || { exerciseId, sets: 3, reps: 8, targetLoad: 0, warmupSets: 0 };
}

function suggestionFor({ session, sessions, entry, item, exercise, settings }) {
  return rules.nextLoad({
    sets: entry.sets,
    targetReps: entry.targetReps,
    currentLoad: item.targetLoad,
    steps: stepsFor(exercise, settings),
    prevMissedReps: prevMissedReps(sessions, session, entry.exerciseId),
  });
}

function suggestionText(session, suggestion, exercise, settings) {
  if (session.recovery) return t("today.suggest.recovery");
  const load = loadText(exercise, suggestion.load, settings);
  if (suggestion.action === "increase") return t("today.suggest.increase", { load });
  if (suggestion.action === "decrease") return t("today.suggest.decrease", { load });
  return t("today.suggest.hold");
}

// ------------------------------------------------------- recovery banner

function recoveryBanner({ settings, gap, week, action }) {
  const card = el("div", "card recovery");
  const titleRow = el("div", "title-row");
  titleRow.append(
    el("strong", null, t("today.recovery.title", { week })),
    el("span", "chip accent", t("today.recovery.badge")),
  );
  card.append(
    titleRow,
    el("p", null, t("today.recovery.desc", {
      days: gap,
      pct: Math.round(settings.recoveryRule.factor * 100),
    })),
  );
  if (action) {
    const btn = el("button", "link", action.label);
    btn.type = "button";
    btn.addEventListener("click", action.onClick);
    card.appendChild(btn);
  }
  return card;
}

function suggestBanner({ gap, onEnter }) {
  const card = el("div", "card recovery");
  const titleRow = el("div", "title-row");
  titleRow.appendChild(el("strong", null, t("today.recovery.suggest.title")));
  card.appendChild(titleRow);
  card.appendChild(el("p", null, t("today.recovery.suggest", { days: gap })));
  const btn = el("button", "link", t("today.recovery.enter"));
  btn.type = "button";
  btn.addEventListener("click", onEnter);
  card.appendChild(btn);
  return card;
}

// ------------------------------------------------------------- idle view

function renderIdle(root, ctx, data) {
  const { settings, programs, sessions, exercises, bodyweightRecords, water } = data;
  ctx.setTimer(null);
  ctx.setSub(t("screen.today.sub.idle", { date: dateLabel() }));

  const today = todayISO();
  const done = completedWeights(sessions);
  const lastCompleted = done[done.length - 1] || null;
  const gap = lastCompleted ? rules.gapDays(lastCompleted.date, today) : 0;

  if (settings.recovery.active) {
    root.appendChild(recoveryBanner({
      settings,
      gap,
      week: settings.recovery.startedAt ? rules.recoveryWeek(settings.recovery.startedAt, today) : 1,
      action: {
        label: t("today.recovery.exit"),
        onClick: async () => {
          settings.recovery = { active: false, startedAt: null };
          await saveSettings(settings);
          await ctx.remount();
        },
      },
    }));
  } else if (lastCompleted
    && rules.shouldSuggestRecovery(lastCompleted.date, today, settings.recoveryRule.gapDays)) {
    root.appendChild(suggestBanner({
      gap,
      onEnter: async () => {
        settings.recovery = { active: true, startedAt: today };
        await saveSettings(settings);
        await ctx.remount();
      },
    }));
  }

  root.appendChild(renderStartCard(ctx, settings, programs, exercises));
  root.appendChild(renderWaterCard(ctx, settings, water));
  root.appendChild(renderCardioCard(ctx));
  root.appendChild(renderBodyweightCard(ctx, settings, bodyweightRecords));
  root.appendChild(renderCalisthenicsCard(ctx, exercises));
}

function renderStartCard(ctx, settings, programs, exercises) {
  const card = el("div", "card");
  card.appendChild(el("h2", null, t("today.start.title")));

  const weightPrograms = programs.filter((p) => p.kind === "weights");
  if (weightPrograms.length === 0) {
    card.appendChild(el("div", "empty", t("today.start.empty")));
    return card;
  }

  const byId = Object.fromEntries((exercises || []).map((e) => [e.id, e]));
  let selected = weightPrograms[0];
  const estimateEl = el("div", null);
  estimateEl.style.color = "var(--ink2)";
  estimateEl.style.fontSize = "13px";
  const showEstimate = () => {
    estimateEl.textContent = t("today.start.estimate", {
      n: rules.estimateSessionMinutes(selected, settings, byId),
    });
  };
  const row = el("div", "filter-row");
  for (const program of weightPrograms) {
    const chip = el("button", "filter", program.name);
    chip.type = "button";
    if (program.id === selected.id) chip.classList.add("sel");
    chip.addEventListener("click", () => {
      selected = program;
      for (const other of row.children) other.classList.remove("sel");
      chip.classList.add("sel");
      showEstimate();
    });
    row.appendChild(chip);
  }
  card.appendChild(row);
  showEstimate();
  estimateEl.style.marginTop = "8px";
  card.appendChild(estimateEl);

  const start = el("button", "btn-primary", t("today.start.button"));
  start.type = "button";
  start.style.marginTop = "10px";
  start.addEventListener("click", async () => {
    start.disabled = true;
    await put("sessions", {
      id: newId("session"),
      date: todayISO(),
      kind: "weights",
      programId: selected.id,
      programName: selected.name,
      recovery: settings.recovery.active,
      startedAt: Date.now(),
      endedAt: null,
      daily: emptyDaily(),
      entries: (selected.items || []).map((item) => ({
        exerciseId: item.exerciseId,
        targetReps: item.reps,
        sets: [],
      })),
      run: null,
    });
    await ctx.remount();
  });
  card.appendChild(start);
  return card;
}

function quickCard(titleText) {
  const card = el("details", "card");
  const summary = el("summary", null, titleText);
  summary.style.cursor = "pointer";
  summary.style.fontWeight = "700";
  card.appendChild(summary);
  const body = el("div", null, null);
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "10px";
  body.style.marginTop = "10px";
  card.appendChild(body);
  return { card, body };
}

// Cardio quick log (B1): activity chips (fixed set + free-text custom),
// required minutes, optional distance/HR, RPE (reuses the effort 3-chip
// scale), free note. Pace is computed live from minutes+distance.
function renderCardioCard(ctx) {
  const { card, body } = quickCard(t("today.cardio.title"));

  let activity = CARDIO_ACTIVITIES[0];
  let rpe = null;

  const chipRow = el("div", "filter-row");
  const chipButtons = new Map();
  const customInput = textInput("");
  customInput.placeholder = t("today.cardio.custom.placeholder");
  const customField = field(t("today.cardio.custom.label"), customInput);
  customField.hidden = true;

  function selectActivity(next) {
    activity = next;
    for (const [key, btn] of chipButtons) btn.classList.toggle("sel", key === next);
    customField.hidden = next !== "custom";
  }

  for (const key of [...CARDIO_ACTIVITIES, "custom"]) {
    const btn = el("button", "filter", t(`today.cardio.activity.${key}`));
    btn.type = "button";
    btn.addEventListener("click", () => selectActivity(key));
    chipButtons.set(key, btn);
    chipRow.appendChild(btn);
  }
  selectActivity(activity);
  body.append(chipRow, customField);

  const minutes = numberInput("", { min: 0, step: 1 });
  const distance = numberInput("", { min: 0, step: 0.1 });
  const hr = numberInput("", { min: 0, step: 1 });
  hr.placeholder = "-";
  const note = textInput("");
  const paceLine = el("div", "hint", "");

  const updatePace = () => {
    const p = rules.paceText(num(minutes.value), num(distance.value));
    paceLine.textContent = p ? t("today.cardio.pace", { pace: p }) : "";
  };
  minutes.addEventListener("input", updatePace);
  distance.addEventListener("input", updatePace);

  body.append(
    field(t("today.cardio.minutes"), minutes),
    field(t("today.cardio.distance"), distance),
    field(t("today.cardio.hr"), hr),
  );

  const rpeRow = el("div", "effort-row");
  for (const level of RPE_LEVELS) {
    const btn = el("button", "effort", t(`rpe.${level}`));
    btn.type = "button";
    btn.dataset.level = level;
    btn.addEventListener("click", () => {
      rpe = rpe === level ? null : level;
      for (const b of rpeRow.children) b.classList.toggle("sel", b.dataset.level === rpe);
    });
    rpeRow.appendChild(btn);
  }
  body.append(rpeRow, field(t("today.cardio.note"), note), paceLine);

  const save = el("button", "btn-primary", t("common.save"));
  save.type = "button";
  save.addEventListener("click", async () => {
    const mins = num(minutes.value);
    if (mins <= 0) return;
    save.disabled = true;
    const now = Date.now();
    const activityValue = activity === "custom" ? (customInput.value.trim() || "custom") : activity;
    await put("sessions", {
      id: newId("session"),
      date: todayISO(),
      kind: "cardio",
      programId: "",
      programName: "",
      recovery: false,
      startedAt: now,
      endedAt: now,
      daily: emptyDaily(),
      entries: [],
      run: null,
      cardio: {
        activity: activityValue,
        minutes: mins,
        distanceKm: num(distance.value) || null,
        avgHr: num(hr.value) || null,
        rpe,
        note: note.value,
      },
    });
    ctx.showToast(t("settings.saved"));
    await ctx.remount();
  });
  body.appendChild(save);
  return card;
}

// Water card (B2): always visible on Today, independent of session state.
// Cup buttons show filled state up to the current amount; tapping an empty
// cup adds one cupMl, tapping a filled cup removes one. More cups than the
// target render once the target is exceeded (overshoot is allowed, not capped).
function renderWaterCard(ctx, settings, water) {
  const card = el("div", "card");
  card.appendChild(el("h2", null, t("today.water.title")));

  let ml = water?.ml || 0;
  const target = settings.waterTargetMl || 2000;
  const cup = settings.cupMl || 250;

  const cupsRow = el("div", "cup-row");
  const countLine = el("div", "cup-count", "");
  card.append(cupsRow, countLine);

  function render() {
    cupsRow.replaceChildren();
    const filled = Math.round(ml / cup);
    const targetCups = Math.ceil(target / cup);
    const cupsToShow = Math.max(targetCups, filled);
    for (let i = 0; i < cupsToShow; i++) {
      const isFilled = i < filled;
      const btn = el("button", `cup ${isFilled ? "filled" : "empty"}`, "");
      btn.type = "button";
      btn.setAttribute("aria-label", t(isFilled ? "today.water.cup.remove" : "today.water.cup.add"));
      btn.addEventListener("click", async () => {
        ml = Math.max(0, ml + (isFilled ? -cup : cup));
        await putWater(todayISO(), ml);
        render();
      });
      cupsRow.appendChild(btn);
    }
    countLine.textContent = t("today.water.count", { ml, target });
  }

  render();
  return card;
}

// Bodyweight quick log (B4/B5): entry happens in settings.bodyweightUnit
// (converted to kg for storage); optional body fat % and muscle mass (also
// entered in the bodyweight unit, stored kg). Shows the protein target (B3)
// computed from the latest bodyweight entry, independent of what's typed here.
function renderBodyweightCard(ctx, settings, bodyweightRecords) {
  const { card, body } = quickCard(t("today.bw.title"));
  const unit = settings.bodyweightUnit === "lb" ? "lb" : "kg";

  const weight = numberInput("", { min: 0, step: 0.1 });
  const fasted = checkboxField(t("today.bw.fasted"), true);
  const fat = numberInput("", { min: 0, step: 0.1 });
  const muscle = numberInput("", { min: 0, step: 0.1 });
  body.append(
    field(t("today.bw.weight", { unit }), weight),
    fasted.wrap,
    field(t("today.bw.fat"), fat),
    field(t("today.bw.muscle", { unit }), muscle),
  );

  const latest = bodyweightRecords.reduce((best, b) => (!best || b.date > best.date ? b : best), null);
  const proteinLine = el("div", "hint", latest
    ? t("today.bw.protein", {
        g: rules.proteinTargetG(latest.kg, settings.proteinCoef),
        coef: rules.proteinCoefDisplay(settings.proteinCoef, unit),
      })
    : t("today.bw.protein.none"));
  body.appendChild(proteinLine);

  const save = el("button", "btn-primary", t("common.save"));
  save.type = "button";
  save.addEventListener("click", async () => {
    save.disabled = true;
    const toKg = (v) => (unit === "lb" ? rules.lbToKg(v, { round: false }) : v);
    const kg = Math.round(toKg(num(weight.value)) * 100) / 100;
    const bodyFatPct = fat.value === "" ? null : num(fat.value);
    const muscleMassKg = muscle.value === "" ? null : Math.round(toKg(num(muscle.value)) * 100) / 100;
    await put("bodyweight", {
      date: todayISO(),
      kg,
      fasted: fasted.input.checked,
      bodyFatPct,
      muscleMassKg,
    });
    ctx.showToast(t("settings.saved"));
    await ctx.remount();
  });
  body.appendChild(save);
  return card;
}

function renderCalisthenicsCard(ctx, exercises) {
  const { card, body } = quickCard(t("today.cal.title"));
  const options = exercises.filter((e) => e.equipment === "bodyweight");

  if (options.length === 0) {
    body.appendChild(el("div", "empty", t("common.none")));
    return card;
  }

  const select = document.createElement("select");
  for (const exercise of options) {
    const option = document.createElement("option");
    option.value = exercise.id;
    option.textContent = exercise.name;
    select.appendChild(option);
  }
  body.appendChild(field(t("today.cal.pick"), select));

  // Recording mode toggle (v1.1.1 polish item 7): 횟수 (reps, default) or
  // 시간(초) (hold seconds). Only the label + which field the value writes to
  // changes; the value input itself is shared.
  let mode = "reps";
  const modeSeg = el("div", "seg");
  const repsBtn = el("button", "sel", t("today.cal.mode.reps"));
  const secBtn = el("button", null, t("today.cal.mode.seconds"));
  repsBtn.type = "button";
  secBtn.type = "button";
  modeSeg.append(repsBtn, secBtn);
  body.appendChild(modeSeg);

  const value = numberInput(10, { min: 0, step: 1 });
  const valueField = field(mode === "seconds" ? t("today.cal.mode.seconds") : t("common.reps"), value);
  body.appendChild(valueField);

  function setMode(next) {
    mode = next;
    repsBtn.classList.toggle("sel", mode === "reps");
    secBtn.classList.toggle("sel", mode === "seconds");
    valueField.firstChild.textContent = mode === "seconds" ? t("today.cal.mode.seconds") : t("common.reps");
  }
  repsBtn.addEventListener("click", () => setMode("reps"));
  secBtn.addEventListener("click", () => setMode("seconds"));

  const sets = [];
  const list = el("div", "set-block");
  body.appendChild(list);

  const save = el("button", "btn-primary", t("common.save"));
  save.type = "button";
  save.disabled = true;

  const redraw = () => {
    list.replaceChildren();
    sets.forEach((set, index) => {
      const line = el("div", "set-line");
      const recordText = set.holdSec > 0
        ? t("today.set.hold", { n: set.holdSec })
        : t("today.set.record", { w: t("common.bodyweight.load"), r: set.reps });
      line.append(
        el("span", "set-no", t("common.set.n", { n: index + 1 })),
        el("span", null, recordText),
      );
      list.appendChild(line);
    });
    save.disabled = sets.length === 0;
  };

  const add = el("button", "btn-secondary", t("common.add"));
  add.type = "button";
  add.addEventListener("click", () => {
    if (mode === "seconds") sets.push({ weight: 0, reps: 0, holdSec: num(value.value), effort: null, warmup: false });
    else sets.push({ weight: 0, reps: num(value.value), effort: null, warmup: false });
    redraw();
  });
  body.appendChild(add);
  body.appendChild(save);

  save.addEventListener("click", async () => {
    save.disabled = true;
    const now = Date.now();
    await put("sessions", {
      id: newId("session"),
      date: todayISO(),
      kind: "calisthenics",
      programId: "",
      programName: "",
      recovery: false,
      startedAt: now,
      endedAt: now,
      daily: emptyDaily(),
      entries: [{ exerciseId: select.value, targetReps: "max", sets }],
      run: null,
    });
    ctx.showToast(t("settings.saved"));
    await ctx.remount();
  });

  redraw();
  return card;
}

// ----------------------------------------------------------- active view

function startTimer(root, ctx, startedAt) {
  let handle = null;
  const tick = () => {
    // The screen root is replaced on every tab switch; stop with it so the
    // interval cannot outlive the DOM it writes to.
    if (!root.isConnected) {
      clearInterval(handle);
      return;
    }
    ctx.setTimer(formatElapsed(Date.now() - startedAt));
  };
  tick();
  handle = setInterval(tick, 1000);
}

function renderDailyCard(ctx, session) {
  const card = el("div", "card");
  card.appendChild(el("h2", null, t("today.daily.title")));

  const daily = session.daily || emptyDaily();
  const chips = el("div", "daily-row");
  chips.append(
    el("span", "chip neutral", t("today.daily.sleep", { h: daily.sleepH == null ? "-" : fmtNum(daily.sleepH) })),
    el("span", "chip neutral", t("today.daily.condition", { v: daily.condition == null ? "-" : fmtNum(daily.condition) })),
  );
  const painSummary = painSummaryText(daily.pain);
  if (painSummary) chips.appendChild(el("span", "chip bad", painSummary));
  if (daily.heat) chips.appendChild(el("span", "chip neutral", t("today.daily.heat")));
  if (daily.proteinOk) chips.appendChild(el("span", "chip neutral", t("today.daily.protein")));
  card.appendChild(chips);

  const form = el("div", null, null);
  form.hidden = true;
  form.style.display = "flex";
  form.style.flexDirection = "column";
  form.style.gap = "10px";
  form.style.marginTop = "10px";

  const sleep = numberInput(daily.sleepH ?? "", { min: 0, max: 24, step: 0.5 });
  const condition = numberInput(daily.condition ?? "", { min: 1, max: 5, step: 1 });
  const painInputs = {};
  for (const slug of PAIN_AREA_SLUGS) {
    const v = num(daily.pain?.[slug]);
    painInputs[slug] = numberInput(v, { min: 0, max: 3, step: 1 });
  }
  const heat = checkboxField(t("today.daily.heat"), daily.heat);
  const protein = checkboxField(t("today.daily.protein"), daily.proteinOk);
  const note = textareaInput(daily.note || "");
  form.append(
    field(t("today.daily.sleep", { h: daily.sleepH == null ? "-" : fmtNum(daily.sleepH) }), sleep),
    field(t("today.daily.condition", { v: daily.condition == null ? "-" : fmtNum(daily.condition) }), condition),
    ...PAIN_AREA_SLUGS.map((slug) => field(
      t("today.daily.pain", { area: painAreaLabel(slug), v: num(daily.pain?.[slug]) }),
      painInputs[slug],
    )),
    heat.wrap,
    protein.wrap,
    field(t("today.daily.note"), note),
  );

  const save = el("button", "btn-secondary", t("common.save"));
  save.type = "button";
  save.addEventListener("click", async () => {
    save.disabled = true;
    const nextPain = { ...(daily.pain || {}) };
    for (const slug of PAIN_AREA_SLUGS) nextPain[slug] = num(painInputs[slug].value);
    session.daily = {
      sleepH: sleep.value === "" ? null : num(sleep.value),
      condition: condition.value === "" ? null : num(condition.value),
      pain: nextPain,
      heat: heat.input.checked,
      proteinOk: protein.input.checked,
      note: note.value,
    };
    await put("sessions", session);
    await ctx.remount();
  });
  form.appendChild(save);

  const toggle = el("button", "link", t("today.daily.edit"));
  toggle.type = "button";
  toggle.addEventListener("click", () => { form.hidden = !form.hidden; });
  card.append(toggle, form);
  return card;
}

function stepper(valueText, unitText, { disabled, onDown, onUp }) {
  const wrap = el("div", "stepper");
  const minus = el("button", null, "−");
  minus.type = "button";
  const plus = el("button", null, "+");
  plus.type = "button";
  minus.disabled = !!disabled;
  plus.disabled = !!disabled;
  minus.addEventListener("click", onDown);
  plus.addEventListener("click", onUp);
  const val = el("div", "val", valueText);
  if (unitText) val.appendChild(el("small", null, unitText));
  wrap.append(minus, val, plus);
  return wrap;
}

function setLine(exercise, set, label, settings) {
  const line = el("div", "set-line");
  const weight = loadText(exercise, set.weight, settings);
  line.append(
    el("span", "set-no", label),
    el("span", null, t("today.set.record", { w: weight, r: num(set.reps) })),
  );
  if (set.effort) {
    line.appendChild(el("span", `chip ${EFFORT_CHIP[set.effort]}`, t(`effort.${set.effort}`)));
  }
  return line;
}

// A not-yet-done pyramid rung, previewed dim/italic (C1): shows the planned
// load x reps so the user can see the ladder before starting it.
function plannedSetLine(exercise, planSet, label, settings) {
  const line = el("div", "set-line planned");
  const weight = loadText(exercise, planSet.load, settings);
  line.append(
    el("span", "set-no", label),
    el("span", null, t("today.set.record", { w: weight, r: num(planSet.reps) })),
  );
  return line;
}

// Method badge chip (C1): only pyramid/superset/dropset get a visible chip;
// plain items (method null, or a dangling superset half treated as normal)
// render no chip at all.
function methodBadge(method) {
  if (method !== "pyramid" && method !== "superset" && method !== "dropset") return null;
  return el("span", "chip method", t(`method.${method}`));
}

function renderActive(root, ctx, data, session) {
  const { settings, programs, sessions, exercisesById, water } = data;
  const program = programs.find((p) => p.id === session.programId) || null;

  ctx.setSub(t("screen.today.sub", { date: dateLabel(), session: session.programName }));
  startTimer(root, ctx, session.startedAt);

  if (session.recovery) {
    const done = completedWeights(sessions).filter((s) => s.id !== session.id);
    const last = done[done.length - 1] || null;
    root.appendChild(recoveryBanner({
      settings,
      gap: last ? rules.gapDays(last.date, session.date) : 0,
      week: settings.recovery.startedAt ? rules.recoveryWeek(settings.recovery.startedAt, session.date) : 1,
      action: null,
    }));
  }

  root.appendChild(renderDailyCard(ctx, session));
  // Water card is outside the session flow proper: it stays visible
  // regardless of whether a weights session is active (B2).
  root.appendChild(renderWaterCard(ctx, settings, water));

  const card = el("div", "card");
  root.appendChild(card);

  // Draft of the set currently being entered. Kept across in-place re-renders
  // of the card, reset whenever the active exercise (or superset side, or
  // pyramid rung) changes. dropDismissed/seenWorking are C1 additions.
  const draft = { entryIndex: -1, weight: 0, reps: 0, effort: null, dropDismissed: false, seenWorking: 0, phase: "none" };
  // Manual exercise selection (v1.2): tapping an incomplete exercise row
  // makes it the active one (e.g. when the machine for the next-in-order
  // exercise is taken). Cleared once that entry completes, falling back to
  // first-incomplete order.
  let manualIndex = null;

  const entryState = (entry, item) => {
    const working = rules.workingSets(entry.sets).length;
    const warm = entry.sets.length - working;
    return { working, warm, complete: working >= item.sets };
  };

  // Resolves the effective program item for an entry BY INDEX, tolerating a
  // dangling superset half (C1): if the item claims method "superset" but its
  // neighbor doesn't share its supersetGroup, it renders as a normal item
  // (no badge, no bundling) rather than as a broken half-pair.
  function resolveItem(index) {
    const entry = session.entries[index];
    const raw = itemFor(program, entry.exerciseId);
    if (raw.method !== "superset" || !raw.supersetGroup) return raw;
    const prevEntry = session.entries[index - 1];
    const nextEntry = session.entries[index + 1];
    const prevItem = prevEntry ? itemFor(program, prevEntry.exerciseId) : null;
    const nextItem = nextEntry ? itemFor(program, nextEntry.exerciseId) : null;
    const pairedNext = nextItem && nextItem.method === "superset" && nextItem.supersetGroup === raw.supersetGroup;
    const pairedPrev = prevItem && prevItem.method === "superset" && prevItem.supersetGroup === raw.supersetGroup;
    return (pairedNext || pairedPrev) ? raw : { ...raw, method: null };
  }

  // ---- dropset helpers (C1) ------------------------------------------
  function lastMainSet(entry) {
    for (let i = entry.sets.length - 1; i >= 0; i--) {
      const s = entry.sets[i];
      if (!s.warmup && !s.drop) return s;
    }
    return null;
  }
  function dropsDone(entry) {
    return entry.sets.filter((s) => s.drop).length;
  }
  function dropChainFor(entry, item, exercise) {
    if (item.method !== "dropset") return [];
    const mainCount = entry.sets.filter((s) => !s.warmup && !s.drop).length;
    if (mainCount < item.sets) return [];
    const last = lastMainSet(entry);
    if (!last) return [];
    return rules.dropChain(last.weight, stepsFor(exercise, settings), 2);
  }
  function dropPending(entry, item, exercise) {
    const chain = dropChainFor(entry, item, exercise);
    return chain.length > 0 && dropsDone(entry) < chain.length;
  }

  // ---- superset helpers (C1) ------------------------------------------
  // Whose turn is it: a1,b1,a2,b2... Ties (equal counts, neither done) go to
  // "a" first, matching the alternation the mockup shows. null = both sides
  // have reached their own target set count (the bundle is finished).
  function supersetTurn(entryA, itemA, entryB, itemB) {
    const doneA = rules.workingSets(entryA.sets).length;
    const doneB = rules.workingSets(entryB.sets).length;
    const completeA = doneA >= itemA.sets;
    const completeB = doneB >= itemB.sets;
    if (completeA && completeB) return null;
    if (completeA) return "b";
    if (completeB) return "a";
    return doneA <= doneB ? "a" : "b";
  }

  // The first entry index that still needs work: normal "not complete" for
  // plain items, whose-turn-is-it for a superset pair, and "drop chain still
  // offering / not yet dismissed" for a dropset item after its last working
  // set. -1 when the whole session is done.
  function computeInteractiveIndex() {
    let i = 0;
    while (i < session.entries.length) {
      const entry = session.entries[i];
      const item = resolveItem(i);
      const nextItem = i + 1 < session.entries.length ? resolveItem(i + 1) : null;
      const paired = item.method === "superset" && nextItem && nextItem.method === "superset"
        && item.supersetGroup && item.supersetGroup === nextItem.supersetGroup;
      if (paired) {
        const nextEntry = session.entries[i + 1];
        const turn = supersetTurn(entry, item, nextEntry, nextItem);
        if (turn === "a") return i;
        if (turn === "b") return i + 1;
        i += 2;
        continue;
      }
      const exercise = exercisesById[entry.exerciseId] || null;
      if (!entryState(entry, item).complete) return i;
      if (item.method === "dropset" && dropPending(entry, item, exercise)
          && !(draft.entryIndex === i && draft.dropDismissed)) return i;
      i += 1;
    }
    return -1;
  }

  // Manual pick wins while its entry is incomplete; superset members route
  // through the pair's turn logic so the alternation stays intact.
  function computeActiveIndex() {
    if (manualIndex != null) {
      const entry = session.entries[manualIndex];
      const item = entry ? resolveItem(manualIndex) : null;
      if (!entry || entryState(entry, item).complete) {
        manualIndex = null;
      } else {
        for (const partnerIdx of [manualIndex - 1, manualIndex + 1]) {
          const partner = session.entries[partnerIdx];
          if (!partner) continue;
          const partnerItem = resolveItem(partnerIdx);
          const paired = item.method === "superset" && partnerItem.method === "superset"
            && item.supersetGroup && item.supersetGroup === partnerItem.supersetGroup;
          if (!paired) continue;
          const aIdx = Math.min(manualIndex, partnerIdx);
          const bIdx = Math.max(manualIndex, partnerIdx);
          const turn = supersetTurn(session.entries[aIdx], resolveItem(aIdx), session.entries[bIdx], resolveItem(bIdx));
          if (turn === "a") return aIdx;
          if (turn === "b") return bIdx;
          manualIndex = null;
          break;
        }
        if (manualIndex != null) return manualIndex;
      }
    }
    return computeInteractiveIndex();
  }

  // Default stepper weight/reps for an entry about to become active:
  // dropset (post-last-set) reuses the last main set's reps as a starting
  // point (its weight display is auto-filled from the chain, not this);
  // pyramid reads the planned rung for the next not-yet-done set; everything
  // else keeps the existing target-load / recovery-load behavior.
  function defaultDraftFor(entry, item, exercise) {
    if (!entry || !item) return { weight: 0, reps: 0 };
    const steps = stepsFor(exercise, settings);
    // Warm-up set about to open (v1.1.1 polish item 5): default the stepper
    // to 50% of the item's target load, snapped to this exercise's inventory
    // steps, regardless of method (a warm-up always precedes any working set
    // in every method). Working sets keep the behavior below unchanged.
    const state = entryState(entry, item);
    const warmupTarget = num(item.warmupSets);
    if (state.warm < warmupTarget && state.working === 0) {
      const plan = rules.warmupPlanLoads(item.targetLoad, warmupTarget, steps, settings.warmupStyle);
      return {
        weight: plan[Math.min(state.warm, plan.length - 1)] ?? 0,
        reps: entry.targetReps === "max" ? 0 : num(entry.targetReps),
      };
    }
    const mainWorking = rules.workingSets(entry.sets).filter((s) => !s.drop).length;
    const complete = mainWorking >= item.sets;
    if (item.method === "dropset" && complete) {
      const last = lastMainSet(entry);
      return {
        weight: last ? last.weight : item.targetLoad,
        reps: last ? last.reps : (entry.targetReps === "max" ? 0 : num(entry.targetReps)),
      };
    }
    if (item.method === "pyramid") {
      const plan = rules.pyramidPlan(item.targetLoad, entry.targetReps, item.sets, steps);
      if (plan) {
        const idx = Math.min(mainWorking, plan.length - 1);
        return { weight: plan[idx].load, reps: plan[idx].reps };
      }
    }
    const weight = session.recovery
      ? rules.recoveryLoad(item.targetLoad, settings.recoveryRule.factor, steps)
      : item.targetLoad;
    const reps = entry.targetReps === "max" ? 0 : num(entry.targetReps);
    return { weight, reps };
  }

  // Rest-bar label for the set that will be done next, right after the one
  // just saved: same exercise's next set number, or the next exercise's
  // first set once this one is complete.
  function nextSetLabel(entry, item, exercise) {
    const state = entryState(entry, item);
    if (!state.complete) {
      return t("rest.next", { name: exercise ? exercise.name : t("common.exercise.deleted"), n: state.working + 1 });
    }
    // Wrap-around scan (v1.2): with out-of-order picks, the next incomplete
    // exercise can sit BEFORE the one just finished.
    const idx = session.entries.indexOf(entry);
    for (let k = 1; k <= session.entries.length; k++) {
      const i = (idx + k) % session.entries.length;
      const nextEntry = session.entries[i];
      const nextItem = itemFor(program, nextEntry.exerciseId);
      const nextState = entryState(nextEntry, nextItem);
      if (!nextState.complete) {
        const nextEx = exercisesById[nextEntry.exerciseId] || null;
        return t("rest.next", { name: nextEx ? nextEx.name : t("common.exercise.deleted"), n: nextState.working + 1 });
      }
    }
    return t("today.session.allDone");
  }

  // Label after a superset round: the just-saved side is B, so "next" is
  // usually A's next set (a2, a3, ...); falls through to the normal scan
  // once the whole bundle is finished.
  function nextSetLabelSuperset(bEntry, bItem, bExercise, aIdx) {
    const aEntry = session.entries[aIdx];
    const aItem = resolveItem(aIdx);
    const turn = supersetTurn(aEntry, aItem, bEntry, bItem);
    if (turn === "a") {
      const aExercise = exercisesById[aEntry.exerciseId] || null;
      return t("rest.next", { name: aExercise ? aExercise.name : t("common.exercise.deleted"), n: rules.workingSets(aEntry.sets).length + 1 });
    }
    if (turn === "b") {
      return t("rest.next", { name: bExercise ? bExercise.name : t("common.exercise.deleted"), n: rules.workingSets(bEntry.sets).length + 1 });
    }
    return nextSetLabel(bEntry, bItem, bExercise);
  }

  function nameCell(exercise, entry) {
    const name = el("div", "name");
    name.appendChild(el("span", null, exercise ? exercise.name : t("common.exercise.deleted")));
    if (exercise?.variant) name.appendChild(el("span", "variant", ` ${exercise.variant}`));
    if (exercise?.emphasis) name.appendChild(el("span", "emphasis", ` · ${exercise.emphasis}`));
    return name;
  }

  function exRow(index, item, entry, exercise, activeIndex) {
    const state = entryState(entry, item);
    const row = el("div", "ex-row");
    if (state.complete) row.classList.add("done");
    if (index === activeIndex) row.classList.add("active");
    row.appendChild(el("div", "num", String(index + 1)));
    row.appendChild(nameCell(exercise, entry));
    const badge = methodBadge(item.method);
    if (badge) row.appendChild(badge);
    // Meta: warm-up count spelled out (so "3x8" is unambiguously working
    // sets only), and during recovery the applied load shown next to the
    // program target ("75 lb -> 60 lb") to match what the stepper opens at.
    const warmups = num(item.warmupSets);
    const setsText = warmups > 0
      ? `${t("today.meta.warmup", { n: warmups })} + ${item.sets}×${repsText(entry.targetReps)}`
      : `${item.sets}×${repsText(entry.targetReps)}`;
    let load = loadText(exercise, item.targetLoad, settings);
    if (session.recovery && exercise?.equipment !== "bodyweight" && item.targetLoad > 0) {
      const adjusted = rules.recoveryLoad(item.targetLoad, settings.recoveryRule.factor, stepsFor(exercise, settings));
      if (adjusted !== item.targetLoad) load = `${load} → ${loadText(exercise, adjusted, settings)}`;
    }
    row.appendChild(el("div", "meta", `${setsText} · ${load}`));
    // Tap-to-select (v1.2): any incomplete, non-active exercise can be made
    // active out of order.
    if (!state.complete && index !== activeIndex) {
      row.classList.add("pickable");
      row.addEventListener("click", () => {
        manualIndex = index;
        renderCard();
      });
    }
    return row;
  }

  function renderSingleRow(list, index, activeIndex) {
    const entry = session.entries[index];
    const item = resolveItem(index);
    const exercise = exercisesById[entry.exerciseId] || null;
    const state = entryState(entry, item);

    list.appendChild(exRow(index, item, entry, exercise, activeIndex));

    if (index === activeIndex) {
      list.appendChild(renderSetBlock(entry, item, exercise));
    } else if (state.complete) {
      const suggestion = suggestionFor({ session, sessions, entry, item, exercise, settings });
      list.appendChild(el("div", "hint", suggestionText(session, suggestion, exercise, settings)));
    }
  }

  function renderSupersetGroup(list, aIdx, bIdx, activeIndex) {
    const group = el("div", "superset-group");
    for (const index of [aIdx, bIdx]) {
      const entry = session.entries[index];
      const item = resolveItem(index);
      const exercise = exercisesById[entry.exerciseId] || null;
      group.appendChild(exRow(index, item, entry, exercise, activeIndex));
    }
    list.appendChild(group);

    if (activeIndex === aIdx || activeIndex === bIdx) {
      const entry = session.entries[activeIndex];
      const item = resolveItem(activeIndex);
      const exercise = exercisesById[entry.exerciseId] || null;
      const side = activeIndex === aIdx ? "a" : "b";
      group.appendChild(renderSetBlock(entry, item, exercise, {
        supersetSide: side,
        partnerIndex: side === "a" ? bIdx : aIdx,
      }));
    } else {
      for (const index of [aIdx, bIdx]) {
        const entry = session.entries[index];
        const item = resolveItem(index);
        const state = entryState(entry, item);
        if (!state.complete) continue;
        const exercise = exercisesById[entry.exerciseId] || null;
        const suggestion = suggestionFor({ session, sessions, entry, item, exercise, settings });
        group.appendChild(el("div", "hint", suggestionText(session, suggestion, exercise, settings)));
      }
    }
  }

  function renderDropStrip(entry, item, exercise) {
    const strip = el("div", "drop-strip");
    const chain = dropChainFor(entry, item, exercise);
    const done = dropsDone(entry);
    const nextDropLoad = chain[done];
    strip.appendChild(el("div", "hint", t("today.drop.title")));

    const row = el("div", "stepper-row");
    const weightDisplay = loadText(exercise, nextDropLoad, settings);
    row.appendChild(el("div", "drop-load", weightDisplay));
    row.appendChild(stepper(String(draft.reps), t("common.reps"), {
      disabled: false,
      onDown: () => { draft.reps = Math.max(0, draft.reps - 1); renderCard(); },
      onUp: () => { draft.reps += 1; renderCard(); },
    }));
    strip.appendChild(row);

    const actions = el("div", "btn-row");
    const save = el("button", "btn-primary", t("today.drop.save", { load: weightDisplay }));
    save.type = "button";
    save.addEventListener("click", async () => {
      save.disabled = true;
      unlockRestAudio();
      entry.sets.push({ weight: nextDropLoad, reps: num(draft.reps), effort: null, warmup: false, drop: true });
      await put("sessions", session);
      if (dropsDone(entry) >= chain.length) {
        // The exercise is fully done at this point: between-exercise rest.
        startRest(settings.restBetweenSec ?? 150, nextSetLabel(entry, item, exercise));
      }
      renderCard();
    });
    const skip = el("button", "btn-secondary", t("today.drop.skip"));
    skip.type = "button";
    skip.addEventListener("click", () => {
      draft.dropDismissed = true;
      startRest(settings.restBetweenSec ?? 150, nextSetLabel(entry, item, exercise));
      renderCard();
    });
    actions.append(save, skip);
    strip.appendChild(actions);
    return strip;
  }

  function renderCard() {
    card.replaceChildren();

    const planned = session.entries.reduce((sum, e) => sum + itemFor(program, e.exerciseId).sets, 0);
    card.appendChild(el("h2", null, t("today.session.title", { name: session.programName, sets: planned })));

    const list = el("div", "ex-list");
    card.appendChild(list);

    const activeIndex = computeActiveIndex();
    // The entry's warm/working phase, used to re-derive the stepper default
    // exactly when it changes: each warm-up set (ramp style needs the next
    // rung) and the warm -> working transition (the working default is the
    // target/recovery load, not the last warm-up load).
    const phaseOf = (entry, item) => {
      if (!entry || !item) return "none";
      const s = entryState(entry, item);
      return s.warm < num(item.warmupSets) && s.working === 0 ? `warm${s.warm}` : "work";
    };
    if (draft.entryIndex !== activeIndex) {
      draft.entryIndex = activeIndex;
      draft.effort = null;
      draft.dropDismissed = false;
      const entry = activeIndex >= 0 ? session.entries[activeIndex] : null;
      const item = activeIndex >= 0 ? resolveItem(activeIndex) : null;
      const exercise = entry ? exercisesById[entry.exerciseId] : null;
      const d = defaultDraftFor(entry, item, exercise);
      draft.weight = d.weight;
      draft.reps = d.reps;
      draft.seenWorking = entry ? rules.workingSets(entry.sets).filter((s) => !s.drop).length : 0;
      draft.phase = phaseOf(entry, item);
    } else if (draft.entryIndex >= 0) {
      const entry = session.entries[draft.entryIndex];
      const item = resolveItem(draft.entryIndex);
      const exercise = exercisesById[entry.exerciseId] || null;
      const seenNow = rules.workingSets(entry.sets).filter((s) => !s.drop).length;
      const phaseNow = phaseOf(entry, item);
      if ((item.method === "pyramid" && seenNow !== draft.seenWorking) || phaseNow !== draft.phase) {
        draft.seenWorking = seenNow;
        draft.phase = phaseNow;
        const d = defaultDraftFor(entry, item, exercise);
        draft.weight = d.weight;
        draft.reps = d.reps;
      }
    }

    let idx = 0;
    while (idx < session.entries.length) {
      const item = resolveItem(idx);
      const nextItem = idx + 1 < session.entries.length ? resolveItem(idx + 1) : null;
      const paired = item.method === "superset" && nextItem && nextItem.method === "superset"
        && item.supersetGroup && item.supersetGroup === nextItem.supersetGroup;
      if (paired) {
        renderSupersetGroup(list, idx, idx + 1, activeIndex);
        idx += 2;
        continue;
      }
      renderSingleRow(list, idx, activeIndex);
      idx += 1;
    }

    if (activeIndex < 0) {
      card.appendChild(el("div", "empty", t("today.session.allDone")));
    }
  }

  function renderSetBlock(entry, item, exercise, opts = {}) {
    const block = el("div", "set-block");
    const state = entryState(entry, item);
    const warmupTarget = num(item.warmupSets);
    const isWarmup = state.warm < warmupTarget && state.working === 0;
    const steps = stepsFor(exercise, settings);

    const plan = item.method === "pyramid"
      ? rules.pyramidPlan(item.targetLoad, entry.targetReps, item.sets, steps)
      : null;

    let workingSeen = 0;
    for (const set of entry.sets) {
      let label;
      if (set.warmup) label = t("common.warmup");
      else if (set.drop) label = t("common.drop");
      else label = t("common.set.n", { n: ++workingSeen });
      block.appendChild(setLine(exercise, set, label, settings));
    }

    if (plan) {
      for (let i = workingSeen; i < plan.length; i++) {
        block.appendChild(plannedSetLine(exercise, plan[i], t("common.set.n", { n: i + 1 }), settings));
      }
    }

    if (item.method === "dropset" && dropPending(entry, item, exercise)) {
      block.appendChild(renderDropStrip(entry, item, exercise));
      return block;
    }

    const entryBox = el("div", "set-entry");
    entryBox.appendChild(el(
      "div",
      "hint",
      isWarmup ? t("common.warmup") : t("common.set.n", { n: state.working + 1 }),
    ));

    const bodyweight = exercise?.equipment === "bodyweight";
    const weightDisplay = bodyweight
      ? { main: t("common.bodyweight.load"), small: null }
      : stepperWeightDisplay(exercise, draft.weight, settings);
    const stepperRow = el("div", "stepper-row");
    stepperRow.append(
      stepper(
        weightDisplay.main,
        weightDisplay.small,
        {
          disabled: bodyweight,
          onDown: () => {
            const next = rules.stepDown(draft.weight, steps);
            if (next != null) { draft.weight = next; renderCard(); }
          },
          onUp: () => {
            const next = rules.stepUp(draft.weight, steps);
            if (next != null) { draft.weight = next; renderCard(); }
          },
        },
      ),
      stepper(String(draft.reps), t("common.reps"), {
        disabled: false,
        onDown: () => { draft.reps = Math.max(0, draft.reps - 1); renderCard(); },
        onUp: () => { draft.reps += 1; renderCard(); },
      }),
    );
    entryBox.appendChild(stepperRow);

    // Load-convention reminder (v1.2): what the entered number means for
    // this equipment (bar excluded / per hand / stack pin).
    const conv = exercise?.loadConvention;
    if (!bodyweight && LOAD_HINT_CONVENTIONS.includes(conv)) {
      entryBox.appendChild(el("div", "hint", t(`loadhint.${conv}`)));
    }

    const effortRow = el("div", "effort-row");
    for (const level of EFFORT_LEVELS) {
      const button = el("button", "effort", t(`effort.${level}`));
      button.type = "button";
      button.dataset.level = level;
      if (draft.effort === level) button.classList.add("sel");
      button.addEventListener("click", () => {
        draft.effort = draft.effort === level ? null : level;
        renderCard();
      });
      effortRow.appendChild(button);
    }
    entryBox.appendChild(effortRow);

    const doneBtn = el("button", "btn-primary", t("today.set.done"));
    doneBtn.type = "button";
    doneBtn.disabled = !(isWarmup || draft.effort);
    doneBtn.addEventListener("click", async () => {
      doneBtn.disabled = true;
      // AudioContext must be created/resumed synchronously inside this user
      // gesture (before any await) or iOS will refuse to let it play later.
      unlockRestAudio();
      entry.sets.push({
        weight: bodyweight ? 0 : num(draft.weight),
        reps: num(draft.reps),
        effort: draft.effort,
        warmup: isWarmup,
      });
      draft.effort = null;
      await put("sessions", session);

      const nowComplete = entryState(entry, item).complete;
      const willOfferDrop = item.method === "dropset" && nowComplete && dropPending(entry, item, exercise);
      const deferForSuperset = opts.supersetSide === "a";
      if (!willOfferDrop && !deferForSuperset) {
        const label = opts.supersetSide === "b"
          ? nextSetLabelSuperset(entry, item, exercise, opts.partnerIndex)
          : nextSetLabel(entry, item, exercise);
        // Between-exercise rest (v1.2) replaces the set rest once the whole
        // exercise (both superset sides, when paired) is done.
        let restSec = rules.restSecondsFor(entry.exerciseId, settings, exercise);
        if (nowComplete) {
          const partnerDone = opts.supersetSide == null
            || entryState(session.entries[opts.partnerIndex], resolveItem(opts.partnerIndex)).complete;
          if (partnerDone) restSec = settings.restBetweenSec ?? 150;
        }
        startRest(restSec, label);
      }
      renderCard();
    });
    entryBox.appendChild(doneBtn);

    block.appendChild(entryBox);
    return block;
  }

  renderCard();

  const finish = el("button", "btn-secondary", t("today.session.finish"));
  finish.type = "button";
  finish.addEventListener("click", async () => {
    finish.disabled = true;
    session.endedAt = Date.now();

    let programChanged = false;
    for (const entry of session.entries) {
      const item = itemFor(program, entry.exerciseId);
      if (rules.workingSets(entry.sets).length < item.sets) continue;
      const exercise = exercisesById[entry.exerciseId] || null;
      const suggestion = suggestionFor({ session, sessions, entry, item, exercise, settings });
      if (session.recovery || suggestion.action === "hold") continue;
      const target = (program?.items || []).find((i) => i.exerciseId === entry.exerciseId);
      if (target) {
        target.targetLoad = suggestion.load;
        programChanged = true;
      }
    }
    if (programChanged) await put("programs", program);
    await put("sessions", session);

    clearRest();
    ctx.setTimer(null);
    ctx.showToast(t("today.session.finished"));
    await ctx.remount();
  });
  root.appendChild(finish);
}

// --------------------------------------------------------- rest bar (A1/A2)
//
// Global and screen-independent: the container lives in index.html outside
// #screen-root (which navigate() wipes on every tab switch), and the state
// below is module-level so the countdown, ring, and alert keep running no
// matter which tab is on screen. Timestamp-based (endsAt, not a tick count)
// so it survives a screen-off/reload; localStorage is the resume source.

const REST_STORAGE_KEY = "tt-rest";
const REST_RING_R = 20;
const REST_RING_CIRCUMFERENCE = 2 * Math.PI * REST_RING_R;

let restState = { endsAt: null, totalMs: null, label: "" };
let restTickHandle = null;
let restAlertFired = false;
let restAudioCtx = null;

function loadRestState() {
  try {
    const raw = localStorage.getItem(REST_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.endsAt === "number") {
      restState = { endsAt: parsed.endsAt, totalMs: parsed.totalMs || null, label: parsed.label || "" };
      restAlertFired = parsed.endsAt <= Date.now();
    }
  } catch { /* corrupt or unavailable storage: start with no rest running */ }
}

function persistRestState() {
  try {
    if (restState.endsAt == null) localStorage.removeItem(REST_STORAGE_KEY);
    else localStorage.setItem(REST_STORAGE_KEY, JSON.stringify(restState));
  } catch { /* storage unavailable (private mode etc.): timer still runs in-memory */ }
}

function startRest(seconds, label) {
  const ms = Math.max(0, num(seconds)) * 1000;
  restState = { endsAt: Date.now() + ms, totalMs: ms, label };
  restAlertFired = false;
  persistRestState();
  // Fire-and-forget (v1.4): asks the server to push "rest over" at endsAt so
  // the alert reaches a locked phone. Inert unless the user enabled it; a
  // failure never touches the local countdown below.
  scheduleRestPush(restState.endsAt, t("push.notif.title"), label);
  renderRestBar();
}

function clearRest() {
  restState = { endsAt: null, totalMs: null, label: "" };
  persistRestState();
  // Logging the next set early, skipping rest, or finishing the session all
  // land here: the pending push is no longer wanted. A countdown that simply
  // reaches zero does NOT come through here, so that alarm still fires.
  cancelRestPush();
  renderRestBar();
}

// Must be called synchronously from within a user-gesture click handler
// (before any await) so iOS unlocks playback; the context is then reused
// silently later when the countdown actually reaches zero.
function unlockRestAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!restAudioCtx) restAudioCtx = new AC();
    if (restAudioCtx.state === "suspended") restAudioCtx.resume().catch(() => { /* stays suspended; beep() no-ops */ });
  } catch { /* no Web Audio support: vibration + visual only */ }
}

function beep() {
  try {
    const ctx = restAudioCtx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* blocked/unsupported: vibration + visual alert still fired */ }
}

function fireRestAlert() {
  try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch { /* not supported */ }
  beep();
}

function restBarRefs() {
  const bar = document.getElementById("rest-bar");
  if (!bar) return null;
  if (bar.dataset.built === "1") {
    // Refresh the static button labels on every lookup: the bar is built
    // once at module load, which runs BEFORE boot() applies the stored
    // language, so labels built then would stay in the fallback language.
    const actions = bar.querySelectorAll(".restbar-actions button");
    if (actions[0]) actions[0].textContent = t("rest.add30");
    if (actions[1]) actions[1].textContent = t("rest.skip");
    bar.setAttribute("aria-label", t("rest.title"));
    return {
      bar,
      progress: bar.querySelector(".progress"),
      time: bar.querySelector(".restbar-time"),
      label: bar.querySelector(".restbar-label"),
    };
  }
  bar.dataset.built = "1";
  bar.textContent = "";
  bar.setAttribute("role", "timer");
  bar.setAttribute("aria-label", t("rest.title"));

  const svgNS = "http://www.w3.org/2000/svg";
  const ring = document.createElementNS(svgNS, "svg");
  ring.setAttribute("class", "restbar-ring");
  ring.setAttribute("viewBox", "0 0 46 46");
  ring.setAttribute("width", "46");
  ring.setAttribute("height", "46");
  const track = document.createElementNS(svgNS, "circle");
  track.setAttribute("class", "track");
  track.setAttribute("cx", "23");
  track.setAttribute("cy", "23");
  track.setAttribute("r", String(REST_RING_R));
  const progress = document.createElementNS(svgNS, "circle");
  progress.setAttribute("class", "progress");
  progress.setAttribute("cx", "23");
  progress.setAttribute("cy", "23");
  progress.setAttribute("r", String(REST_RING_R));
  progress.style.strokeDasharray = String(REST_RING_CIRCUMFERENCE);
  ring.append(track, progress);

  const info = el("div", "restbar-info");
  const time = el("div", "restbar-time", "");
  const label = el("div", "restbar-label", "");
  info.append(time, label);

  const actions = el("div", "restbar-actions");
  const add30 = el("button", "chip ghost", t("rest.add30"));
  add30.type = "button";
  add30.addEventListener("click", () => {
    if (restState.endsAt == null) return;
    restState.endsAt += 30000;
    restState.totalMs = (restState.totalMs || 0) + 30000;
    restAlertFired = false;
    persistRestState();
    // Rest moved: the server keeps one pending notification per device, so
    // rescheduling with the new endsAt replaces the earlier one.
    scheduleRestPush(restState.endsAt, t("push.notif.title"), restState.label);
    tickRestBar();
  });
  const skip = el("button", "chip ghost", t("rest.skip"));
  skip.type = "button";
  skip.addEventListener("click", () => clearRest());
  actions.append(add30, skip);

  bar.append(ring, info, actions);
  return { bar, progress, time, label };
}

function stopRestTicking() {
  if (restTickHandle) { clearInterval(restTickHandle); restTickHandle = null; }
}

function tickRestBar() {
  const refs = restBarRefs();
  if (!refs || restState.endsAt == null) return;
  const remainingMs = restState.endsAt - Date.now();
  const total = Math.max(restState.totalMs || 1, 1);
  const frac = Math.max(0, Math.min(1, remainingMs / total));
  refs.progress.style.strokeDashoffset = String(REST_RING_CIRCUMFERENCE * (1 - frac));
  refs.label.textContent = restState.label || "";

  if (remainingMs <= 0) {
    refs.time.textContent = "0:00";
    if (!restAlertFired) {
      restAlertFired = true;
      fireRestAlert();
    }
    return;
  }
  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  refs.time.textContent = `${mm}:${String(ss).padStart(2, "0")}`;
}

function renderRestBar() {
  const refs = restBarRefs();
  if (!refs) return;
  if (restState.endsAt == null) {
    refs.bar.hidden = true;
    // Give the screen's bottom padding back so the last card's buttons
    // (e.g. session-finish) are reachable again.
    document.documentElement.style.setProperty("--restbar-extra", "0px");
    stopRestTicking();
    return;
  }
  if (refs.bar.hidden) {
    const tabbar = document.getElementById("tabbar");
    refs.bar.style.bottom = tabbar ? `${tabbar.getBoundingClientRect().height}px` : "0px";
  }
  refs.bar.hidden = false;
  // Reserve the bar's own height in the scrollable screen's bottom padding
  // so it never overlaps/blocks content or buttons sitting above the tab bar.
  document.documentElement.style.setProperty("--restbar-extra", `${refs.bar.getBoundingClientRect().height}px`);
  tickRestBar();
  if (!restTickHandle) restTickHandle = setInterval(tickRestBar, 250);
}

// Runs once, at module load (app boot), independent of which screen mounts.
loadRestState();
renderRestBar();

// ------------------------------------------------------------------ mount

export async function mount(root, ctx) {
  const [settings, programs, sessions, exercises, bodyweightRecords, water] = await Promise.all([
    getSettings(),
    getAll("programs"),
    getAll("sessions"),
    getAll("exercises"),
    getAll("bodyweight"),
    getWater(todayISO()),
  ]);
  const data = {
    settings,
    programs: programs.filter((p) => p.kind === "weights"),
    sessions,
    exercises,
    exercisesById: byId(exercises),
    bodyweightRecords,
    water,
  };

  const active = findActiveSession(sessions);
  if (active) renderActive(root, ctx, data, active);
  else renderIdle(root, ctx, data);
}
