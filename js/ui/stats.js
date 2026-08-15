// Stats screen: body-weight / week tiles, per-exercise load trend chart,
// and the weekly volume balance bars.
//
// Exercise names are user data (imported packs), so every label is written
// with textContent; nothing user-supplied is ever interpolated into HTML.

import { t } from "../i18n.js";
import { getAll, getSettings, getGuests, getGuestData } from "../store.js";
import { exName } from "../names.js";
import {
  weekKey, weeklyBalance, emphasisBreakdown, overshootWarning, workingSets,
  kgToLb, proteinTargetG, proteinCoefDisplay, leanMassKg, weeklyCardioMinutes,
  orderTrendExercises,
  sortPrograms,
} from "../rules.js";

export const titleKey = "tab.stats";
export const subKey = "screen.stats.sub";

const SVG_NS = "http://www.w3.org/2000/svg";

// Chart geometry (viewBox 0 0 320 168).
const VIEW_W = 320;
const VIEW_H = 168;
const PLOT_X0 = 34;
const PLOT_X1 = 308;
const PLOT_Y0 = 10;
const PLOT_Y1 = 136;
const AREA_BASE = 140;
const XLABEL_Y = 158;

const STANDARD_PARTS = ["legs", "back", "chest", "shoulders"];
const BAND_LO = 10;
const BAND_HI = 20;
const BAND_AXIS_MIN = 24;
const MAX_TREND_EXERCISES = 8;

// WHO moderate-intensity cardio guidance (B6): 150-300 min/week.
const WHO_CARDIO_LO = 150;
const WHO_CARDIO_HI = 300;
const WHO_AXIS_MIN = 350;

// Lean-mass-preserving analysis sentence (B5): treat sub-0.3kg drift as noise.
const LEAN_STABLE_KG = 0.3;

// ----------------------------------------------------------------- helpers

// Local calendar date, not UTC: "today" must follow the user's clock.
function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtMD(iso) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function fmtNum(v) {
  return String(Math.round(v * 100) / 100);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, String(v));
  return node;
}

// v1.1.1 polish item 9: orderTrendExercises resolves an orphaned exerciseId
// to a { id, deleted: true } placeholder (no name/variant/unit); this is the
// one place responsible for turning that into a rendered label.
function exerciseLabel(ex) {
  if (ex.deleted) return t("common.exercise.deleted");
  const base = exName(ex);
  return ex.variant ? `${base} ${ex.variant}` : base;
}

function bodyPartLabel(part) {
  const key = `bodypart.${part}`;
  const label = t(key);
  return label === key ? part : label;
}

// Round axis bounds: three gridlines at lo, lo+step, lo+2*step, all multiples
// of a "nice" step, with padding so the line never reaches the plot edges.
function niceBounds(min, max) {
  const pad = max > min ? (max - min) * 0.15 : Math.max(Math.abs(max) * 0.1, 1);
  const rawLo = min - pad;
  const rawHi = max + pad;
  const half = (rawHi - rawLo) / 2;
  const mags = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5];
  const startExp = Math.floor(Math.log10(half)) - 1;
  for (let e = startExp; e <= startExp + 8; e++) {
    for (const m of mags) {
      const step = m * Math.pow(10, e);
      const lo = Math.floor(rawLo / step) * step;
      const hi = lo + 2 * step;
      if (hi >= rawHi - 1e-9) return { lo, hi, step };
    }
  }
  return { lo: rawLo, hi: rawHi, step: half };
}

// ------------------------------------------------------------------- tiles

function bwUnit(settings) {
  return settings.bodyweightUnit === "lb" ? "lb" : "kg";
}

function latestBy(list, dateOf = (x) => x.date) {
  return list.reduce((best, item) => (!best || dateOf(item) > dateOf(best) ? item : best), null);
}

// Converts a stored kg value to the display unit, rounded to 0.1.
function toUnit(kg, unit) {
  return unit === "lb" ? kgToLb(kg) : Math.round(kg * 10) / 10;
}

