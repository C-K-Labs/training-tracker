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
import {
  getSettings, saveSettings, getAll, put, del, newId, exportPack, importPack,
} from "../store.js";
import * as rules from "../rules.js";

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
  return ex.variant ? `${ex.name} (${ex.variant})` : ex.name;
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

async function commitSettings(state, ctx) {
  await saveSettings(state.settings);
  ctx.showToast(t("settings.saved"));
}

// ------------------------------------------------------------------ mount

export async function mount(root, ctx) {
  const [settings, exercises, programs] = await Promise.all([
    getSettings(), getAll("exercises"), getAll("programs"),
  ]);
  const state = { settings, exercises, programs };

  root.appendChild(inventoryCard(state, ctx));
  root.appendChild(programCard(state, ctx));
  root.appendChild(nutritionCard(state, ctx));
  root.appendChild(dataCard(state, ctx));
  root.appendChild(displayCard(state, ctx));
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
    line.appendChild(el("div", null, `${ex ? exLabel(ex) : exerciseId} · ${value}`));
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

  const picker = selectEl(state.exercises.map((e) => ({ value: e.id, label: exLabel(e) })));
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
      right: mmss(state.settings.restDefaultSec ?? 90),
      editor: (box) => restEditor(box, state, ctx, render),
    });
  }

  render();
  return card;
}

