// Stats screen: body-weight / week tiles, per-exercise load trend chart,
// and the weekly volume balance bars.
//
// Exercise names are user data (imported packs), so every label is written
// with textContent; nothing user-supplied is ever interpolated into HTML.

import { t } from "../i18n.js";
import { getAll } from "../store.js";
import { weekKey, weeklyBalance, overshootWarning, workingSets } from "../rules.js";

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

// Body-weight is stored in kilograms by schema; the unit is a data
// convention like the per-exercise unit, not a translated label.
const BODYWEIGHT_UNIT = "kg";

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

function exerciseLabel(ex) {
  return ex.variant ? `${ex.name} ${ex.variant}` : ex.name;
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

function bodyweightTile(bodyweight) {
  const card = el("div", "card tile");
  card.appendChild(el("h2", null, t("stats.weight.title")));

  const latest = bodyweight.reduce((best, b) => (!best || b.date > best.date ? b : best), null);
  const big = el("div", "big");
  const cap = el("div", "cap");

  if (!latest) {
    big.textContent = "-";
    cap.textContent = t("common.none");
  } else {
    big.appendChild(document.createTextNode(`${fmtNum(latest.kg)} `));
    big.appendChild(el("small", null, t("unit.kg")));
    const date = fmtMD(latest.date);
    cap.textContent = latest.fasted
      ? t("stats.weight.cap", { date })
      : t("stats.weight.cap.notfasted", { date });
  }

  card.appendChild(big);
  card.appendChild(cap);
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

// Exercises with at least one weights-session entry, most recent first.
function trendExercises(sessions, exercisesById) {
  const lastSeen = new Map();
  for (const session of sessions) {
    if (session.kind !== "weights") continue;
    for (const entry of session.entries || []) {
      if (!exercisesById[entry.exerciseId]) continue;
      const prev = lastSeen.get(entry.exerciseId);
      if (!prev || session.date > prev) lastSeen.set(entry.exerciseId, session.date);
    }
  }
  return [...lastSeen.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, MAX_TREND_EXERCISES)
    .map(([id]) => exercisesById[id]);
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
  wrap.appendChild(buildChart(history, exercise.unit));
  host.appendChild(wrap);

  const warn = overshootWarning(history);
  if (warn) {
    host.appendChild(el("div", "hint", t("stats.overshoot", {
      name: exerciseLabel(exercise),
      pct: warn.pct,
    })));
  }
}

function trendCard(sessions, exercisesById) {
  const card = el("div", "card");
  card.appendChild(el("h2", null, t("stats.trend.title")));

  const list = trendExercises(sessions, exercisesById);
  if (list.length === 0) {
    card.appendChild(el("div", "empty", t("stats.trend.none")));
    return card;
  }

  const filters = el("div", "filter-row");
  const body = el("div");
  const buttons = [];

  list.forEach((exercise, i) => {
    const btn = el("button", i === 0 ? "filter sel" : "filter", exerciseLabel(exercise));
    btn.type = "button";
    btn.addEventListener("click", () => {
      for (const b of buttons) b.classList.toggle("sel", b === btn);
      renderTrendBody(body, sessions, exercise);
    });
    buttons.push(btn);
    filters.appendChild(btn);
  });

  card.appendChild(filters);
  card.appendChild(body);
  renderTrendBody(body, sessions, list[0]);
  return card;
}

// ----------------------------------------------------------------- balance

function balanceCard(sessions, exercisesById) {
  const card = el("div", "card");
  card.appendChild(el("h2", null, t("stats.balance.title")));

  const totals = weeklyBalance(sessions, exercisesById, weekKey(todayISO()));
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
    list.appendChild(item);
  }

  card.appendChild(list);
  card.appendChild(el("div", "bal-cap", t("stats.balance.cap", { lo: BAND_LO, hi: BAND_HI })));
  return card;
}

// ------------------------------------------------------------------- mount

export async function mount(root, ctx) {
  const [sessions, bodyweight, exercises] = await Promise.all([
    getAll("sessions"),
    getAll("bodyweight"),
    getAll("exercises"),
  ]);

  const exercisesById = {};
  for (const ex of exercises) exercisesById[ex.id] = ex;

  const tiles = el("div", "tile-row");
  tiles.appendChild(bodyweightTile(bodyweight));
  tiles.appendChild(weekTile(sessions));

  root.appendChild(tiles);
  root.appendChild(trendCard(sessions, exercisesById));
  root.appendChild(balanceCard(sessions, exercisesById));
}
