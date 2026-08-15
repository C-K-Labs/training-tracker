// Settings screen: weight inventory, program / library / recovery editors,
// data import-export, and display preferences.
//
// Every group is a .card holding a .set-list of .set-row items. A tappable row
// toggles a plain editor div rendered directly beneath it; each card owns its
// own render() so a save refreshes only that card and keeps the editor open.
//
// Imported packs and all user-entered text are untrusted input: strings only
// ever reach the DOM through textContent / createElement, never innerHTML, and
// pack validation stays inside store.importPack.

import { t, getLang, setLang, availableLangs } from "../i18n.js";
import { APP_VERSION, CHANGELOG } from "../version.js";
import {
  getSettings, saveSettings, getAll, put, del, newId, bulkPut, exportPack, importPack,
  importGuestPack, getGuests, deleteGuest, PACK_FORMAT_VERSION,
} from "../store.js";
import * as rules from "../rules.js";
import * as onboarding from "../onboarding.js";
import { tipFor } from "../tips.js";
import { exName, programLabel } from "../names.js";
import { generateCode, normalizeCode, deriveFromCode, encryptPack, decryptBlob } from "../crypto.js";
import { isSupported as pushSupported, permissionState, iosNeedsInstall, enableRestPush, disableRestPush } from "../push.js";

export const titleKey = "tab.settings";
export const subKey = "screen.settings.sub";

const BODY_PARTS = ["legs", "back", "chest", "shoulders", "arms", "core", "full"];
const EQUIPMENT = ["dumbbell", "barbell", "smith", "cable", "machine", "bodyweight"];
const UNITS = ["lb", "kg"];

// ------------------------------------------------------------------ helpers

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function inputEl(type, value, attrs = {}) {
  const node = document.createElement("input");
  node.type = type;
  if (type === "checkbox") node.checked = value === true;
  else node.value = value == null ? "" : String(value);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function selectEl(options, selected) {
  const node = document.createElement("select");
  for (const o of options) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    if (o.value === selected) opt.selected = true;
    node.appendChild(opt);
  }
  return node;
}

// A .field wrapper; label is optional for controls that describe themselves.
function fieldEl(labelText, ...controls) {
  const f = el("div", "field");
  if (labelText != null) f.appendChild(el("label", null, labelText));
  for (const c of controls) f.appendChild(c);
  return f;
}

// The editor area and its inner rows have no class in app.css; the inline
// styles here are layout only, so the screen stays self-contained.
function editorBox() {
  const box = el("div");
  box.style.display = "flex";
  box.style.flexDirection = "column";
  box.style.gap = "8px";
  box.style.padding = "2px 2px 12px";
  return box;
}

function flexBox(gap = "6px") {
  const box = el("div");
  box.style.display = "flex";
  box.style.flexWrap = "wrap";
  box.style.alignItems = "center";
  box.style.gap = gap;
  return box;
}

function numberField(labelText, value, attrs, basis = "1 1 70px") {
  const control = inputEl("number", value, attrs);
  control.style.width = "100%";
  const f = fieldEl(labelText, control);
  f.style.flex = basis;
  return { field: f, control };
}

function numValue(control, fallback) {
  const v = Number(control.value);
  return Number.isFinite(v) ? v : fallback;
}

function isoDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function mmss(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function exLabel(ex) {
  const base = exName(ex);
  return ex.variant ? `${base} (${ex.variant})` : base;
}

// Exercise <select> grouped by body part (v1.6.0), canonical part order,
// localized and sorted labels within each group. Used by every picker that
// previously listed the whole library flat.
const PART_ORDER = ["legs", "back", "chest", "shoulders", "arms", "core", "full"];

function exerciseSelect(exercises, selected) {
  const node = document.createElement("select");
  for (const part of PART_ORDER) {
    const inPart = exercises
      .filter((e) => (e.bodyPart || "full") === part)
      .sort((a, b) => exLabel(a).localeCompare(exLabel(b)));
    if (inPart.length === 0) continue;
    const group = document.createElement("optgroup");
    group.label = t(`bodypart.${part}`);
    for (const ex of inPart) {
      const opt = document.createElement("option");
      opt.value = ex.id;
      opt.textContent = exLabel(ex);
      if (ex.id === selected) opt.selected = true;
      group.appendChild(opt);
    }
    node.appendChild(group);
  }
  return node;
}

function loadConventionFor(equipment) {
  if (equipment === "dumbbell") return "per-hand";
  if (equipment === "barbell" || equipment === "smith") return "excludes-bar";
  if (equipment === "bodyweight") return "bodyweight";
  return "stack";
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("read-failed"));
    reader.readAsText(file);
  });
}

function cardEl(key) {
  const card = el("section", "card");
  card.appendChild(el("h2", null, t(key)));
  const list = el("div", "set-list");
  card.appendChild(list);
  return { card, list };
}

// One settings row. `editor` makes the row tappable and renders beneath it
// while this row is the open one; `onTap` is a plain action row instead.
function rowEl(list, open, key, opts) {
  const row = el("div", "set-row");
  const left = el("div", "l");
  left.appendChild(el("div", "t", opts.title));
  if (opts.desc != null) left.appendChild(el("div", "d", opts.desc));
  row.appendChild(left);
  const right = el("div", "r");
  if (opts.right instanceof Node) right.appendChild(opts.right);
  else if (opts.right != null) right.textContent = opts.right;
  row.appendChild(right);
  list.appendChild(row);

  if (opts.editor) {
    row.classList.add("tappable");
    row.addEventListener("click", () => {
      open.key = open.key === key ? null : key;
      opts.rerender();
    });
    if (open.key === key) {
      const box = editorBox();
      list.appendChild(box);
      opts.editor(box);
    }
  } else if (opts.onTap) {
    row.classList.add("tappable");
    row.addEventListener("click", opts.onTap);
  }
  return row;
}

// silent (v1.1.1 polish item 4): field-level autosaves inside the program
// card (sets/reps/targetLoad/warmupSets/method item fields, the rest default
// field) skip the toast; every other caller keeps the confirmation.
async function commitSettings(state, ctx, { silent = false } = {}) {
  await saveSettings(state.settings);
  if (!silent) ctx.showToast(t("settings.saved"));
}

// ------------------------------------------------------------------ mount

export async function mount(root, ctx) {
  const [settings, exercises, programs, sessions, bodyweight, guests] = await Promise.all([
    getSettings(), getAll("exercises"), getAll("programs"), getAll("sessions"), getAll("bodyweight"), getGuests(),
  ]);
  const state = { settings, exercises, programs, sessions, bodyweight, guests };

  root.appendChild(inventoryCard(state, ctx));
  root.appendChild(programCard(state, ctx));
  root.appendChild(notifyCard(state, ctx));
  root.appendChild(nutritionCard(state, ctx));
  root.appendChild(dataCard(state, ctx));
  root.appendChild(feedbackCard(state, ctx));
  root.appendChild(displayCard(state, ctx));
  root.appendChild(aboutCard(state, ctx));
}

// ------------------------------------------------------------------ about

// Version and patch notes (v1.3.0). The same CHANGELOG the update notice
// reads, kept reachable after that notice is closed. Notes ship in every UI
// language (js/version.js), with English as the fallback.
function aboutCard(state, ctx) {
  const { card, list } = cardEl("settings.about.title");
  const open = { key: null };

  function render() {
    list.textContent = "";
    rowEl(list, open, "history", {
      title: t("settings.about.history"),
      desc: t("settings.about.history.desc"),
      right: `v${APP_VERSION}`,
      rerender: render,
      editor: (box) => {
        box.appendChild(el("div", "hint", t("settings.about.autoupdate")));
        const noteLang = getLang();
        for (const entry of CHANGELOG) {
          const head = flexBox("6px");
          head.appendChild(el("strong", null, `v${entry.version}`));
          head.appendChild(el("span", "hint", entry.date));
          box.appendChild(head);

          const notes = document.createElement("ul");
          notes.style.margin = "0";
          notes.style.paddingLeft = "18px";
          notes.style.display = "flex";
          notes.style.flexDirection = "column";
          notes.style.gap = "4px";
          notes.style.fontSize = "13px";
          for (const note of entry.notes[noteLang] || entry.notes.en || []) notes.appendChild(el("li", null, note));
          box.appendChild(notes);
        }
      },
    });
  }

  render();
  return card;
}

// -------------------------------------------------------------- inventory