// Rest timer defaults (A2): global default in seconds plus per-exercise
// overrides (settings.restOverrides, exerciseId -> seconds). Consumed by
// js/rules.js restSecondsFor, which prefers the override when present.
function restEditor(box, state, ctx, render) {
  const defaultSec = state.settings.restDefaultSec ?? 90;
  const def = numberField(t("settings.rest.seconds"), defaultSec, { min: 10, step: 5 }, "1 1 140px");
  box.appendChild(def.field);
  box.appendChild(el("div", "hint", mmss(defaultSec)));
  const save = el("button", "btn-primary", t("common.save"));
  save.addEventListener("click", async () => {
    const v = numValue(def.control, NaN);
    if (!Number.isFinite(v) || v < 10) return;
    state.settings.restDefaultSec = v;
    await commitSettings(state, ctx);
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
    line.appendChild(el("div", null, `${ex ? exLabel(ex) : exerciseId} · ${mmss(secs)}`));
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

  const picker = selectEl(state.exercises.map((e) => ({ value: e.id, label: exLabel(e) })));
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

async function saveProgram(program, ctx, rerender) {
  await put("programs", program);
  ctx.showToast(t("settings.saved"));
  if (rerender) rerender();
}

function sessionsEditor(box, state, ctx, render) {
  const weightPrograms = state.programs.filter((p) => p.kind === "weights");
  for (const program of weightPrograms) {
    box.appendChild(programBlock(program, state, ctx, render));
  }
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

function programBlock(program, state, ctx, render) {
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
  block.appendChild(fieldEl(t("settings.program.name"), name));

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

// Target-load field (A3): edits in the active display unit when it differs
// from the exercise's storedUnit ("both" mode always edits in storedUnit,
// per rules.parseLoadInput's contract), with a formatLoad hint underneath
// showing the stored value (and its conversion) regardless of edit mode.
function targetLoadField(item, exercise, settings) {
  const storedUnit = exercise?.unit === "kg" ? "kg" : "lb";
  const displayUnit = settings.displayUnit || "both";
  const editValue = displayUnit === "both" || displayUnit === storedUnit
    ? item.targetLoad
    : (storedUnit === "kg" ? rules.kgToLb(item.targetLoad) : rules.lbToKg(item.targetLoad));
  const { field, control } = numberField(t("settings.program.item.load"), editValue, { min: 0, step: 0.5 });
  const hint = el("div", "hint", rules.formatLoad(item.targetLoad, storedUnit, displayUnit));
  field.appendChild(hint);
  return { field, control, hint, storedUnit, displayUnit };
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
      await saveProgram(program, ctx, render);
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
      name: partnerEx ? exLabel(partnerEx) : (partner ? partner.exerciseId : ""),
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

  const picker = selectEl(state.exercises.map((e) => ({ value: e.id, label: exLabel(e) })), item.exerciseId);
  picker.addEventListener("change", async () => {
    item.exerciseId = picker.value;
    // Full rerender: the load field's unit basis depends on the exercise.
    await saveProgram(program, ctx, render);
  });
  wrap.appendChild(fieldEl(null, picker));

  wrap.appendChild(methodField(program, index, state, ctx, render));

  const nums = flexBox();
  const sets = numberField(t("common.sets"), item.sets, { min: 1, step: 1 });
  const reps = numberField(t("common.reps"), item.reps === "max" ? "" : item.reps, { min: 1, step: 1 });
  const load = targetLoadField(item, exercise, state.settings);
  const warmup = numberField(t("common.warmup"), item.warmupSets, { min: 0, step: 1 });
  reps.control.disabled = item.reps === "max";
  nums.append(sets.field, reps.field, load.field, warmup.field);
  wrap.appendChild(nums);

  sets.control.addEventListener("change", async () => {
    item.sets = numValue(sets.control, item.sets);
    await saveProgram(program, ctx);
  });
  reps.control.addEventListener("change", async () => {
    item.reps = numValue(reps.control, 8);
    await saveProgram(program, ctx);
  });
  load.control.addEventListener("change", async () => {
    item.targetLoad = rules.parseLoadInput(load.control.value, load.storedUnit, load.displayUnit);
    load.hint.textContent = rules.formatLoad(item.targetLoad, load.storedUnit, load.displayUnit);
    await saveProgram(program, ctx);
  });
  warmup.control.addEventListener("change", async () => {
    item.warmupSets = numValue(warmup.control, item.warmupSets);
    await saveProgram(program, ctx);
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
    await saveProgram(program, ctx);
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

function libraryEditor(box, state, ctx, render) {
  for (const ex of state.exercises) {
    const line = flexBox();
    line.style.justifyContent = "space-between";
    const meta = `${t(`bodypart.${ex.bodyPart}`)}/${t(`equipment.${ex.equipment}`)}/${t(`today.weight.unit.${ex.unit}`)}`;
    const label = exLabel(ex) + (ex.emphasis ? ` · ${ex.emphasis}` : "");
    line.appendChild(el("div", null, `${label} · ${meta}`));

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
      if (!confirm(t("common.delete.confirm", { name: exLabel(ex) }))) return;
      await del("exercises", ex.id);
      state.exercises = await getAll("exercises");
      ctx.showToast(t("settings.saved"));
      render();
    });
    line.appendChild(remove);
    box.appendChild(line);
  }
  if (state.exercises.length === 0) box.appendChild(el("div", "empty", t("common.none")));

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
  for (const s of [bodyPart, equipment, unit]) s.style.flex = "1 1 90px";
  const selectLine = flexBox();
  selectLine.append(bodyPart, equipment, unit);
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
    });
    state.exercises = await getAll("exercises");
    ctx.showToast(t("settings.saved"));
    render();
  });
  box.appendChild(add);
}

// ------------------------------------------------------------------- data

function dataCard(state, ctx) {
  const { card, list } = cardEl("settings.data.title");
  const open = { key: null };

  function render() {
    list.textContent = "";
    const addRow = (key, opts) => rowEl(list, open, key, { ...opts, rerender: render });

    addRow("import", {
      title: t("settings.data.import"),
      desc: t("settings.data.import.desc"),
      editor: (box) => importEditor(box, ctx),
    });

    const last = state.settings.lastBackupAt;
    rowEl(list, open, "export", {
      title: t("settings.data.export"),
      desc: last
        ? t("settings.data.export.desc", { date: isoDate(new Date(last)) })
        : t("settings.data.export.never"),
      rerender: render,
      onTap: async () => {
        const pack = await exportPack();
        const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = el("a");
        a.href = url;
        a.download = `training-export-${isoDate(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Revoking synchronously can cancel the download in some browsers.
        setTimeout(() => URL.revokeObjectURL(url), 0);
        state.settings.lastBackupAt = new Date().toISOString();
        await commitSettings(state, ctx);
        render();
      },
    });
  }

  render();
  return card;
}

function importEditor(box, ctx) {
  const file = inputEl("file", null, { accept: "application/json,.json" });
  box.appendChild(fieldEl(t("settings.data.import"), file));

  let mode = "merge";
  const seg = el("div", "seg");
  const buttons = [];
  for (const [value, key] of [["replace", "settings.data.import.replace"], ["merge", "settings.data.import.merge"]]) {
    const button = el("button", value === mode ? "sel" : null, t(key));
    button.addEventListener("click", () => {
      mode = value;
      for (const b of buttons) b.el.classList.toggle("sel", b.value === mode);
    });
    buttons.push({ value, el: button });
    seg.appendChild(button);
  }
  box.appendChild(seg);

  const run = el("button", "btn-primary", t("common.confirm"));
  run.addEventListener("click", async () => {
    const chosen = file.files && file.files[0];
    if (!chosen) return;
    // Replace clears every store first, so it needs an explicit confirmation.
    if (mode === "replace" && !confirm(t("settings.data.import.replace.confirm"))) return;
    try {
      const parsed = JSON.parse(await readFileText(chosen));
      const counts = await importPack(parsed, mode);
      ctx.showToast(t("settings.data.import.ok", {
        e: counts.exercises, p: counts.programs, s: counts.sessions,
      }));
      await ctx.remount();
    } catch {
      // Parse failure or a pack rejected by validatePack: nothing was written.
      ctx.showToast(t("settings.data.import.err"));
    }
  });
  box.appendChild(run);
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
      desc: t("settings.display.lang.desc"),
      right: t(`lang.${getLang()}`),
      editor: (box) => {
        const row = el("div", "filter-row");
        for (const code of availableLangs()) {
          const chip = el("button", code === getLang() ? "filter sel" : "filter", t(`lang.${code}`));
          chip.addEventListener("click", async () => {
            setLang(code);
            state.settings.language = code;
            await commitSettings(state, ctx);
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