function bodyweightTile(bodyweight, settings) {
  const card = el("div", "card tile");
  card.appendChild(el("h2", null, t("stats.weight.title")));

  const unit = bwUnit(settings);
  const latest = latestBy(bodyweight);
  const big = el("div", "big");
  const cap = el("div", "cap");

  if (!latest) {
    big.textContent = "-";
    cap.textContent = t("common.none");
  } else {
    big.appendChild(document.createTextNode(`${fmtNum(toUnit(latest.kg, unit))} `));
    big.appendChild(el("small", null, t(`today.weight.unit.${unit}`)));
    const date = fmtMD(latest.date);
    cap.textContent = latest.fasted
      ? t("stats.weight.cap", { date })
      : t("stats.weight.cap.notfasted", { date });
  }

  card.appendChild(big);
  card.appendChild(cap);

  const protein = el("div", "cap");
  protein.textContent = latest
    ? t("stats.weight.protein", {
        g: proteinTargetG(latest.kg, settings.proteinCoef),
        coef: proteinCoefDisplay(settings.proteinCoef, unit),
      })
    : t("stats.weight.protein.none");
  card.appendChild(protein);
  return card;
}

function bodyFatTile(bodyweight) {
  const card = el("div", "card tile");
  card.appendChild(el("h2", null, t("stats.fat.title")));

  const latest = latestBy(bodyweight.filter((b) => b.bodyFatPct != null));
  const big = el("div", "big");
  const cap = el("div", "cap");

  if (!latest) {
    big.textContent = "-";
    cap.textContent = t("common.none");
  } else {
    big.appendChild(document.createTextNode(`${fmtNum(latest.bodyFatPct)} `));
    big.appendChild(el("small", null, "%"));
    cap.textContent = fmtMD(latest.date);
  }

  card.append(big, cap);
  return card;
}

function muscleTile(bodyweight, settings) {
  const card = el("div", "card tile");
  card.appendChild(el("h2", null, t("stats.muscle.title")));

  const unit = bwUnit(settings);
  const latest = latestBy(bodyweight.filter((b) => b.muscleMassKg != null));
  const big = el("div", "big");
  const cap = el("div", "cap");

  if (!latest) {
    big.textContent = "-";
    cap.textContent = t("common.none");
  } else {
    big.appendChild(document.createTextNode(`${fmtNum(toUnit(latest.muscleMassKg, unit))} `));
    big.appendChild(el("small", null, t(`today.weight.unit.${unit}`)));
    cap.textContent = fmtMD(latest.date);
  }

  card.append(big, cap);
  return card;
}

function weekTile(sessions) {
  const card = el("div", "card tile");
  card.appendChild(el("h2", null, t("stats.week.title")));

  const thisWeek = weekKey(todayISO());
  const n = sessions.filter((s) => s.kind === "weights" && weekKey(s.date) === thisWeek).length;

  card.appendChild(el("div", "big", String(n)));
  card.appendChild(el("div", "cap", t("stats.week.cap")));
  return card;
}

// ------------------------------------------------------------------- trend

// Exercises with at least one weights-session entry (v1.1.1 polish item 3):
// exercises in the CURRENT weights programs first (program list order,
// programs in store order, deduped), then all remaining logged exercises by
// recency. Orphaned exerciseIds resolve to a { id, deleted: true }
// placeholder via rules.orderTrendExercises; exerciseLabel renders it.
function trendExercises(sessions, exercisesById, programs) {
  const weightPrograms = sortPrograms((programs || []).filter((p) => p.kind === "weights"));
  return orderTrendExercises(weightPrograms, sessions, exercisesById).slice(0, MAX_TREND_EXERCISES);
}

// Top working load per session for one exercise, oldest first.
function loadHistory(sessions, exerciseId) {
  const history = [];
  for (const session of sessions) {
    if (session.kind !== "weights") continue;
    let best = null;
    for (const entry of session.entries || []) {
      if (entry.exerciseId !== exerciseId) continue;
      for (const set of workingSets(entry.sets)) {
        if (set.reps > 0 && (best == null || set.weight > best)) best = set.weight;
      }
    }
    if (best != null) history.push({ date: session.date, load: best });
  }
  return history.sort((a, b) => a.date.localeCompare(b.date));
}