function inventoryCard(state, ctx) {
  const { card, list } = cardEl("settings.inventory.title");
  const open = { key: null };

  function render() {
    list.textContent = "";
    const inv = state.settings.inventory;
    const addRow = (key, opts) => rowEl(list, open, key, { ...opts, rerender: render });

    const dumbbells = inv.dumbbells || [];
    addRow("dumbbell", {
      title: t("settings.inventory.dumbbell"),
      desc: t("settings.inventory.dumbbell.desc", {
        min: dumbbells.length ? dumbbells[0] : "-",
        max: dumbbells.length ? dumbbells[dumbbells.length - 1] : "-",
      }),
      editor: (box) => dumbbellEditor(box, state, ctx, render),
    });

    addRow("plate", {
      title: t("settings.inventory.plate"),
      desc: t("settings.inventory.plate.desc", { min: inv.plateMin, step: inv.plateMin * 2 }),
      editor: (box) => {
        const control = inputEl("number", inv.plateMin, { step: 0.25, min: 0.25 });
        box.appendChild(fieldEl(t("settings.inventory.plate"), control));
        const save = el("button", "btn-primary", t("common.save"));
        save.addEventListener("click", async () => {
          const v = numValue(control, NaN);
          if (!Number.isFinite(v) || v < 0.25) return;
          inv.plateMin = v;
          await commitSettings(state, ctx);
          render();
        });
        box.appendChild(save);
      },
    });

    addRow("cable", {
      title: t("settings.inventory.cable"),
      desc: t("settings.inventory.cable.desc", { step: inv.cableStep }),
      editor: (box) => {
        const control = inputEl("number", inv.cableStep, { step: 0.25, min: 0.25 });
        box.appendChild(fieldEl(t("settings.inventory.cable"), control));
        const save = el("button", "btn-primary", t("common.save"));
        save.addEventListener("click", async () => {
          const v = numValue(control, NaN);
          if (!Number.isFinite(v) || v < 0.25) return;
          inv.cableStep = v;
          await commitSettings(state, ctx);
          render();
        });
        box.appendChild(save);
      },
    });

    addRow("machine", {
      title: t("settings.inventory.machine"),
      desc: t("settings.inventory.machine.desc", { step: inv.machineStep }),
      editor: (box) => {
        const control = inputEl("number", inv.machineStep, { step: 0.5, min: 0.25 });
        box.appendChild(fieldEl(t("settings.inventory.machine"), control));
        const save = el("button", "btn-primary", t("common.save"));
        save.addEventListener("click", async () => {
          const v = numValue(control, NaN);
          if (!Number.isFinite(v) || v < 0.25) return;
          inv.machineStep = v;
          await commitSettings(state, ctx);
          render();
        });
        box.appendChild(save);
      },
    });

    const overrides = inv.overrides || {};
    addRow("overrides", {
      title: t("settings.inventory.overrides"),
      desc: t("settings.inventory.overrides.desc", { n: Object.keys(overrides).length }),
      editor: (box) => overridesEditor(box, state, ctx, render),
    });
  }

  render();
  return card;
}

// Dumbbell inventory (A4): dumbbells (inv.dumbbells) is the ENABLED sorted
// list that rules.inventorySteps actually consumes (back-compat preserved);
// dumbbellPool is the full set of known/generated weights the chip list is
// built from. A range generator fills the pool; tapping a chip toggles
// membership in the enabled list; the manual-add input covers one-offs.
function dumbbellEditor(box, state, ctx, render) {
  const inv = state.settings.inventory;
  const enabled = inv.dumbbells || [];
  const pool = inv.dumbbellPool && inv.dumbbellPool.length ? inv.dumbbellPool : enabled;

  const min = numberField(t("settings.inventory.range.min"), 5, { min: 0, step: 2.5 }, "1 1 70px");
  const max = numberField(t("settings.inventory.range.max"), 50, { min: 0, step: 2.5 }, "1 1 70px");
  const step = numberField(t("settings.inventory.range.step"), 5, { min: 0.5, step: 0.5 }, "1 1 70px");
  const rangeRow = flexBox();
  rangeRow.append(min.field, max.field, step.field);
  box.appendChild(rangeRow);

  const generate = el("button", "btn-secondary", t("settings.inventory.range.generate"));
  generate.addEventListener("click", async () => {
    const mn = numValue(min.control, NaN);
    const mx = numValue(max.control, NaN);
    const st = numValue(step.control, NaN);
    if (![mn, mx, st].every(Number.isFinite) || st <= 0 || mx < mn) return;
    const nextPool = new Set(pool);
    for (let v = mn; v <= mx + 1e-9; v = +(v + st).toFixed(2)) nextPool.add(v);
    inv.dumbbellPool = [...nextPool].sort((a, b) => a - b);
    await commitSettings(state, ctx);
    render();
  });
  box.appendChild(generate);

  box.appendChild(el("div", "field", t("settings.inventory.dumbbell.owned")));
  const enabledSet = new Set(enabled);
  const chipList = el("div", "chip-list");
  for (const w of pool) {
    const chip = el("button", `chip-toggle${enabledSet.has(w) ? " on" : ""}`, String(w));
    chip.type = "button";
    chip.addEventListener("click", async () => {
      const nextEnabled = new Set(inv.dumbbells || []);
      if (nextEnabled.has(w)) nextEnabled.delete(w); else nextEnabled.add(w);
      inv.dumbbells = [...nextEnabled].sort((a, b) => a - b);
      await commitSettings(state, ctx);
      render();
    });
    chipList.appendChild(chip);
  }
  box.appendChild(chipList);

  const manual = inputEl("number", "", { step: 0.5, min: 0 });
  const manualRow = flexBox();
  manualRow.appendChild(manual);
  const manualAdd = el("button", "btn-secondary", t("settings.inventory.manual.add"));
  manualRow.appendChild(manualAdd);
  box.appendChild(fieldEl(null, manualRow));
  manualAdd.addEventListener("click", async () => {
    const v = numValue(manual, NaN);
    if (!Number.isFinite(v) || v < 0) return;
    const nextPool = new Set(pool);
    nextPool.add(v);
    inv.dumbbellPool = [...nextPool].sort((a, b) => a - b);
    const nextEnabled = new Set(inv.dumbbells || []);
    nextEnabled.add(v); // a manually added weight is enabled by default
    inv.dumbbells = [...nextEnabled].sort((a, b) => a - b);
    await commitSettings(state, ctx);
    render();
  });
}

function overridesEditor(box, state, ctx, render) {
  const inv = state.settings.inventory;
  const overrides = inv.overrides || {};

  for (const [exerciseId, ov] of Object.entries(overrides)) {
    const ex = state.exercises.find((e) => e.id === exerciseId);
    const value = Array.isArray(ov)
      ? ov.join(", ")
      : String(ov && ov.max != null ? ov.max : t("common.none"));
    const line = flexBox();
    line.style.justifyContent = "space-between";
    line.appendChild(el("div", null, `${ex ? exLabel(ex) : t("common.exercise.deleted")} · ${value}`));
    const remove = el("button", "link", t("common.delete"));
    remove.addEventListener("click", async () => {
      delete overrides[exerciseId];
      inv.overrides = overrides;
      await commitSettings(state, ctx);
      render();
    });
    line.appendChild(remove);
    box.appendChild(line);
  }

  if (state.exercises.length === 0) {
    box.appendChild(el("div", "empty", t("common.none")));
    return;
  }

  const picker = exerciseSelect(state.exercises);
  picker.style.flex = "1 1 140px";
  const max = inputEl("number", "", { step: 0.5, min: 0 });
  max.style.flex = "1 1 80px";
  const line = flexBox();
  line.append(picker, max);
  box.appendChild(fieldEl(t("settings.inventory.overrides"), line));

  const add = el("button", "btn-secondary", t("common.add"));
  add.addEventListener("click", async () => {
    const v = numValue(max, NaN);
    if (!picker.value || !Number.isFinite(v) || v < 0) return;
    overrides[picker.value] = { max: v };
    inv.overrides = overrides;
    await commitSettings(state, ctx);
    render();
  });
  box.appendChild(add);
}

// ---------------------------------------------------------------- program

function programCard(state, ctx) {
  const { card, list } = cardEl("settings.program.title");
  const open = { key: null };

  function render() {
    list.textContent = "";
    const addRow = (key, opts) => rowEl(list, open, key, { ...opts, rerender: render });

    addRow("sessions", {
      title: t("settings.program.sessions"),
      editor: (box) => sessionsEditor(box, state, ctx, render),
    });

    // Rule-based course generator (C3/C4): same wizard as first-run
    // onboarding, minus the import-or-fresh question. Generated exercises/
    // programs are merged in (bulkPut by id) and never delete anything
    // existing; a full ctx.remount() afterward refreshes this screen's
    // program/library lists to show the new content.
    addRow("generate", {
      title: t("settings.program.generate"),
      desc: t("settings.program.generate.desc"),
      onTap: () => {
        onboarding.mount(document.body, ctx, {
          skipDataStep: true,
          onDone: () => ctx.remount(),
        });
      },
    });

    addRow("library", {
      title: t("settings.program.library"),
      desc: t("settings.program.library.desc", { n: state.exercises.length }),
      editor: (box) => libraryEditor(box, state, ctx, render),
    });

    const rule = state.settings.recoveryRule;
    addRow("recovery", {
      title: t("settings.program.recovery"),
      desc: t("settings.program.recovery.desc", {
        days: rule.gapDays,
        pct: Math.round(rule.factor * 100),
      }),
      editor: (box) => {
        const days = numberField(t("settings.program.recovery.days"), rule.gapDays, { min: 7, step: 1 }, "1 1 110px");
        const pct = numberField(t("settings.program.recovery.factor"), Math.round(rule.factor * 100), { min: 50, max: 100, step: 1 }, "1 1 110px");
        const line = flexBox();
        line.append(days.field, pct.field);
        box.appendChild(line);
        const save = el("button", "btn-primary", t("common.save"));
        save.addEventListener("click", async () => {
          const d = numValue(days.control, NaN);
          const p = numValue(pct.control, NaN);
          if (!Number.isFinite(d) || d < 7 || !Number.isFinite(p) || p < 50 || p > 100) return;
          rule.gapDays = d;
          rule.factor = p / 100;
          await commitSettings(state, ctx);
          render();
        });
        box.appendChild(save);
      },
    });

    addRow("rest", {
      title: t("settings.rest.title"),
      desc: t("settings.rest.hint"),
      right: `${mmss(state.settings.restCompoundSec ?? 150)} · ${mmss(state.settings.restIsolationSec ?? 90)}`,
      editor: (box) => restEditor(box, state, ctx, render),
    });

    addRow("warmup", {
      title: t("settings.warmup.title"),
      desc: t("settings.warmup.desc"),
      right: t(`settings.warmup.${state.settings.warmupStyle === "flat" ? "flat" : "ramp"}`),
      editor: (box) => warmupEditor(box, state, ctx, render),
    });
  }

  render();
  return card;
}

