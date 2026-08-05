// Today screen: recovery banner, session start, quick logs, and the live
// weights-session flow (set entry, timer, next-load suggestion).
//
// User-entered text (exercise names, notes, program names) is only ever
// written through textContent; this module never uses innerHTML.

import { t, getLang } from "../i18n.js";
import { getAll, getSettings, saveSettings, put, newId } from "../store.js";
import * as rules from "../rules.js";

export const titleKey = "tab.today";
export const subKey = "screen.today.sub.idle";

// Pain area map key. This is a data key stored in session.daily.pain,
// not UI copy, so it is not resolved through t().
const PAIN_AREA = "무릎";

const EFFORT_LEVELS = ["hard", "normal", "easy"];
const EFFORT_CHIP = { hard: "bad", normal: "neutral", easy: "good" };

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
  const { settings, programs, sessions, exercises } = data;
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

  root.appendChild(renderStartCard(ctx, settings, programs));
  root.appendChild(renderRunCard(ctx));
  root.appendChild(renderBodyweightCard(ctx));
  root.appendChild(renderCalisthenicsCard(ctx, exercises));
}

function renderStartCard(ctx, settings, programs) {
  const card = el("div", "card");
  card.appendChild(el("h2", null, t("today.start.title")));

  const weightPrograms = programs.filter((p) => p.kind === "weights");
  if (weightPrograms.length === 0) {
    card.appendChild(el("div", "empty", t("today.start.empty")));
    return card;
  }

  let selected = weightPrograms[0];
  const row = el("div", "filter-row");
  for (const program of weightPrograms) {
    const chip = el("button", "filter", program.name);
    chip.type = "button";
    if (program.id === selected.id) chip.classList.add("sel");
    chip.addEventListener("click", () => {
      selected = program;
      for (const other of row.children) other.classList.remove("sel");
      chip.classList.add("sel");
    });
    row.appendChild(chip);
  }
  card.appendChild(row);

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

function renderRunCard(ctx) {
  const { card, body } = quickCard(t("today.run.title"));
  const minutes = numberInput("", { min: 0, step: 1 });
  const hr = numberInput("", { min: 0, step: 1 });
  const pace = textInput("");
  body.append(
    field(t("today.run.minutes"), minutes),
    field(t("today.run.hr"), hr),
    field(t("today.run.pace"), pace),
  );

  const save = el("button", "btn-primary", t("common.save"));
  save.type = "button";
  save.addEventListener("click", async () => {
    save.disabled = true;
    const now = Date.now();
    await put("sessions", {
      id: newId("session"),
      date: todayISO(),
      kind: "run",
      programId: "",
      programName: "",
      recovery: false,
      startedAt: now,
      endedAt: now,
      daily: emptyDaily(),
      entries: [],
      run: { minutes: num(minutes.value), avgHr: num(hr.value) || null, pace: pace.value },
    });
    ctx.showToast(t("settings.saved"));
    await ctx.remount();
  });
  body.appendChild(save);
  return card;
}

function renderBodyweightCard(ctx) {
  const { card, body } = quickCard(t("today.bw.title"));
  const kg = numberInput("", { min: 0, step: 0.1 });
  const fasted = checkboxField(t("today.bw.fasted"), true);
  body.append(field(t("today.bw.kg"), kg), fasted.wrap);

  const save = el("button", "btn-primary", t("common.save"));
  save.type = "button";
  save.addEventListener("click", async () => {
    save.disabled = true;
    await put("bodyweight", { date: todayISO(), kg: num(kg.value), fasted: fasted.input.checked });
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
  const reps = numberInput(10, { min: 0, step: 1 });
  body.append(field(t("today.cal.pick"), select), field(t("common.reps"), reps));

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
      line.append(
        el("span", "set-no", t("common.set.n", { n: index + 1 })),
        el("span", null, t("today.set.record", { w: t("common.bodyweight.load"), r: set.reps })),
      );
      list.appendChild(line);
    });
    save.disabled = sets.length === 0;
  };

  const add = el("button", "btn-secondary", t("common.add"));
  add.type = "button";
  add.addEventListener("click", () => {
    sets.push({ weight: 0, reps: num(reps.value), effort: null, warmup: false });
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
  const painValue = num(daily.pain?.[PAIN_AREA]);
  const chips = el("div", "daily-row");
  chips.append(
    el("span", "chip neutral", t("today.daily.sleep", { h: daily.sleepH == null ? "-" : fmtNum(daily.sleepH) })),
    el("span", "chip neutral", t("today.daily.condition", { v: daily.condition == null ? "-" : fmtNum(daily.condition) })),
    el("span", `chip ${painValue > 0 ? "bad" : "neutral"}`, t("today.daily.pain", { area: PAIN_AREA, v: painValue })),
  );
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
  const pain = numberInput(painValue, { min: 0, max: 3, step: 1 });
  const heat = checkboxField(t("today.daily.heat"), daily.heat);
  const protein = checkboxField(t("today.daily.protein"), daily.proteinOk);
  const note = textInput(daily.note || "");
  form.append(
    field(t("today.daily.sleep", { h: daily.sleepH == null ? "-" : fmtNum(daily.sleepH) }), sleep),
    field(t("today.daily.condition", { v: daily.condition == null ? "-" : fmtNum(daily.condition) }), condition),
    field(t("today.daily.pain", { area: PAIN_AREA, v: painValue }), pain),
    heat.wrap,
    protein.wrap,
    field(t("today.daily.note"), note),
  );

  const save = el("button", "btn-secondary", t("common.save"));
  save.type = "button";
  save.addEventListener("click", async () => {
    save.disabled = true;
    session.daily = {
      sleepH: sleep.value === "" ? null : num(sleep.value),
      condition: condition.value === "" ? null : num(condition.value),
      pain: { ...(daily.pain || {}), [PAIN_AREA]: num(pain.value) },
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

function renderActive(root, ctx, data, session) {
  const { settings, programs, sessions, exercisesById } = data;
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

  const card = el("div", "card");
  root.appendChild(card);

  // Draft of the set currently being entered. Kept across in-place re-renders
  // of the card, reset whenever the active exercise changes.
  const draft = { entryIndex: -1, weight: 0, reps: 0, effort: null };

  const entryState = (entry, item) => {
    const working = rules.workingSets(entry.sets).length;
    const warm = entry.sets.length - working;
    return { working, warm, complete: working >= item.sets };
  };

  // Rest-bar label for the set that will be done next, right after the one
  // just saved: same exercise's next set number, or the next exercise's
  // first set once this one is complete.
  function nextSetLabel(entry, item, exercise) {
    const state = entryState(entry, item);
    if (!state.complete) {
      return t("rest.next", { name: exercise ? exercise.name : "", n: state.working + 1 });
    }
    const idx = session.entries.indexOf(entry);
    for (let i = idx + 1; i < session.entries.length; i++) {
      const nextEntry = session.entries[i];
      const nextItem = itemFor(program, nextEntry.exerciseId);
      const nextState = entryState(nextEntry, nextItem);
      if (!nextState.complete) {
        const nextEx = exercisesById[nextEntry.exerciseId] || null;
        return t("rest.next", { name: nextEx ? nextEx.name : nextEntry.exerciseId, n: nextState.working + 1 });
      }
    }
    return t("today.session.allDone");
  }

  function renderCard() {
    card.replaceChildren();

    const planned = session.entries.reduce((sum, e) => sum + itemFor(program, e.exerciseId).sets, 0);
    card.appendChild(el("h2", null, t("today.session.title", { name: session.programName, sets: planned })));

    const list = el("div", "ex-list");
    card.appendChild(list);

    const activeIndex = session.entries.findIndex((entry) => {
      const item = itemFor(program, entry.exerciseId);
      return !entryState(entry, item).complete;
    });
    if (draft.entryIndex !== activeIndex) {
      const entry = activeIndex >= 0 ? session.entries[activeIndex] : null;
      const item = entry ? itemFor(program, entry.exerciseId) : null;
      const exercise = entry ? exercisesById[entry.exerciseId] : null;
      draft.entryIndex = activeIndex;
      draft.effort = null;
      draft.weight = item
        ? (session.recovery
            ? rules.recoveryLoad(item.targetLoad, settings.recoveryRule.factor, stepsFor(exercise, settings))
            : item.targetLoad)
        : 0;
      draft.reps = entry ? (entry.targetReps === "max" ? 0 : num(entry.targetReps)) : 0;
    }

    session.entries.forEach((entry, index) => {
      const item = itemFor(program, entry.exerciseId);
      const exercise = exercisesById[entry.exerciseId] || null;
      const state = entryState(entry, item);

      const row = el("div", "ex-row");
      if (state.complete) row.classList.add("done");
      if (index === activeIndex) row.classList.add("active");
      row.appendChild(el("div", "num", String(index + 1)));

      const name = el("div", "name");
      name.appendChild(el("span", null, exercise ? exercise.name : entry.exerciseId));
      if (exercise?.variant) name.appendChild(el("span", "variant", ` ${exercise.variant}`));
      row.appendChild(name);

      row.appendChild(el(
        "div",
        "meta",
        `${item.sets}×${repsText(entry.targetReps)} · ${loadText(exercise, item.targetLoad, settings)}`,
      ));
      list.appendChild(row);

      if (index === activeIndex) {
        list.appendChild(renderSetBlock(entry, item, exercise));
      } else if (state.complete) {
        const suggestion = suggestionFor({ session, sessions, entry, item, exercise, settings });
        list.appendChild(el("div", "hint", suggestionText(session, suggestion, exercise, settings)));
      }
    });

    if (activeIndex < 0) {
      card.appendChild(el("div", "empty", t("today.session.allDone")));
    }
  }

  function renderSetBlock(entry, item, exercise) {
    const block = el("div", "set-block");
    const state = entryState(entry, item);
    const warmupTarget = num(item.warmupSets);
    const isWarmup = state.warm < warmupTarget && state.working === 0;

    let workingSeen = 0;
    for (const set of entry.sets) {
      const label = set.warmup ? t("common.warmup") : t("common.set.n", { n: ++workingSeen });
      block.appendChild(setLine(exercise, set, label, settings));
    }

    const entryBox = el("div", "set-entry");
    entryBox.appendChild(el(
      "div",
      "hint",
      isWarmup ? t("common.warmup") : t("common.set.n", { n: state.working + 1 }),
    ));

    const steps = stepsFor(exercise, settings);
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
      startRest(
        rules.restSecondsFor(entry.exerciseId, settings),
        nextSetLabel(entry, item, exercise),
      );
      await put("sessions", session);
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
  renderRestBar();
}

function clearRest() {
  restState = { endsAt: null, totalMs: null, label: "" };
  persistRestState();
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
  const [settings, programs, sessions, exercises] = await Promise.all([
    getSettings(),
    getAll("programs"),
    getAll("sessions"),
    getAll("exercises"),
  ]);
  const data = {
    settings,
    programs: programs.filter((p) => p.kind === "weights"),
    sessions,
    exercises,
    exercisesById: byId(exercises),
  };

  const active = findActiveSession(sessions);
  if (active) renderActive(root, ctx, data, active);
  else renderIdle(root, ctx, data);
}
