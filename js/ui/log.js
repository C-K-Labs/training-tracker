// Log screen: the full history timeline (sessions + bodyweight records),
// filtered by kind, grouped by month, with an inline detail per session.
//
// User-entered text (exercise names, program names) is written with
// textContent only; nothing from the database reaches innerHTML.

import { t } from "../i18n.js";
import { getAll, del } from "../store.js";
import { workingSets } from "../rules.js";

export const titleKey = "tab.log";
export const subKey = "screen.log.sub";

const KINDS = ["all", "weights", "run", "calisthenics", "bodyweight"];
const weekdayFmt = new Intl.DateTimeFormat("ko", { weekday: "short" });

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function dayOf(dateISO) {
  return String(Number(dateISO.slice(8, 10)));
}

function weekdayOf(dateISO) {
  return weekdayFmt.format(new Date(dateISO + "T00:00:00"));
}

function monthKey(dateISO) {
  return dateISO.slice(0, 7);
}

function monthLabel(dateISO) {
  return t("log.month", { y: Number(dateISO.slice(0, 4)), m: Number(dateISO.slice(5, 7)) });
}

function durationMin(session) {
  return session.endedAt && session.startedAt
    ? Math.round((session.endedAt - session.startedAt) / 60000)
    : 0;
}

function sessionWorkingSets(session) {
  const out = [];
  for (const entry of session.entries || []) out.push(...workingSets(entry.sets));
  return out;
}

function unitLabel(exercise) {
  return t(exercise?.unit === "kg" ? "today.weight.unit.kg" : "today.weight.unit.lb");
}

// Most frequent working-set weight; the load the session was actually run at.
function commonLoad(sets) {
  const counts = new Map();
  let best = null;
  let bestN = 0;
  for (const s of sets) {
    const n = (counts.get(s.weight) || 0) + 1;
    counts.set(s.weight, n);
    if (n > bestN) { bestN = n; best = s.weight; }
  }
  return best;
}

function repsLabel(targetReps) {
  if (targetReps === "max") return t("common.max.reps");
  return targetReps == null ? "-" : String(targetReps);
}

function buildItems(sessions, bodyweight) {
  const items = [
    ...sessions.map((s) => ({ kind: s.kind, date: s.date, at: s.startedAt || 0, session: s })),
    ...bodyweight.map((b) => ({ kind: "bodyweight", date: b.date, at: 0, record: b })),
  ];
  items.sort((a, b) => (a.date === b.date ? b.at - a.at : b.date.localeCompare(a.date)));
  return items;
}