// Rest timer defaults (A2, split by tier in v1.2): compound/isolation set
// rest plus the between-exercise rest, and per-exercise overrides
// (settings.restOverrides, exerciseId -> seconds). Consumed by js/rules.js
// restSecondsFor, which prefers the override when present.
function restEditor(box, state, ctx, render) {
  box.appendChild(el("div", "hint", t("settings.rest.tier.desc")));
  const compound = numberField(t("settings.rest.compound"), state.settings.restCompoundSec ?? 150, { min: 10, step: 5 }, "1 1 100px");
  const isolation = numberField(t("settings.rest.isolation"), state.settings.restIsolationSec ?? 90, { min: 10, step: 5 }, "1 1 100px");
  const between = numberField(t("settings.rest.between"), state.settings.restBetweenSec ?? 150, { min: 10, step: 5 }, "1 1 100px");
  const line = flexBox();
  line.append(compound.field, isolation.field, between.field);
  box.appendChild(line);
  const save = el("button", "btn-primary", t("common.save"));
  save.addEventListener("click", async () => {
    const c = numValue(compound.control, NaN);
    const i = numValue(isolation.control, NaN);
    const b = numValue(between.control, NaN);
    if (![c, i, b].every((v) => Number.isFinite(v) && v >= 10)) return;
    state.settings.restCompoundSec = c;
    state.settings.restIsolationSec = i;
    state.settings.restBetweenSec = b;
    await commitSettings(state, ctx, { silent: true });
    render();
  });
  box.appendChild(save);

  const overrides = state.settings.restOverrides || {};
  const overridesWrap = el("div");
  overridesWrap.style.marginTop = "10px";
  overridesWrap.style.borderTop = "1px solid var(--line)";
  overridesWrap.style.paddingTop = "8px";
  overridesWrap.appendChild(el(
    "div",
    null,
    `${t("settings.rest.overrides")} · ${t("settings.rest.overrides.desc", { n: Object.keys(overrides).length })}`,
  ));

  for (const [exerciseId, secs] of Object.entries(overrides)) {
    const ex = state.exercises.find((e) => e.id === exerciseId);
    const line = flexBox();
    line.style.justifyContent = "space-between";
    line.appendChild(el("div", null, `${ex ? exLabel(ex) : t("common.exercise.deleted")} · ${mmss(secs)}`));
    const remove = el("button", "link", t("common.delete"));
    remove.addEventListener("click", async () => {
      delete overrides[exerciseId];
      state.settings.restOverrides = overrides;
      await commitSettings(state, ctx);
      render();
    });
    line.appendChild(remove);
    overridesWrap.appendChild(line);
  }

  if (state.exercises.length === 0) {
    overridesWrap.appendChild(el("div", "empty", t("common.none")));
    box.appendChild(overridesWrap);
    return;
  }

  const picker = exerciseSelect(state.exercises);
  picker.style.flex = "1 1 140px";
  const secs = inputEl("number", 90, { step: 5, min: 10 });
  secs.style.flex = "1 1 90px";
  const pickLine = flexBox();
  pickLine.append(picker, secs);
  overridesWrap.appendChild(fieldEl(t("settings.rest.seconds"), pickLine));

  const add = el("button", "btn-secondary", t("common.add"));
  add.addEventListener("click", async () => {
    const v = numValue(secs, NaN);
    if (!picker.value || !Number.isFinite(v) || v < 10) return;
    overrides[picker.value] = v;
    state.settings.restOverrides = overrides;
    await commitSettings(state, ctx);
    render();
  });
  overridesWrap.appendChild(add);
  box.appendChild(overridesWrap);
}

// Warm-up load style (v1.2): flat repeats 50% of the target on every
// warm-up set; ramp climbs 50% -> 70% so the last warm-up sits closer to
// the working load.
function warmupEditor(box, state, ctx, render) {
  const seg = el("div", "seg");
  for (const value of ["ramp", "flat"]) {
    const btn = el("button", (state.settings.warmupStyle === "flat" ? "flat" : "ramp") === value ? "sel" : null, t(`settings.warmup.${value}`));
    btn.type = "button";
    btn.addEventListener("click", async () => {
      state.settings.warmupStyle = value;
      await commitSettings(state, ctx, { silent: true });
      render();
    });
    seg.appendChild(btn);
  }
  box.appendChild(seg);
}

// silent (v1.1.1 polish item 4): field-level item edits (sets/reps/
// targetLoad/warmupSets/method) skip the toast; structural program actions
// (add/remove item, add/delete program, reorder, exercise picker) keep it.
async function saveProgram(program, ctx, rerender, { silent = false } = {}) {
  await put("programs", program);
  if (!silent) ctx.showToast(t("settings.saved"));
  if (rerender) rerender();
}

function sessionsEditor(box, state, ctx, render) {
  const weightPrograms = rules.sortPrograms(state.programs.filter((p) => p.kind === "weights"));
  weightPrograms.forEach((program, index) => {
    box.appendChild(programBlock(program, state, ctx, render, { list: weightPrograms, index }));
  });
  if (weightPrograms.length === 0) box.appendChild(el("div", "empty", t("today.start.empty")));

  const addProgram = el("button", "btn-primary", t("common.add"));
  addProgram.addEventListener("click", async () => {
    const program = { id: newId("program"), name: t("settings.program.new"), kind: "weights", items: [] };
    await put("programs", program);
    state.programs = await getAll("programs");
    ctx.showToast(t("settings.saved"));
    render();
  });
  box.appendChild(addProgram);
}

function programBlock(program, state, ctx, render, reorder) {
  const block = el("div");
  block.style.display = "flex";
  block.style.flexDirection = "column";
  block.style.gap = "8px";
  block.style.borderTop = "1px solid var(--line)";
  block.style.paddingTop = "8px";

  const name = inputEl("text", program.name);
  name.addEventListener("change", async () => {
    program.name = name.value;
    await saveProgram(program, ctx);
  });
  const nameRow = flexBox();
  const nameField = fieldEl(t("settings.program.name"), name);
  nameField.style.flex = "1";
  nameRow.appendChild(nameField);

  // Session-level reorder (v1.12.0): the session picker and this editor
  // both follow rules.sortPrograms. A swap writes explicit order fields to
  // EVERY listed program so pre-ordering records cannot jump around.
  if (reorder) {
    const { list, index } = reorder;
    const move = async (delta) => {
      const j = index + delta;
      if (j < 0 || j >= list.length) return;
      list.forEach((p, k) => { p.order = k; });
      [list[index].order, list[j].order] = [j, index];
      await bulkPut("programs", list);
      state.programs = await getAll("programs");
      render();
    };
    const up = el("button", "link", "↑");
    up.type = "button";
    up.disabled = index === 0;
    up.addEventListener("click", () => move(-1));
    const down = el("button", "link", "↓");
    down.type = "button";
    down.disabled = index === list.length - 1;
    down.addEventListener("click", () => move(1));
    nameRow.append(up, down);
  }
  block.appendChild(nameRow);

  program.items.forEach((_, index) => {
    block.appendChild(itemBlock(program, index, state, ctx, render));
  });

  const actions = flexBox("8px");
  const addItem = el("button", "btn-secondary", t("common.add"));
  addItem.style.flex = "1";
  addItem.addEventListener("click", async () => {
    const first = state.exercises[0];
    program.items.push({
      exerciseId: first ? first.id : "",
      sets: 3,
      reps: 8,
      targetLoad: 0,
      warmupSets: 0,
    });
    await saveProgram(program, ctx, render);
  });
  const removeProgram = el("button", "link", t("common.delete"));
  removeProgram.addEventListener("click", async () => {
    if (!confirm(t("common.delete.confirm", { name: program.name }))) return;
    await del("programs", program.id);
    state.programs = await getAll("programs");
    ctx.showToast(t("settings.saved"));
    render();
  });
  actions.append(addItem, removeProgram);
  block.appendChild(actions);
  return block;
}