// At most two evenly spaced middle indices, plus first and last.
function xLabelIndexes(n) {
  const idx = [0];
  const middles = Math.min(2, Math.max(0, n - 2));
  for (let k = 1; k <= middles; k++) {
    const i = Math.round((k * (n - 1)) / (middles + 1));
    if (i > 0 && i < n - 1 && !idx.includes(i)) idx.push(i);
  }
  idx.push(n - 1);
  return idx;
}

function buildChart(history, unit) {
  const svg = svgEl("svg", {
    class: "chart-svg",
    viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
    role: "img",
    preserveAspectRatio: "xMidYMid meet",
  });

  const loads = history.map((h) => h.load);
  const { lo, hi, step } = niceBounds(Math.min(...loads), Math.max(...loads));
  const spanY = hi - lo || 1;
  const yOf = (load) => PLOT_Y1 - ((load - lo) / spanY) * (PLOT_Y1 - PLOT_Y0);
  const xOf = (i) => PLOT_X0 + (i * (PLOT_X1 - PLOT_X0)) / (history.length - 1);
  const r1 = (v) => Math.round(v * 10) / 10;

  for (let g = 0; g < 3; g++) {
    const value = lo + step * g;
    const y = r1(yOf(value));
    svg.appendChild(svgEl("line", { class: "grid-line", x1: PLOT_X0, y1: y, x2: PLOT_X1, y2: y }));
    const label = svgEl("text", { class: "axis-text", x: PLOT_X0 - 4, y: y + 3, "text-anchor": "end" });
    label.textContent = fmtNum(value);
    svg.appendChild(label);
  }

  const points = history.map((h, i) => ({ ...h, x: r1(xOf(i)), y: r1(yOf(h.load)) }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];

  svg.appendChild(svgEl("path", {
    d: `${line} L${last.x} ${AREA_BASE} L${first.x} ${AREA_BASE} Z`,
    fill: "var(--chart-main)",
    "fill-opacity": "0.12",
    stroke: "none",
  }));
  svg.appendChild(svgEl("path", {
    d: line,
    fill: "none",
    stroke: "var(--chart-main)",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  }));

  for (const p of points) {
    const isLast = p === last;
    const dot = svgEl("circle", {
      cx: p.x,
      cy: p.y,
      r: isLast ? 5 : 3.5,
      fill: "var(--chart-main)",
    });
    if (isLast) {
      dot.setAttribute("stroke", "var(--surface)");
      dot.setAttribute("stroke-width", "2");
    }
    const title = svgEl("title", {});
    title.textContent = `${fmtMD(p.date)} · ${fmtNum(p.load)} ${unit}`;
    dot.appendChild(title);
    svg.appendChild(dot);
  }

  const endLabel = svgEl("text", {
    class: "axis-text",
    x: last.x,
    y: Math.max(11, last.y - 11),
    "text-anchor": "end",
    fill: "var(--chart-main)",
    "font-size": "11",
    "font-weight": "700",
  });
  endLabel.textContent = `${fmtNum(last.load)} ${unit}`;
  svg.appendChild(endLabel);

  for (const i of xLabelIndexes(points.length)) {
    const anchor = i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
    const label = svgEl("text", { class: "axis-text", x: points[i].x, y: XLABEL_Y, "text-anchor": anchor });
    label.textContent = fmtMD(points[i].date);
    svg.appendChild(label);
  }

  return svg;
}

function renderTrendBody(host, sessions, exercise) {
  host.textContent = "";
  const history = loadHistory(sessions, exercise.id);
  if (history.length < 2) {
    host.appendChild(el("div", "empty", t("stats.trend.empty")));
    return;
  }

  const wrap = el("div", "chart-wrap");
  // A deleted-exercise placeholder (item 9) carries no unit; default to lb
  // the same way the rest of the app treats an unrecognized/missing unit.
  wrap.appendChild(buildChart(history, exercise.unit === "kg" ? "kg" : "lb"));
  host.appendChild(wrap);

  const warn = overshootWarning(history);
  if (warn) {
    host.appendChild(el("div", "hint", t("stats.overshoot", {
      name: exerciseLabel(exercise),
      pct: warn.pct,
    })));
  }
}

function trendCard(sessions, exercisesById, programs) {
  const card = el("div", "card");
  card.appendChild(el("h2", null, t("stats.trend.title")));

  const list = trendExercises(sessions, exercisesById, programs);
  if (list.length === 0) {
    card.appendChild(el("div", "empty", t("stats.trend.none")));
    return card;
  }

  // Body-part-grouped picker (v1.8.0): the old flat chip row put every
  // logged exercise on one long scrolling line, unreadable past a handful.
  // Same optgroup treatment as the calisthenics picker; within each group
  // the program-order/recency ordering of trendExercises is preserved, and
  // deleted-exercise placeholders gather in a trailing group.
  const body = el("div");
  const byId = Object.fromEntries(list.map((e) => [String(e.id), e]));
  const select = document.createElement("select");
  const PART_ORDER = ["legs", "back", "chest", "shoulders", "arms", "core", "full"];
  const groups = new Map();
  for (const exercise of list) {
    const part = exercise.deleted ? "deleted" : (exercise.bodyPart || "full");
    if (!groups.has(part)) groups.set(part, []);
    groups.get(part).push(exercise);
  }
  for (const part of [...PART_ORDER, "deleted"]) {
    const inPart = groups.get(part);
    if (!inPart || inPart.length === 0) continue;
    const group = document.createElement("optgroup");
    group.label = part === "deleted" ? t("common.exercise.deleted") : t(`bodypart.${part}`);
    for (const exercise of inPart) {
      const option = document.createElement("option");
      option.value = String(exercise.id);
      option.textContent = exerciseLabel(exercise);
      if (exercise === list[0]) option.selected = true;
      group.appendChild(option);
    }
    select.appendChild(group);
  }
  select.addEventListener("change", () => {
    const exercise = byId[select.value];
    if (exercise) renderTrendBody(body, sessions, exercise);
  });

  const pickerField = el("div", "field");
  pickerField.appendChild(select);
  pickerField.style.marginBottom = "8px";
  card.appendChild(pickerField);
  card.appendChild(body);
  renderTrendBody(body, sessions, list[0]);
  return card;
}

// -------------------------------------------------------- body comp (B5)

// Two-series chart on a shared y-axis: weight (--chart-main) always present,
// muscle mass (--chart-good) only when 2+ entries have it. Body fat percent
// is a different unit, so it renders as small chips below rather than a
// third plotted line (kept legible in both themes without a dual axis).
function buildBodyChart(history, unit) {
  const svg = svgEl("svg", {
    class: "chart-svg",
    viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
    role: "img",
    preserveAspectRatio: "xMidYMid meet",
  });

  const muscleHistory = history.filter((h) => h.muscle != null);
  const allVals = [...history.map((h) => h.weight), ...muscleHistory.map((h) => h.muscle)];
  const { lo, hi, step } = niceBounds(Math.min(...allVals), Math.max(...allVals));
  const spanY = hi - lo || 1;
  const yOf = (v) => PLOT_Y1 - ((v - lo) / spanY) * (PLOT_Y1 - PLOT_Y0);
  const xOf = (i) => PLOT_X0 + (i * (PLOT_X1 - PLOT_X0)) / (history.length - 1);
  const r1 = (v) => Math.round(v * 10) / 10;

  for (let g = 0; g < 3; g++) {
    const value = lo + step * g;
    const y = r1(yOf(value));
    svg.appendChild(svgEl("line", { class: "grid-line", x1: PLOT_X0, y1: y, x2: PLOT_X1, y2: y }));
    const label = svgEl("text", { class: "axis-text", x: PLOT_X0 - 4, y: y + 3, "text-anchor": "end" });
    label.textContent = fmtNum(value);
    svg.appendChild(label);
  }

  function drawSeries(points, color) {
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${r1(xOf(p.i))} ${r1(yOf(p.v))}`).join(" ");
    svg.appendChild(svgEl("path", {
      d: line, fill: "none", stroke: color, "stroke-width": "2",
      "stroke-linecap": "round", "stroke-linejoin": "round",
    }));
    for (const p of points) {
      svg.appendChild(svgEl("circle", { cx: r1(xOf(p.i)), cy: r1(yOf(p.v)), r: 3, fill: color }));
    }
    return points[points.length - 1];
  }

  const weightPoints = history.map((h, i) => ({ i, v: h.weight }));
  const lastWeight = drawSeries(weightPoints, "var(--chart-main)");
  const weightLabel = svgEl("text", {
    class: "axis-text", x: xOf(lastWeight.i), y: Math.max(11, yOf(lastWeight.v) - 11),
    "text-anchor": "end", fill: "var(--chart-main)", "font-size": "11", "font-weight": "700",
  });
  weightLabel.textContent = `${fmtNum(lastWeight.v)} ${unit}`;
  svg.appendChild(weightLabel);

  if (muscleHistory.length >= 2) {
    const musclePoints = history
      .map((h, i) => (h.muscle != null ? { i, v: h.muscle } : null))
      .filter(Boolean);
    const lastMuscle = drawSeries(musclePoints, "var(--chart-good)");
    const muscleLabel = svgEl("text", {
      class: "axis-text", x: xOf(lastMuscle.i), y: Math.min(PLOT_Y1 - 4, yOf(lastMuscle.v) + 14),
      "text-anchor": "end", fill: "var(--chart-good)", "font-size": "11", "font-weight": "700",
    });
    muscleLabel.textContent = `${fmtNum(lastMuscle.v)} ${unit}`;
    svg.appendChild(muscleLabel);
  }

  for (const i of xLabelIndexes(history.length)) {
    const anchor = i === 0 ? "start" : i === history.length - 1 ? "end" : "middle";
    const label = svgEl("text", { class: "axis-text", x: xOf(i), y: XLABEL_Y, "text-anchor": anchor });
    label.textContent = fmtMD(history[i].date);
    svg.appendChild(label);
  }

  return svg;
}

function bodyCompTrendCard(bodyweight, settings) {
  const card = el("div", "card");
  card.appendChild(el("h2", null, t("stats.bodytrend.title")));

  const sorted = [...bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) {
    card.appendChild(el("div", "empty", t("stats.bodytrend.empty")));
    return card;
  }

  const unit = bwUnit(settings);
  const history = sorted.map((b) => ({
    date: b.date,
    weight: toUnit(b.kg, unit),
    muscle: b.muscleMassKg != null ? toUnit(b.muscleMassKg, unit) : null,
    fat: b.bodyFatPct,
  }));

  const wrap = el("div", "chart-wrap");
  wrap.appendChild(buildBodyChart(history, unit));
  card.appendChild(wrap);

  const fatPoints = history.filter((h) => h.fat != null).slice(-6);
  if (fatPoints.length > 0) {
    const row = el("div", "chip-list");
    for (const p of fatPoints) {
      row.appendChild(el("span", "chip neutral", t("stats.bodytrend.fat.chip", {
        date: fmtMD(p.date), pct: fmtNum(p.fat),
      })));
    }
    card.appendChild(row);
  }
  return card;
}

// Factual comparison only (first vs last entry in the current data set); no
// prescriptive advice beyond restating the protein target (B5).
function analysisCard(bodyweight, settings) {
  const sorted = [...bodyweight].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const unit = bwUnit(settings);

  const dir = (deltaKg) => (deltaKg > 0 ? t("stats.analysis.up") : deltaKg < 0 ? t("stats.analysis.down") : t("stats.analysis.flat"));
  const deltaDisplay = (deltaKg) => fmtNum(toUnit(Math.abs(deltaKg), unit));

  const weightDeltaKg = last.kg - first.kg;
  const parts = [t("stats.analysis.weight", {
    date1: fmtMD(first.date), date2: fmtMD(last.date),
    delta: deltaDisplay(weightDeltaKg), dir: dir(weightDeltaKg), unit,
  })];

  if (first.muscleMassKg != null && last.muscleMassKg != null) {
    const muscleDeltaKg = last.muscleMassKg - first.muscleMassKg;
    parts.push(t("stats.analysis.muscle", { delta: deltaDisplay(muscleDeltaKg), dir: dir(muscleDeltaKg), unit }));
  }

  const leanFirst = leanMassKg(first.kg, first.bodyFatPct);
  const leanLast = leanMassKg(last.kg, last.bodyFatPct);
  if (leanFirst != null && leanLast != null) {
    const leanDeltaKg = leanLast - leanFirst;
    if (Math.abs(leanDeltaKg) < LEAN_STABLE_KG) parts.push(t("stats.analysis.lean.preserved"));
    else if (leanDeltaKg > 0) parts.push(t("stats.analysis.lean.up"));
    else parts.push(t("stats.analysis.lean.down"));
  }

  parts.push(t("stats.analysis.protein", { g: proteinTargetG(last.kg, settings.proteinCoef) }));

  const card = el("div", "card");
  card.appendChild(el("h2", null, t("stats.analysis.title")));
  card.appendChild(el("div", null, parts.join(" ")));
  return card;
}

// ------------------------------------------------------------ weekly cardio

function cardioBandCard(sessions) {
  const card = el("div", "card");
  card.appendChild(el("h2", null, t("stats.cardio.title")));

  const minutes = weeklyCardioMinutes(sessions, weekKey(todayISO()));
  const axisMax = Math.max(WHO_AXIS_MIN, minutes);

  const head = el("div", "bal-head");
  head.appendChild(el("span", null, t("stats.cardio.minutes", { n: minutes })));
  card.appendChild(head);

  const track = el("div", "bal-track");
  const band = el("div", "bal-band");
  band.style.left = `${(WHO_CARDIO_LO / axisMax) * 100}%`;
  band.style.width = `${((WHO_CARDIO_HI - WHO_CARDIO_LO) / axisMax) * 100}%`;
  track.appendChild(band);

  const fill = el("div", "bal-fill");
  fill.style.width = `${Math.min(100, (minutes / axisMax) * 100)}%`;
  track.appendChild(fill);

  card.appendChild(track);
  card.appendChild(el("div", "bal-cap", t("stats.cardio.cap", { lo: WHO_CARDIO_LO, hi: WHO_CARDIO_HI })));
  return card;
}

// ----------------------------------------------------------------- balance

function balanceCard(sessions, exercisesById) {
  const card = el("div", "card");
  card.appendChild(el("h2", null, t("stats.balance.title")));

  const totals = weeklyBalance(sessions, exercisesById, weekKey(todayISO()));
  const emphasis = emphasisBreakdown(sessions, exercisesById, weekKey(todayISO()));
  const parts = [...STANDARD_PARTS, ...Object.keys(totals).filter((p) => !STANDARD_PARTS.includes(p))];
  const axisMax = Math.max(BAND_AXIS_MIN, ...Object.values(totals));

  const list = el("div", "bal-list");
  for (const part of parts) {
    const total = totals[part] || 0;
    const item = el("div", "bal-item");

    const head = el("div", "bal-head");
    head.appendChild(el("span", null, bodyPartLabel(part)));
    head.appendChild(el("span", "v", t("stats.balance.sets", { n: total })));
    item.appendChild(head);

    const track = el("div", "bal-track");
    const band = el("div", "bal-band");
    band.style.left = `${(BAND_LO / axisMax) * 100}%`;
    band.style.width = `${((BAND_HI - BAND_LO) / axisMax) * 100}%`;
    track.appendChild(band);

    const fill = el("div", "bal-fill");
    fill.style.width = `${Math.min(100, (total / axisMax) * 100)}%`;
    track.appendChild(fill);

    item.appendChild(track);

    // Emphasis breakdown (C2): "상부 6 · 하부 3" under the bar, only when
    // this body part has at least one emphasis-labeled exercise this week.
    const byEmphasis = emphasis[part];
    if (byEmphasis && Object.keys(byEmphasis).length > 0) {
      const line = Object.entries(byEmphasis).map(([label, n]) => `${label} ${n}`).join(" · ");
      item.appendChild(el("div", "bal-emphasis", line));
    }

    list.appendChild(item);
  }

  card.appendChild(list);
  card.appendChild(el("div", "bal-cap", t("stats.balance.cap", { lo: BAND_LO, hi: BAND_HI })));
  return card;
}

// ------------------------------------------------------------------- mount

// Profile switcher (D1): when at least one guest profile exists, a chip row
// lets the user recompute every tile/chart/card below against a guest's
// read-only snapshot instead of my real stores (js/store.js getGuestData).
// Guest data never mixes into my aggregates; switching profiles just swaps
// which (sessions, bodyweight, exercises) arrays this render function reads.
export async function mount(root, ctx) {
  const [sessions, bodyweight, exercises, programs, settings, guests] = await Promise.all([
    getAll("sessions"),
    getAll("bodyweight"),
    getAll("exercises"),
    getAll("programs"),
    getSettings(),
    getGuests(),
  ]);

  const mine = { sessions, bodyweight, exercises, programs, isGuest: false };
  let activeGuestId = null; // null = 내 기록 (mine)

  // Zero-size marker (never shown): .screen lays out its direct children in a
  // flex column with a gap, so the tiles/cards below are appended as
  // SIBLINGS of this anchor directly in root, not inside a wrapper div (a
  // wrapper would swallow the gap between each card).
  const anchor = el("div");
  anchor.style.display = "none";

  if (guests.length > 0) {
    const profileRow = el("div", "filter-row");
    const chipBtns = new Map();

    const mineBtn = el("button", "filter sel", t("profile.mine"));
    mineBtn.type = "button";
    profileRow.appendChild(mineBtn);
    chipBtns.set(null, mineBtn);

    for (const g of guests) {
      const btn = el("button", "filter", t("profile.guest.readonly", { name: g.name }));
      btn.type = "button";
      profileRow.appendChild(btn);
      chipBtns.set(g.id, btn);
    }

    const roBadge = el("span", "chip accent", t("profile.readonly.badge"));
    roBadge.hidden = true;
    profileRow.appendChild(roBadge);
    root.appendChild(profileRow);

    async function guestDataset(id) {
      const data = await getGuestData(id);
      // Deleted meanwhile (e.g. from settings in another tab): fall back to mine.
      if (!data) return mine;
      return {
        sessions: data.sessions, bodyweight: data.bodyweight, exercises: data.exercises,
        programs: data.programs || [], isGuest: true,
      };
    }

    async function switchProfile(id) {
      if (activeGuestId === id) return;
      activeGuestId = id;
      for (const [k, b] of chipBtns) b.classList.toggle("sel", k === id);
      roBadge.hidden = id === null;
      const data = id === null ? mine : await guestDataset(id);
      renderScreen(data);
    }

    mineBtn.addEventListener("click", () => switchProfile(null));
    for (const g of guests) {
      chipBtns.get(g.id).addEventListener("click", () => switchProfile(g.id));
    }
  }

  root.appendChild(anchor);

  function renderScreen(data) {
    while (anchor.nextSibling) anchor.nextSibling.remove();
    const exercisesById = {};
    for (const ex of data.exercises) exercisesById[ex.id] = ex;

    const tiles = el("div", "tile-row");
    tiles.appendChild(bodyweightTile(data.bodyweight, settings));
    tiles.appendChild(bodyFatTile(data.bodyweight));
    tiles.appendChild(muscleTile(data.bodyweight, settings));
    root.appendChild(tiles);

    const tiles2 = el("div", "tile-row");
    tiles2.appendChild(weekTile(data.sessions));
    root.appendChild(tiles2);

    root.appendChild(bodyCompTrendCard(data.bodyweight, settings));
    const analysis = analysisCard(data.bodyweight, settings);
    if (analysis) root.appendChild(analysis);

    root.appendChild(trendCard(data.sessions, exercisesById, data.programs));
    root.appendChild(cardioBandCard(data.sessions));
    root.appendChild(balanceCard(data.sessions, exercisesById));
  }

  renderScreen(mine);
}