export async function mount(root, ctx) {
  const [sessions, bodyweightRecords, exercises] = await Promise.all([
    getAll("sessions"),
    getAll("bodyweight"),
    getAll("exercises"),
  ]);

  const exById = {};
  for (const ex of exercises) exById[ex.id] = ex;
  const items = buildItems(sessions, bodyweightRecords);

  let selected = "all";

  const filterRow = el("div", "filter-row");
  const buttons = new Map();
  for (const kind of KINDS) {
    const btn = el("button", "filter", t(`kind.${kind}`));
    btn.type = "button";
    if (kind === selected) btn.classList.add("sel");
    btn.addEventListener("click", () => {
      if (selected === kind) return;
      selected = kind;
      for (const [k, b] of buttons) b.classList.toggle("sel", k === selected);
      renderList();
    });
    buttons.set(kind, btn);
    filterRow.appendChild(btn);
  }
  root.appendChild(filterRow);

  function confirmDelete(store, key) {
    if (!confirm(t("log.delete.confirm"))) return;
    del(store, key).then(() => {
      ctx.showToast(t("common.done"));
      ctx.remount();
    });
  }

  function deleteLink(store, key) {
    const btn = el("button", "link", t("common.delete"));
    btn.type = "button";
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      confirmDelete(store, key);
    });
    return btn;
  }

  function dateBox(dateISO) {
    const box = el("div", "date");
    box.appendChild(el("b", null, dayOf(dateISO)));
    box.appendChild(el("span", null, weekdayOf(dateISO)));
    return box;
  }

  function sessionMeta(body, session) {
    const sets = sessionWorkingSets(session);
    if (session.kind === "run") {
      const run = session.run || { minutes: 0, avgHr: null };
      body.appendChild(el("div", "m", t("log.run.summary", { min: run.minutes, hr: run.avgHr || "-" })));
      return;
    }
    const min = durationMin(session);
    if (session.kind === "calisthenics") {
      body.appendChild(el("div", "m", min
        ? t("log.sets.summary", { sets: sets.length, min })
        : t("common.set.n", { n: sets.length })));
      return;
    }
    body.appendChild(el("div", "m", t("log.sets.summary", { sets: sets.length, min })));
    const effort = { easy: 0, normal: 0, hard: 0 };
    for (const s of sets) if (s.effort in effort) effort[s.effort] += 1;
    body.appendChild(el("div", "m", t("log.effort.summary", {
      e: effort.easy, n: effort.normal, h: effort.hard,
    })));
  }

  function sessionDetail(session) {
    const detail = el("div", "log-detail");
    for (const entry of session.entries || []) {
      const ex = exById[entry.exerciseId];
      const line = el("div", "dl");
      const name = el("span", "n", ex ? ex.name : entry.exerciseId);
      if (ex && ex.variant) name.textContent = `${ex.name} (${ex.variant})`;
      line.appendChild(name);

      const value = el("span", "v");
      const sets = workingSets(entry.sets);
      const load = commonLoad(sets);
      const parts = [];
      if (load != null) parts.push(`${load} ${unitLabel(ex)}`);
      parts.push(`${sets.length}×${repsLabel(entry.targetReps)}`);
      value.appendChild(el("span", null, parts.join(" ")));
      for (const s of sets) {
        if (!s.effort) continue; // unrated set: no dot rather than a neutral one
        value.appendChild(el("span", `dot ${s.effort}`));
      }
      line.appendChild(value);
      detail.appendChild(line);
    }
    detail.appendChild(deleteLink("sessions", session.id));
    return detail;
  }

  function sessionCard(item) {
    const session = item.session;
    const card = el("div", "card");
    const row = el("div", "log-row");
    row.appendChild(dateBox(item.date));

    const body = el("div", "body");
    body.appendChild(el("div", "t", session.programName || t(`kind.${session.kind}`)));
    sessionMeta(body, session);
    row.appendChild(body);

    if (session.kind === "weights" && session.recovery) {
      row.appendChild(el("span", "chip accent", t("log.recovery")));
    }
    card.appendChild(row);

    if (session.kind === "weights" || session.kind === "calisthenics") {
      let detail = null;
      card.addEventListener("click", () => {
        if (!detail) {
          detail = sessionDetail(session);
          card.appendChild(detail);
          return;
        }
        detail.hidden = !detail.hidden;
      });
    }
    return card;
  }

  function bodyweightCard(item) {
    const card = el("div", "card");
    const row = el("div", "log-row");
    row.appendChild(dateBox(item.date));

    const body = el("div", "body");
    body.appendChild(el("div", "t", t("kind.bodyweight")));
    body.appendChild(el("div", "m", t("log.bw.summary", { kg: item.record.kg })));
    row.appendChild(body);
    card.appendChild(row);

    let detail = null;
    card.addEventListener("click", () => {
      if (!detail) {
        detail = el("div", "log-detail");
        detail.appendChild(deleteLink("bodyweight", item.record.date));
        card.appendChild(detail);
        return;
      }
      detail.hidden = !detail.hidden;
    });
    return card;
  }

  function renderList() {
    while (filterRow.nextSibling) filterRow.nextSibling.remove();
    const visible = selected === "all" ? items : items.filter((i) => i.kind === selected);

    if (visible.length === 0) {
      const card = el("div", "card");
      card.appendChild(el("div", "empty", t("log.empty")));
      root.appendChild(card);
      return;
    }

    let month = null;
    for (const item of visible) {
      if (monthKey(item.date) !== month) {
        month = monthKey(item.date);
        root.appendChild(el("div", "month-label", monthLabel(item.date)));
      }
      root.appendChild(item.kind === "bodyweight" ? bodyweightCard(item) : sessionCard(item));
    }
  }

  renderList();
}