// Target-load editor (v1.7, replaces the A3 single-field-plus-hint version):
// one box per unit, lb and kg side by side, and typing in either auto-fills
// the other. The old formatLoad hint under a single field gave that field
// extra height and made the numbers row ragged; two same-height fields keep
// the row on one line. Storage stays in the exercise's storedUnit at the
// same 2-decimal precision parseLoadInput used.
function targetLoadField(item, exercise) {
  const storedUnit = exercise?.unit === "kg" ? "kg" : "lb";
  const lbValue = storedUnit === "lb" ? item.targetLoad : rules.kgToLb(item.targetLoad);
  const kgValue = storedUnit === "kg" ? item.targetLoad : rules.lbToKg(item.targetLoad);
  const lb = numberField(`${t("settings.program.item.load")} (lb)`, lbValue, { min: 0, step: 0.5 });
  const kg = numberField(`${t("settings.program.item.load")} (kg)`, kgValue, { min: 0, step: 0.5 });
  return { storedUnit, lb, kg };
}

// Method picker (C1): segmented control with a one-line tradeoff description
// under each option. Choosing "superset" pairs this item with the NEXT one
// (sets method+supersetGroup on both); switching away unpairs both. The last
// item in the list cannot become a superset (there is no next item to pair).
const PROGRAM_METHODS = [null, "pyramid", "superset", "dropset"];

function methodField(program, index, state, ctx, render) {
  const item = program.items[index];
  const isLast = index === program.items.length - 1;
  const wrap = el("div", "field");
  wrap.appendChild(el("label", null, t("settings.program.item.method")));

  const seg = el("div", "seg");
  for (const m of PROGRAM_METHODS) {
    const key = m ? `method.${m}` : "method.normal";
    const btn = el("button", (item.method || null) === m ? "sel" : null, t(key));
    btn.type = "button";
    if (m === "superset" && isLast) btn.disabled = true;
    btn.addEventListener("click", async () => {
      if (m === "superset" && isLast) return;
      if (m === "superset") {
        const partner = program.items[index + 1];
        const group = (item.supersetGroup && partner.supersetGroup === item.supersetGroup)
          ? item.supersetGroup
          : newId("ss");
        item.method = "superset";
        item.supersetGroup = group;
        partner.method = "superset";
        partner.supersetGroup = group;
      } else {
        // Unpairing: clear the partner too so no dangling half survives.
        if (item.method === "superset" && item.supersetGroup) {
          const partner = program.items.find((it, i) => i !== index && it.supersetGroup === item.supersetGroup);
          if (partner) {
            partner.method = null;
            delete partner.supersetGroup;
          }
        }
        item.method = m;
        delete item.supersetGroup;
      }
      await saveProgram(program, ctx, render, { silent: true });
    });
    seg.appendChild(btn);
  }
  wrap.appendChild(seg);

  const descKey = item.method ? `method.${item.method}.desc` : "method.normal.desc";
  wrap.appendChild(el("div", "hint", t(descKey)));
  if (isLast) wrap.appendChild(el("div", "hint", t("settings.program.method.superset.lastHint")));
  if (item.method === "superset" && item.supersetGroup) {
    // The actual partner, not always index+1: this item may be either half
    // of the pair (the one the user picked "superset" on, or its auto-paired
    // neighbor), so match by shared supersetGroup instead of position.
    const partner = program.items.find((it, i) => i !== index && it.supersetGroup === item.supersetGroup);
    const partnerEx = partner ? state.exercises.find((e) => e.id === partner.exerciseId) : null;
    wrap.appendChild(el("div", "hint", t("settings.program.method.pairedWith", {
      name: partnerEx ? exLabel(partnerEx) : (partner ? t("common.exercise.deleted") : ""),
    })));
  }
  return wrap;
}

function itemBlock(program, index, state, ctx, render) {
  const item = program.items[index];
  const exercise = state.exercises.find((e) => e.id === item.exerciseId) || null;
  const wrap = el("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.gap = "6px";
  wrap.style.paddingLeft = "6px";
  wrap.style.borderLeft = "2px solid var(--line)";

  const picker = exerciseSelect(state.exercises, item.exerciseId);
  picker.addEventListener("change", async () => {
    item.exerciseId = picker.value;
    // Full rerender: the load field's unit basis depends on the exercise.
    await saveProgram(program, ctx, render);
  });
  wrap.appendChild(fieldEl(null, picker));

  wrap.appendChild(methodField(program, index, state, ctx, render));

  const nums = flexBox();
  // Bottom-align the input boxes: a label that wraps to two lines (long
  // translations) must not push its box out of the shared row line.
  nums.style.alignItems = "flex-end";
  const sets = numberField(t("common.sets"), item.sets, { min: 1, step: 1 });
  const reps = numberField(t("common.reps"), item.reps === "max" ? "" : item.reps, { min: 1, step: 1 });
  const load = targetLoadField(item, exercise);
  const warmup = numberField(t("common.warmup"), item.warmupSets, { min: 0, step: 1 });
  reps.control.disabled = item.reps === "max";
  nums.append(sets.field, reps.field, load.lb.field, load.kg.field, warmup.field);
  wrap.appendChild(nums);

  sets.control.addEventListener("change", async () => {
    item.sets = numValue(sets.control, item.sets);
    await saveProgram(program, ctx, null, { silent: true });
  });
  reps.control.addEventListener("change", async () => {
    item.reps = numValue(reps.control, 8);
    await saveProgram(program, ctx, null, { silent: true });
  });
  const commitLoad = async (fromUnit) => {
    const typed = fromUnit === "lb" ? load.lb.control : load.kg.control;
    const other = fromUnit === "lb" ? load.kg.control : load.lb.control;
    const v = Math.max(0, numValue(typed, 0));
    const stored = fromUnit === load.storedUnit
      ? v
      : (fromUnit === "lb" ? rules.lbToKg(v, { round: false }) : rules.kgToLb(v, { round: false }));
    item.targetLoad = Math.round(stored * 100) / 100;
    other.value = String(fromUnit === "lb" ? rules.lbToKg(v) : rules.kgToLb(v));
    await saveProgram(program, ctx, null, { silent: true });
  };
  load.lb.control.addEventListener("change", () => commitLoad("lb"));
  load.kg.control.addEventListener("change", () => commitLoad("kg"));
  warmup.control.addEventListener("change", async () => {
    item.warmupSets = numValue(warmup.control, item.warmupSets);
    await saveProgram(program, ctx, null, { silent: true });
  });

  const tail = flexBox("8px");
  const maxWrap = el("label");
  maxWrap.style.display = "flex";
  maxWrap.style.alignItems = "center";
  maxWrap.style.gap = "4px";
  maxWrap.style.fontSize = "12px";
  maxWrap.style.flex = "1";
  const maxBox = inputEl("checkbox", item.reps === "max");
  maxBox.addEventListener("change", async () => {
    if (maxBox.checked) {
      item.reps = "max";
      reps.control.value = "";
      reps.control.disabled = true;
    } else {
      item.reps = 8;
      reps.control.value = "8";
      reps.control.disabled = false;
    }
    // Same logical field as the reps number input above: silent too (item 4).
    await saveProgram(program, ctx, null, { silent: true });
  });
  maxWrap.append(maxBox, el("span", null, t("common.max.reps")));

  const up = el("button", "link", "↑");
  up.disabled = index === 0;
  up.addEventListener("click", async () => {
    const items = program.items;
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    await saveProgram(program, ctx, render);
  });
  const down = el("button", "link", "↓");
  down.disabled = index === program.items.length - 1;
  down.addEventListener("click", async () => {
    const items = program.items;
    [items[index + 1], items[index]] = [items[index], items[index + 1]];
    await saveProgram(program, ctx, render);
  });
  const remove = el("button", "link", t("common.delete"));
  remove.addEventListener("click", async () => {
    program.items.splice(index, 1);
    await saveProgram(program, ctx, render);
  });

  tail.append(maxWrap, up, down, remove);
  wrap.appendChild(tail);
  return wrap;
}

// Usage-aware delete confirm (v1.1.1 polish item 9a): counts program-item
// references and session-entry references so the confirm dialog can warn
// before an in-use exercise is deleted.
function exerciseUsage(state, exerciseId) {
  const programs = state.programs.reduce(
    (n, p) => n + (p.items || []).filter((i) => i.exerciseId === exerciseId).length, 0,
  );
  const sessions = state.sessions.reduce(
    (n, s) => n + (s.entries || []).filter((e) => e.exerciseId === exerciseId).length, 0,
  );
  return { programs, sessions };
}

function libraryEditor(box, state, ctx, render) {
  // Compound vs isolation (v1.2): explained once here because the tier
  // drives the two rest defaults; auto-classified until explicitly set.
  box.appendChild(el("div", "hint", t("tier.desc")));
  // Grouped by body part (v1.6.0): 46+ exercises in one flat list were not
  // scannable. Canonical part order, localized/sorted names within a group.
  const grouped = [];
  for (const part of PART_ORDER) {
    const inPart = state.exercises
      .filter((e) => (e.bodyPart || "full") === part)
      .sort((a, b) => exLabel(a).localeCompare(exLabel(b)));
    if (inPart.length > 0) grouped.push({ part, inPart });
  }
  for (const { part, inPart } of grouped) {
    const head = el("div", null, t(`bodypart.${part}`));
    head.style.fontWeight = "700";
    head.style.marginTop = "10px";
    box.appendChild(head);
    for (const ex of inPart) libraryRow(box, ex, state, ctx, render);
  }
  if (state.exercises.length === 0) box.appendChild(el("div", "empty", t("common.none")));

  libraryAddForm(box, state, ctx, render);
}

function libraryRow(box, ex, state, ctx, render) {
  {
    const line = flexBox();
    line.style.justifyContent = "space-between";
    const meta = `${t(`bodypart.${ex.bodyPart}`)}/${t(`equipment.${ex.equipment}`)}/${t(`today.weight.unit.${ex.unit}`)}`;
    const label = exLabel(ex) + (ex.emphasis ? ` · ${ex.emphasis}` : "");
    line.appendChild(el("div", null, `${label} · ${meta}`));

    const tierSelect = selectEl(
      ["compound", "isolation"].map((v) => ({ value: v, label: t(`tier.${v}`) })),
      rules.exerciseTier(ex),
    );
    tierSelect.style.flex = "0 1 110px";
    tierSelect.addEventListener("change", async () => {
      ex.tier = tierSelect.value;
      await put("exercises", ex);
      ctx.showToast(t("settings.saved"));
      render();
    });
    line.appendChild(tierSelect);

    // Emphasis (C2): inline edit on the existing exercise, kept separate
    // from the add-new-exercise form below.
    const emphasisInput = inputEl("text", ex.emphasis || "");
    emphasisInput.placeholder = t("settings.program.library.emphasis");
    emphasisInput.style.flex = "1 1 110px";
    emphasisInput.addEventListener("change", async () => {
      ex.emphasis = emphasisInput.value.trim();
      await put("exercises", ex);
      ctx.showToast(t("settings.saved"));
      render();
    });
    line.appendChild(emphasisInput);

    const remove = el("button", "link", t("common.delete"));
    remove.addEventListener("click", async () => {
      const usage = exerciseUsage(state, ex.id);
      const msg = t("settings.program.library.delete.usage", {
        p: usage.programs, s: usage.sessions, name: t("common.exercise.deleted"),
      });
      if (!confirm(msg)) return;
      await del("exercises", ex.id);
      state.exercises = await getAll("exercises");
      ctx.showToast(t("settings.saved"));
      render();
    });
    line.appendChild(remove);
    box.appendChild(line);

    // Collapsible form cue (v1.5.0), same tip the session card shows; only
    // rendered when the exercise resolves to one (js/tips.js).
    const tipText = tipFor(ex);
    if (tipText) {
      const tipBtn = el("button", "link", t("tip.show"));
      tipBtn.type = "button";
      tipBtn.setAttribute("aria-expanded", "false");
      const tipLine = el("div", "hint", tipText);
      tipLine.hidden = true;
      tipBtn.addEventListener("click", () => {
        tipLine.hidden = !tipLine.hidden;
        tipBtn.textContent = tipLine.hidden ? t("tip.show") : t("tip.hide");
        tipBtn.setAttribute("aria-expanded", String(!tipLine.hidden));
      });
      box.appendChild(tipBtn);
      box.appendChild(tipLine);
    }
  }
}

function libraryAddForm(box, state, ctx, render) {
  const name = inputEl("text", "");
  name.style.flex = "1 1 120px";
  const variant = inputEl("text", "");
  variant.style.flex = "1 1 90px";
  const emphasis = inputEl("text", "");
  emphasis.style.flex = "1 1 90px";
  emphasis.placeholder = t("settings.program.library.emphasis");
  const nameLine = flexBox();
  nameLine.append(name, variant, emphasis);
  box.appendChild(fieldEl(`${t("settings.program.library.name")} · ${t("settings.program.library.variant")} · ${t("settings.program.library.emphasis")}`, nameLine));

  const bodyPart = selectEl(BODY_PARTS.map((v) => ({ value: v, label: t(`bodypart.${v}`) })), "legs");
  const equipment = selectEl(EQUIPMENT.map((v) => ({ value: v, label: t(`equipment.${v}`) })), "dumbbell");
  const unit = selectEl(UNITS.map((v) => ({ value: v, label: t(`today.weight.unit.${v}`) })), "lb");
  const tier = selectEl(["compound", "isolation"].map((v) => ({ value: v, label: t(`tier.${v}`) })), "compound");
  for (const s of [bodyPart, equipment, unit, tier]) s.style.flex = "1 1 90px";
  const selectLine = flexBox();
  selectLine.append(bodyPart, equipment, unit, tier);
  box.appendChild(fieldEl(null, selectLine));

  const spinalWrap = el("label");
  spinalWrap.style.display = "flex";
  spinalWrap.style.alignItems = "center";
  spinalWrap.style.gap = "6px";
  spinalWrap.style.fontSize = "12px";
  const spinal = inputEl("checkbox", false);
  spinalWrap.append(spinal, el("span", null, t("settings.program.library.spinal")));
  box.appendChild(spinalWrap);

  const add = el("button", "btn-secondary", t("common.add"));
  add.addEventListener("click", async () => {
    const label = name.value.trim();
    if (label === "") return;
    await put("exercises", {
      id: newId("ex"),
      name: label,
      bodyPart: bodyPart.value,
      equipment: equipment.value,
      unit: unit.value,
      loadConvention: loadConventionFor(equipment.value),
      variant: variant.value.trim(),
      emphasis: emphasis.value.trim(),
      spinalLoad: spinal.checked,
      tier: tier.value,
    });
    state.exercises = await getAll("exercises");
    ctx.showToast(t("settings.saved"));
    render();
  });
  box.appendChild(add);
}

// ------------------------------------------------------------------- data

// Cloud backup (v1.3.0). The sync code is generated on this device, stretched
// into an AES-GCM key plus a storage slot id by js/crypto.js, and never
// leaves the device: only the slot id and the ciphertext reach the Worker.
// The code is kept in settings.cloudBackup, which exportPack deliberately
// does NOT include, so a shared pack can never carry someone's backup code.
const CLOUD_ENDPOINT = "https://training-tracker-api.ck-labs.workers.dev/backup";

function cloudErrKey(res) {
  return res && res.status === 429 ? "settings.data.cloud.err.rate" : "settings.data.cloud.err";
}

function dataCard(state, ctx) {
  const { card, list } = cardEl("settings.data.title");
  const open = { key: null };

  function render() {
    list.textContent = "";
    const addRow = (key, opts) => rowEl(list, open, key, { ...opts, rerender: render });

    const cloud = state.settings.cloudBackup;
    addRow("cloud", {
      title: t("settings.data.cloud"),
      desc: t("settings.data.cloud.desc"),
      right: cloud ? isoDate(new Date(cloud.lastAt)) : t("settings.data.cloud.never"),
      editor: (box) => cloudEditor(box, state, ctx, render),
    });

    addRow("restore", {
      title: t("settings.data.restore"),
      desc: t("settings.data.restore.desc"),
      editor: (box) => restoreEditor(box, state, ctx),
    });

    addRow("profiles", {
      title: t("settings.data.profiles.title"),
      desc: t("settings.data.profiles.desc", { n: state.guests.length }),
      editor: (box) => profilesEditor(box, state, ctx, render),
    });

    addRow("share", {
      title: t("settings.data.share"),
      desc: t("settings.data.share.desc"),
      editor: (box) => shareEditor(box, state, ctx),
    });

    addRow("file", {
      title: t("settings.data.file"),
      desc: t("settings.data.file.desc"),
      editor: (box) => fileEditor(box, state, ctx, render),
    });
  }

  render();
  return card;
}

function cloudEditor(box, state, ctx, render) {
  const cloud = state.settings.cloudBackup;

  if (!cloud) {
    // Nothing is uploaded until the user reads this and taps: the consent
    // line states what leaves the device and how long the server keeps it.
    box.appendChild(el("div", "hint", t("settings.data.cloud.consent")));
    const start = el("button", "btn-primary", t("settings.data.cloud.start"));
    start.type = "button";
    start.addEventListener("click", async () => {
      start.disabled = true;
      start.textContent = t("settings.data.cloud.working");
      try {
        const code = generateCode();
        const { slotId, blob } = await encryptPack(await exportPack(), code);
        const res = await fetch(CLOUD_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot: slotId, blob }),
        });
        if (res.ok) {
          state.settings.cloudBackup = { code, lastAt: new Date().toISOString() };
          await commitSettings(state, ctx, { silent: true });
          ctx.showToast(t("settings.data.cloud.ok"));
          // Rerender straight into the connected state so the code is on
          // screen for the user to write down.
          render();
          return;
        }
        ctx.showToast(t(cloudErrKey(res)));
      } catch {
        ctx.showToast(t("settings.data.cloud.err"));
      }
      start.textContent = t("settings.data.cloud.start");
      start.disabled = false;
    });
    box.appendChild(start);
    return;
  }

  box.appendChild(el("div", "hint", t("settings.data.cloud.last", {
    date: isoDate(new Date(cloud.lastAt)),
  })));

  const codeText = el("div", null, cloud.code);
  codeText.style.fontFamily = "monospace";
  codeText.style.fontSize = "20px";
  codeText.style.letterSpacing = "2px";
  box.appendChild(fieldEl(t("settings.data.cloud.code.label"), codeText));
  box.appendChild(el("div", "hint", t("settings.data.cloud.code.keep")));

  const actions = flexBox("8px");

  const copy = el("button", "btn-secondary", t("settings.data.cloud.copy"));
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(cloud.code);
      ctx.showToast(t("settings.data.cloud.copied"));
    } catch {
      // Clipboard API missing or blocked (insecure context, denied
      // permission): select the code so it can be copied by hand.
      const selection = window.getSelection ? window.getSelection() : null;
      if (selection && document.createRange) {
        const range = document.createRange();
        range.selectNodeContents(codeText);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        ctx.showToast(t("settings.data.cloud.err"));
      }
    }
  });
  actions.appendChild(copy);

  const now = el("button", "btn-primary", t("settings.data.cloud.now"));
  now.type = "button";
  now.addEventListener("click", async () => {
    now.disabled = true;
    now.textContent = t("settings.data.cloud.working");
    try {
      // Same code, same slot: a backup overwrites the previous one.
      const { slotId, blob } = await encryptPack(await exportPack(), cloud.code);
      const res = await fetch(CLOUD_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: slotId, blob }),
      });
      if (res.ok) {
        state.settings.cloudBackup = { code: cloud.code, lastAt: new Date().toISOString() };
        await commitSettings(state, ctx, { silent: true });
        ctx.showToast(t("settings.data.cloud.ok"));
        render();
        return;
      }
      ctx.showToast(t(cloudErrKey(res)));
    } catch {
      ctx.showToast(t("settings.data.cloud.err"));
    }
    now.textContent = t("settings.data.cloud.now");
    now.disabled = false;
  });
  actions.appendChild(now);

  const remove = el("button", "link", t("settings.data.cloud.delete"));
  remove.type = "button";
  remove.addEventListener("click", async () => {
    if (!confirm(t("settings.data.cloud.delete.confirm"))) return;
    remove.disabled = true;
    remove.textContent = t("settings.data.cloud.working");
    try {
      const { slotId } = await deriveFromCode(cloud.code);
      const res = await fetch(`${CLOUD_ENDPOINT}?slot=${slotId}`, { method: "DELETE" });
      if (res.ok) {
        // Only the server copy goes; this device keeps every record.
        delete state.settings.cloudBackup;
        await commitSettings(state, ctx, { silent: true });
        ctx.showToast(t("settings.data.cloud.deleted"));
        render();
        return;
      }
      ctx.showToast(t(cloudErrKey(res)));
    } catch {
      ctx.showToast(t("settings.data.cloud.err"));
    }
    remove.textContent = t("settings.data.cloud.delete");
    remove.disabled = false;
  });
  actions.appendChild(remove);

  box.appendChild(actions);
}

// Restore from another device: the typed code derives the slot, so a wrong
// code simply addresses a slot that does not exist (404) rather than
// fetching someone else's blob.
function restoreEditor(box, state, ctx) {
  const codeInput = inputEl("text", "", {
    placeholder: t("settings.data.restore.code.ph"),
    autocapitalize: "characters",
    autocomplete: "off",
    spellcheck: "false",
  });
  box.appendChild(fieldEl(t("settings.data.cloud.code.label"), codeInput));

  let mode = "merge";
  const seg = el("div", "seg");
  const buttons = [];
  for (const [value, key] of [
    ["replace", "settings.data.import.replace"],
    ["merge", "settings.data.import.merge"],
  ]) {
    const button = el("button", value === mode ? "sel" : null, t(key));
    button.type = "button";
    button.addEventListener("click", () => {
      mode = value;
      for (const b of buttons) b.el.classList.toggle("sel", b.value === mode);
    });
    buttons.push({ value, el: button });
    seg.appendChild(button);
  }
  box.appendChild(seg);

  const run = el("button", "btn-primary", t("settings.data.restore.run"));
  run.type = "button";
  run.addEventListener("click", async () => {
    const canonical = normalizeCode(codeInput.value);
    if (!canonical) {
      ctx.showToast(t("settings.data.restore.badcode"));
      return;
    }
    if (mode === "replace" && !confirm(t("settings.data.import.replace.confirm"))) return;
    run.disabled = true;
    run.textContent = t("settings.data.cloud.working");
    try {
      const { slotId } = await deriveFromCode(canonical);
      const res = await fetch(`${CLOUD_ENDPOINT}?slot=${slotId}`);
      if (res.status === 404) {
        ctx.showToast(t("settings.data.restore.notfound"));
      } else if (!res.ok) {
        ctx.showToast(t(cloudErrKey(res)));
      } else {
        const body = await res.json();
        let pack = null;
        try {
          pack = await decryptBlob(body.blob, canonical);
        } catch {
          // Tampered or unreadable blob: same message as a missing backup,
          // because from the user's side the code is what went wrong.
          ctx.showToast(t("settings.data.restore.notfound"));
        }
        if (pack) {
          const counts = await importPack(pack, mode);
          ctx.showToast(t("settings.data.import.ok", {
            e: counts.exercises, p: counts.programs, s: counts.sessions,
          }));
          // This device now shares the backup: adopt the code so the cloud
          // row can back up here too, without a second setup.
          state.settings.cloudBackup = { code: canonical, lastAt: body.updatedAt };
          await commitSettings(state, ctx, { silent: true });
          await ctx.remount();
          return;
        }
      }
    } catch {
      ctx.showToast(t("settings.data.cloud.err"));
    }
    run.textContent = t("settings.data.restore.run");
    run.disabled = false;
  });
  box.appendChild(run);
}

// File backup (advanced): export and import in one editor. The .ttpack
// extension is plain pack JSON under a name iOS will not try to preview,
// and the share sheet is the only way to get a file off iOS Safari.
function fileEditor(box, state, ctx, render) {
  const exportBtn = el("button", "btn-primary", t("settings.data.file.export"));
  exportBtn.type = "button";
  exportBtn.addEventListener("click", () => runFileExport(state, ctx, render));
  box.appendChild(exportBtn);

  const last = state.settings.lastBackupAt;
  if (last) {
    box.appendChild(el("div", "hint", t("settings.data.export.desc", {
      date: isoDate(new Date(last)),
    })));
  }

  importEditor(box, ctx);
}

function downloadPack(text, fileName) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = el("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Shared delivery for pack files: share sheet on touch-primary devices
// (iOS/Android, where a download is awkward or impossible), plain download
// elsewhere. Returns "delivered" | "aborted" | "error".
async function deliverPackFile(text, fileName) {
  const touchPrimary = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  if (touchPrimary && typeof navigator.canShare === "function" && typeof File === "function") {
    const file = new File([text], fileName, { type: "application/octet-stream" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return "delivered";
      } catch (err) {
        // Dismissing the share sheet is a choice, not a failure.
        if (err && err.name === "AbortError") return "aborted";
        // Any other share failure falls through to the download path below.
      }
    }
  }
  try {
    downloadPack(text, fileName);
    return "delivered";
  } catch {
    return "error";
  }
}

async function runFileExport(state, ctx, render) {
  const pack = await exportPack();
  const text = JSON.stringify(pack, null, 2);
  const outcome = await deliverPackFile(text, `training-tracker-${isoDate(new Date())}.ttpack`);
  if (outcome === "aborted") return;
  if (outcome === "error") {
    ctx.showToast(t("settings.data.file.share.err"));
    return;
  }
  state.settings.lastBackupAt = new Date().toISOString();
  await commitSettings(state, ctx);
  render();
}

// Session-only share (v1.12.0): exports ONLY the chosen session programs
// plus the exercise records their items reference. No sessions, bodyweight,
// or water records: two people can trade programs without trading personal
// history. targetLoad numbers ARE included (the sharer's working weights);
// the receiver's own progression rules take over from the first session.
function shareEditor(box, state, ctx) {
  const weightPrograms = rules.sortPrograms(state.programs.filter((p) => p.kind === "weights"));
  if (weightPrograms.length === 0) {
    box.appendChild(el("div", "empty", t("common.none")));
    return;
  }
  box.appendChild(el("div", "hint", t("settings.data.share.hint")));

  const checks = [];
  for (const program of weightPrograms) {
    const check = inputEl("checkbox", true);
    const label = el("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    label.append(check, el("span", null, programLabel(program.name)));
    box.appendChild(label);
    checks.push({ program, check });
  }

  const run = el("button", "btn-primary", t("settings.data.share.run"));
  run.type = "button";
  run.addEventListener("click", async () => {
    const programs = checks.filter((c) => c.check.checked).map((c) => c.program);
    if (programs.length === 0) return;
    const usedIds = new Set(programs.flatMap((p) => (p.items || []).map((i) => i.exerciseId)));
    const pack = {
      formatVersion: PACK_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      exercises: state.exercises.filter((e) => usedIds.has(e.id)),
      programs,
    };
    const outcome = await deliverPackFile(JSON.stringify(pack, null, 2), `training-tracker-sessions-${isoDate(new Date())}.ttpack`);
    if (outcome === "error") ctx.showToast(t("settings.data.file.share.err"));
  });
  box.appendChild(run);
}

// Strips a file's extension for the default guest name, e.g.
// "program-pack.json" -> "program-pack".
function baseName(fileName) {
  return fileName.replace(/\.[^./\\]+$/, "");
}

function importEditor(box, ctx) {
  const file = inputEl("file", null, { accept: ".ttpack,.json,application/json" });
  box.appendChild(fieldEl(t("settings.data.import"), file));

  // Guest mode (D1): a third option alongside 전체 교체/병합. The pack is
  // NEVER merged into my stores in this mode; it lands in a single kv guest
  // record instead (store.importGuestPack), read-only and switchable from
  // log/stats.
  let mode = "merge";
  const seg = el("div", "seg");
  const buttons = [];

  const nameControl = inputEl("text", "");
  const nameField = fieldEl(t("settings.data.import.guest.name"), nameControl);
  nameField.hidden = true;
  let nameTouched = false;
  nameControl.addEventListener("input", () => { nameTouched = true; });

  file.addEventListener("change", () => {
    if (nameTouched) return;
    const chosen = file.files && file.files[0];
    if (!chosen) return;
    nameControl.value = baseName(chosen.name);
  });

  for (const [value, key] of [
    ["replace", "settings.data.import.replace"],
    ["merge", "settings.data.import.merge"],
    ["guest", "settings.data.import.guest"],
  ]) {
    const button = el("button", value === mode ? "sel" : null, t(key));
    button.type = "button";
    button.addEventListener("click", () => {
      mode = value;
      for (const b of buttons) b.el.classList.toggle("sel", b.value === mode);
      nameField.hidden = mode !== "guest";
    });
    buttons.push({ value, el: button });
    seg.appendChild(button);
  }
  box.appendChild(seg);
  box.appendChild(nameField);

  const run = el("button", "btn-primary", t("common.confirm"));
  run.addEventListener("click", async () => {
    const chosen = file.files && file.files[0];
    if (!chosen) return;
    // Replace clears every store first, so it needs an explicit confirmation.
    if (mode === "replace" && !confirm(t("settings.data.import.replace.confirm"))) return;
    try {
      const parsed = JSON.parse(await readFileText(chosen));
      if (mode === "guest") {
        const name = nameControl.value.trim() || baseName(chosen.name);
        await importGuestPack(parsed, name);
        ctx.showToast(t("settings.data.import.guest.ok", { name }));
      } else {
        const counts = await importPack(parsed, mode);
        ctx.showToast(t("settings.data.import.ok", {
          e: counts.exercises, p: counts.programs, s: counts.sessions,
        }));
      }
      await ctx.remount();
    } catch {
      // Parse failure or a pack rejected by validatePack: nothing was written.
      ctx.showToast(t("settings.data.import.err"));
    }
  });
  box.appendChild(run);
}

// Profile list (D1): 내 기록 (my data, always present, read-write) plus each
// guest (read-only snapshot, deletable). Deleting a guest that is currently
// being viewed elsewhere is fine by design: log/stats re-fetch the guest
// list on their own next mount and fall back to 내 기록 when the id is gone.
function profilesEditor(box, state, ctx, render) {
  const mineLine = flexBox();
  mineLine.style.justifyContent = "space-between";
  mineLine.appendChild(el("div", null, t("settings.data.profiles.mine")));
  mineLine.appendChild(el("div", "hint", t("settings.data.profiles.counts", {
    e: state.exercises.length, p: state.programs.length, s: state.sessions.length, b: state.bodyweight.length,
  })));
  box.appendChild(mineLine);

  for (const g of state.guests) {
    const line = flexBox();
    line.style.justifyContent = "space-between";
    const left = el("div");
    left.appendChild(el("div", null, g.name));
    const meta = el("div", "hint", [
      t("settings.data.profiles.guest.imported", { date: isoDate(new Date(g.importedAt)) }),
      t("settings.data.profiles.counts", {
        e: g.counts.exercises, p: g.counts.programs, s: g.counts.sessions, b: g.counts.bodyweight,
      }),
    ].join(" · "));
    left.appendChild(meta);
    line.appendChild(left);

    const remove = el("button", "link", t("common.delete"));
    remove.addEventListener("click", async () => {
      if (!confirm(t("settings.data.profiles.delete.confirm", { name: g.name }))) return;
      await deleteGuest(g.id);
      state.guests = await getGuests();
      ctx.showToast(t("common.done"));
      render();
    });
    line.appendChild(remove);
    box.appendChild(line);
  }

  if (state.guests.length === 0) box.appendChild(el("div", "empty", t("common.none")));
}

// ---------------------------------------------------------------- display

function displayCard(state, ctx) {
  const { card, list } = cardEl("settings.display.title");
  const open = { key: null };

  function render() {
    list.textContent = "";
    const addRow = (key, opts) => rowEl(list, open, key, { ...opts, rerender: render });

    addRow("lang", {
      title: t("settings.display.lang"),
      right: t(`lang.${getLang()}`),
      editor: (box) => {
        const row = el("div", "filter-row");
        for (const code of availableLangs()) {
          const chip = el("button", code === getLang() ? "filter sel" : "filter", t(`lang.${code}`));
          chip.addEventListener("click", async () => {
            setLang(code);
            state.settings.language = code;
            await commitSettings(state, ctx);
            document.title = t("app.title");
            ctx.refreshTabLabels();
            await ctx.remount();
          });
          row.appendChild(chip);
        }
        box.appendChild(row);
      },
    });

    const seg = el("div", "seg");
    const buttons = [];
    for (const value of ["system", "light", "dark"]) {
      const button = el("button", value === state.settings.theme ? "sel" : null, t(`settings.theme.${value}`));
      button.addEventListener("click", async () => {
        state.settings.theme = value;
        await commitSettings(state, ctx);
        ctx.applyTheme(value);
        for (const b of buttons) b.el.classList.toggle("sel", b.value === value);
      });
      buttons.push({ value, el: button });
      seg.appendChild(button);
    }
    rowEl(list, open, "theme", {
      title: t("settings.display.theme"),
      right: seg,
      rerender: render,
    });

    // Display unit (A3): affects formatting only, never the stored value.
    // Every card on this screen shows formatted loads, so a full remount
    // keeps them in sync (matches the language row's own remount).
    const unitSeg = el("div", "seg");
    const unitLabels = { both: t("settings.display.unit.both"), kg: t("today.weight.unit.kg"), lb: t("today.weight.unit.lb") };
    for (const value of ["both", "kg", "lb"]) {
      const button = el("button", value === (state.settings.displayUnit || "both") ? "sel" : null, unitLabels[value]);
      button.addEventListener("click", async () => {
        state.settings.displayUnit = value;
        await commitSettings(state, ctx);
        await ctx.remount();
      });
      unitSeg.appendChild(button);
    }
    rowEl(list, open, "unit", {
      title: t("settings.display.unit"),
      right: unitSeg,
      rerender: render,
    });

    // Bodyweight unit (B4): independent of the load display unit above.
    // Governs bodyweight entry fields and the protein coefficient display.
    const bwSeg = el("div", "seg");
    for (const value of ["kg", "lb"]) {
      const button = el(
        "button",
        value === (state.settings.bodyweightUnit || "kg") ? "sel" : null,
        t(`today.weight.unit.${value}`),
      );
      button.addEventListener("click", async () => {
        state.settings.bodyweightUnit = value;
        await commitSettings(state, ctx);
        await ctx.remount();
      });
      bwSeg.appendChild(button);
    }
    rowEl(list, open, "bwunit", {
      title: t("settings.display.bwunit"),
      desc: t("settings.display.bwunit.desc"),
      right: bwSeg,
      rerender: render,
    });

    // Default expanded Today card (v1.7): every Today card collapses to the
    // same shell; this picks the one that starts open (or none). The weights
    // card moved to its own always-expanded Session tab in v1.9.0, so a
    // stored "weights" value now reads as "none".
    const cardOptions = [
      { value: "cardio", label: t("today.cardio.title") },
      { value: "calisthenics", label: t("today.cal.title") },
      { value: "water", label: t("today.water.title") },
      { value: "bodyweight", label: t("today.bw.title") },
      { value: "none", label: t("common.none") },
    ];
    const storedCard = state.settings.todayDefaultOpen;
    const cardSelect = selectEl(cardOptions, cardOptions.some((o) => o.value === storedCard) ? storedCard : "none");
    cardSelect.addEventListener("change", async () => {
      state.settings.todayDefaultOpen = cardSelect.value;
      await commitSettings(state, ctx, { silent: true });
    });
    rowEl(list, open, "defaultcard", {
      title: t("settings.display.defaultcard"),
      desc: t("settings.display.defaultcard.desc"),
      right: cardSelect,
      rerender: render,
    });
  }

  render();
  return card;
}

// ----------------------------------------------------------- notifications

// Rest-end push (v1.4). Three mutually exclusive states: the platform cannot
// do Web Push at all (iOS Safari tabs included, hence the install hint), the
// user has blocked notifications at the system level, or the feature is a
// plain on/off toggle. restPushEnabled is written only after the browser
// actually granted permission and a subscription exists, so an off toggle
// guarantees the rest bar behaves exactly as it did before this feature.
function notifyCard(state, ctx) {
  const { card, list } = cardEl("settings.notify.title");
  const open = { key: null };

  function render() {
    list.textContent = "";
    const permission = permissionState();
    const supported = pushSupported();
    const enabled = supported && permission === "granted" && state.settings.restPushEnabled === true;

    let desc = t("settings.notify.rest.desc");
    if (!supported) desc = t("settings.notify.unsupported");
    else if (permission === "denied") desc = t("settings.notify.denied");

    // The permission prompt has to be requested from inside this handler:
    // iOS shows it only while the click's user gesture is still active, so
    // enableRestPush() runs before anything is awaited.
    const toggle = el("button", `chip-toggle${enabled ? " on" : ""}`, t(enabled ? "common.on" : "common.off"));
    toggle.type = "button";
    toggle.setAttribute("aria-pressed", String(enabled));
    toggle.disabled = !supported || permission === "denied";
    toggle.addEventListener("click", async () => {
      if (enabled) {
        state.settings.restPushEnabled = false;
        await commitSettings(state, ctx, { silent: true });
        render();
        disableRestPush();
        return;
      }
      const status = await enableRestPush();
      if (status === "granted") {
        state.settings.restPushEnabled = true;
        await commitSettings(state, ctx, { silent: true });
      }
      render();
    });

    rowEl(list, open, "rest", {
      title: t("settings.notify.rest"),
      desc,
      right: toggle,
      rerender: render,
    });

    // iOS grants Web Push to home-screen installs only, so a Safari tab gets
    // the one instruction that actually unblocks the feature.
    if (!supported && iosNeedsInstall()) {
      const hint = el("div", "hint", t("settings.notify.ios.hint"));
      hint.style.padding = "8px 2px 12px";
      list.appendChild(hint);
    }
  }

  render();
  return card;
}

// -------------------------------------------------------------- nutrition

// Protein coefficient and water guide (B2/B3). The coefficient is stored in
// g per kg; the row's right side follows the bodyweight unit for display.
function nutritionCard(state, ctx) {
  const { card, list } = cardEl("settings.nutrition.title");
  const open = { key: null };

  function render() {
    list.textContent = "";
    const addRow = (key, opts) => rowEl(list, open, key, { ...opts, rerender: render });
    const s = state.settings;

    addRow("protein", {
      title: t("settings.nutrition.protein"),
      desc: t("settings.nutrition.protein.desc"),
      right: rules.proteinCoefDisplay(s.proteinCoef ?? 1.6, s.bodyweightUnit || "kg"),
      editor: (box) => {
        const control = inputEl("number", s.proteinCoef ?? 1.6, { step: 0.1, min: 0.8, max: 3, inputmode: "decimal" });
        box.appendChild(fieldEl(t("settings.nutrition.protein.field"), control));
        box.appendChild(el("div", "hint", t("settings.nutrition.protein.hint")));
        const save = el("button", "btn-primary", t("common.save"));
        save.addEventListener("click", async () => {
          const v = numValue(control, NaN);
          if (!Number.isFinite(v) || v < 0.8 || v > 3) return;
          s.proteinCoef = Math.round(v * 100) / 100;
          await commitSettings(state, ctx);
          render();
        });
        box.appendChild(save);
      },
    });

    addRow("water", {
      title: t("settings.nutrition.water"),
      desc: t("settings.nutrition.water.desc"),
      right: `${s.waterTargetMl ?? 2000} ml`,
      editor: (box) => {
        const control = inputEl("number", s.waterTargetMl ?? 2000, { step: 50, min: 500, max: 6000, inputmode: "numeric" });
        box.appendChild(fieldEl(t("settings.nutrition.water.field"), control));
        const save = el("button", "btn-primary", t("common.save"));
        save.addEventListener("click", async () => {
          const v = numValue(control, NaN);
          if (!Number.isFinite(v) || v < 500 || v > 6000) return;
          s.waterTargetMl = Math.round(v);
          await commitSettings(state, ctx);
          render();
        });
        box.appendChild(save);
      },
    });

    addRow("cup", {
      title: t("settings.nutrition.cup"),
      desc: t("settings.nutrition.cup.desc"),
      right: `${s.cupMl ?? 250} ml`,
      editor: (box) => {
        const control = inputEl("number", s.cupMl ?? 250, { step: 10, min: 50, max: 1000, inputmode: "numeric" });
        box.appendChild(fieldEl(t("settings.nutrition.cup.field"), control));
        const save = el("button", "btn-primary", t("common.save"));
        save.addEventListener("click", async () => {
          const v = numValue(control, NaN);
          if (!Number.isFinite(v) || v < 50 || v > 1000) return;
          s.cupMl = Math.round(v);
          await commitSettings(state, ctx);
          render();
        });
        box.appendChild(save);
      },
    });
  }

  render();
  return card;
}

// -------------------------------------------------------------- feedback

// Bug reports and suggestions (v1.3.0). No login: the message is POSTed to a
// Cloudflare Worker that files it for the developer. The message text is the
// user's own input and never touches innerHTML; only the three fields plus a
// small meta block (version / language / user agent / screen) are sent, and
// the hint under the form says so before anything leaves the device.
const FEEDBACK_ENDPOINT = "https://training-tracker-api.ck-labs.workers.dev/feedback";

function feedbackCard(state, ctx) {
  const { card, list } = cardEl("settings.feedback.title");
  const open = { key: null };

  function render() {
    list.textContent = "";
    const addRow = (key, opts) => rowEl(list, open, key, { ...opts, rerender: render });

    addRow("send", {
      title: t("settings.feedback.send"),
      desc: t("settings.feedback.send.desc"),
      editor: (box) => feedbackEditor(box, ctx, open, render),
    });
  }

  render();
  return card;
}

function feedbackEditor(box, ctx, open, render) {
  let type = "suggestion";
  const seg = el("div", "seg");
  const buttons = [];
  for (const [value, key] of [
    ["bug", "settings.feedback.type.bug"],
    ["suggestion", "settings.feedback.type.suggestion"],
    ["other", "settings.feedback.type.other"],
  ]) {
    const button = el("button", value === type ? "sel" : null, t(key));
    button.type = "button";
    button.addEventListener("click", () => {
      type = value;
      for (const b of buttons) b.el.classList.toggle("sel", b.value === type);
    });
    buttons.push({ value, el: button });
    seg.appendChild(button);
  }
  box.appendChild(fieldEl(t("settings.feedback.type"), seg));

  // Same growing textarea idiom as the session note on the today screen.
  const message = document.createElement("textarea");
  message.rows = 4;
  message.placeholder = t("settings.feedback.message.ph");
  message.addEventListener("input", () => {
    message.style.height = "auto";
    message.style.height = `${message.scrollHeight + 2}px`;
    send.disabled = message.value.trim() === "";
  });
  box.appendChild(fieldEl(t("settings.feedback.message"), message));

  const contact = inputEl("text", "", { placeholder: t("settings.feedback.contact.ph") });
  box.appendChild(fieldEl(t("settings.feedback.contact"), contact));

  box.appendChild(el("div", "hint", t("settings.feedback.privacy.hint")));

  const send = el("button", "btn-primary", t("settings.feedback.submit"));
  send.type = "button";
  send.disabled = true;
  send.addEventListener("click", async () => {
    const text = message.value.trim();
    if (text === "") return;
    send.disabled = true;
    send.textContent = t("settings.feedback.sending");
    try {
      const res = await fetch(FEEDBACK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: text,
          contact: contact.value.trim(),
          meta: {
            version: APP_VERSION,
            lang: getLang(),
            ua: navigator.userAgent.slice(0, 300),
            screen: "settings",
          },
        }),
      });
      if (res.ok) {
        ctx.showToast(t("settings.feedback.ok"));
        message.value = "";
        contact.value = "";
        type = "suggestion";
        open.key = null;
        render();
        return;
      }
      // Anything non-2xx keeps the typed text so nothing the user wrote is lost.
      ctx.showToast(t(res.status === 429 ? "settings.feedback.err.rate" : "settings.feedback.err"));
    } catch {
      // Offline or a blocked request: same rule, the text stays put.
      ctx.showToast(t("settings.feedback.err"));
    }
    send.textContent = t("settings.feedback.submit");
    send.disabled = message.value.trim() === "";
  });
  box.appendChild(send);
}
