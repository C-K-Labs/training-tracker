// Log screen: the full history timeline (sessions + bodyweight records),
// filtered by kind, grouped by month, with an inline detail per session.
//
// User-entered text (exercise names, program names) is written with
// textContent only; nothing from the database reaches innerHTML.
//
// Profile switcher (D1): when at least one guest profile exists (imported
// read-only via settings' "게스트로 보기" mode), a chip row lets the user
// swap this screen's data source between 내 기록 (my real stores) and a
// guest's sanitized snapshot (js/store.js getGuestData). Guest data never
// touches my stores; switching just re-renders this screen against a
// different in-memory dataset. Mutating affordances (delete) are hidden
// whenever a guest is active.

import { t } from "../i18n.js";
import { getAll, del, getSettings, getGuests, getGuestData } from "../store.js";
import { workingSets, paceText, formatLoad } from "../rules.js";

export const titleKey = "tab.log";
export const subKey = "screen.log.sub";

const KINDS = ["all", "weights", "cardio", "calisthenics", "bodyweight"];
const weekdayFmt = new Intl.DateTimeFormat("ko", { weekday: "short" });

// Fixed cardio activity slugs get a translated label; anything else (custom
// free text, including legacy migrated "running") renders as-is.
const CARDIO_ACTIVITY_KEYS = ["running", "cycling", "rowing", "swimming", "hiking", "walking"];
const RPE_CHIP = { hard: "bad", normal: "neutral", easy: "good" };

function cardioActivityLabel(activity) {
  if (CARDIO_ACTIVITY_KEYS.includes(activity)) return t(`today.cardio.activity.${activity}`);
  return activity || t("today.cardio.activity.custom");
}

// Same slug handling as Today's daily-check chip: known slugs translate,
// legacy keys (pre-item-6 Korean literals) render raw.
const PAIN_AREA_SLUGS = ["knee", "lowback", "shoulder", "elbow", "wrist"];

function painAreaLabel(slug) {
  return PAIN_AREA_SLUGS.includes(slug) ? t(`pain.area.${slug}`) : slug;
}

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

// Most frequent working-set hold duration (v1.1.1 polish item 7), mirrors
// commonLoad's most-frequent-value logic for holdSec instead of weight.
function commonHoldSec(sets) {
  const counts = new Map();
  let best = null;
  let bestN = 0;
  for (const s of sets) {
    if (!(s.holdSec > 0)) continue;
    const n = (counts.get(s.holdSec) || 0) + 1;
    counts.set(s.holdSec, n);
    if (n > bestN) { bestN = n; best = s.holdSec; }
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
  const [sessions, bodyweightRecords, exercises, programs, settings, guests] = await Promise.all([
    getAll("sessions"),
    getAll("bodyweight"),
    getAll("exercises"),
    getAll("programs"),
    getSettings(),
    getGuests(),
  ]);

  const mine = { sessions, bodyweight: bodyweightRecords, exercises, programs, isGuest: false };

  function dateBox(dateISO) {
    const box = el("div", "date");
    box.appendChild(el("b", null, dayOf(dateISO)));
    box.appendChild(el("span", null, weekdayOf(dateISO)));
    return box;
  }

  function sessionMeta(body, session) {
    const sets = sessionWorkingSets(session);
    if (session.kind === "cardio") {
      // Legacy migrated "run" sessions land here too (kind is rewritten to
      // "cardio" by the store's migration/import sanitizer), so this must
      // render correctly even when distanceKm/rpe are absent.
      const c = session.cardio || { activity: "running", minutes: 0, distanceKm: null, avgHr: null, rpe: null, note: "" };
      const parts = [cardioActivityLabel(c.activity), t("log.cardio.minutes", { min: c.minutes || 0 })];
      if (c.distanceKm) parts.push(t("log.cardio.distance", { km: c.distanceKm }));
      const pace = paceText(c.minutes, c.distanceKm);
      if (pace) parts.push(pace);
      if (c.avgHr) parts.push(t("log.cardio.hr", { hr: c.avgHr }));
      body.appendChild(el("div", "m", parts.join(" · ")));
      if (c.rpe) body.appendChild(el("span", `chip ${RPE_CHIP[c.rpe]}`, t(`rpe.${c.rpe}`)));
      if (c.note) body.appendChild(el("div", "m", c.note));
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

  // Profile switcher (D1): only rendered when at least one guest exists.
  let activeGuestId = null; // null = 내 기록 (mine)
  // Zero-size marker (never shown): .screen lays out its direct children in a
  // flex column with a gap, so the dynamic content below is appended as
  // SIBLINGS of this anchor directly in root, not inside a wrapper div (a
  // wrapper would swallow the gap between filterRow and the first card).
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
        sessions: data.sessions, bodyweight: data.bodyweight,
        exercises: data.exercises, programs: data.programs, isGuest: true,
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

  let selectedKind = "all";

  function renderScreen(data) {
    while (anchor.nextSibling) anchor.nextSibling.remove();

    const exById = {};
    for (const ex of data.exercises) exById[ex.id] = ex;
    const items = buildItems(data.sessions, data.bodyweight);

    // Method chip (C1): best-effort lookup against the CURRENT program item
    // for that exercise. Programs can change after a session was logged, so
    // this is an approximation, not a historical record (the app doesn't
    // snapshot method per-session).
    function itemForLog(session, exerciseId) {
      const program = data.programs.find((p) => p.id === session.programId);
      return (program?.items || []).find((i) => i.exerciseId === exerciseId) || null;
    }

    const filterRow = el("div", "filter-row");
    const buttons = new Map();
    for (const kind of KINDS) {
      const btn = el("button", "filter", t(`kind.${kind}`));
      btn.type = "button";
      if (kind === selectedKind) btn.classList.add("sel");
      btn.addEventListener("click", () => {
        if (selectedKind === kind) return;
        selectedKind = kind;
        for (const [k, b] of buttons) b.classList.toggle("sel", k === selectedKind);
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

    // Guests are read-only (D1): no delete affordance is ever rendered for
    // guest data, so this is only called when data.isGuest is false.
    function deleteLink(store, key) {
      const btn = el("button", "link", t("common.delete"));
      btn.type = "button";
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        confirmDelete(store, key);
      });
      return btn;
    }

    function sessionDetail(session) {
      const detail = el("div", "log-detail");
      // Daily check summary + memo, previously stored but never shown here.
      const daily = session.daily || {};
      const dailyParts = [];
      if (daily.sleepH != null) dailyParts.push(t("today.daily.sleep", { h: daily.sleepH }));
      if (daily.condition != null) dailyParts.push(t("today.daily.condition", { v: daily.condition }));
      for (const [area, v] of Object.entries(daily.pain || {})) {
        if (v > 0) dailyParts.push(t("today.daily.pain", { area: painAreaLabel(area), v }));
      }
      if (daily.heat) dailyParts.push(t("today.daily.heat"));
      if (dailyParts.length > 0) detail.appendChild(el("div", "daily", dailyParts.join(" · ")));
      if (daily.note) detail.appendChild(el("div", "daily note", daily.note));
      for (const entry of session.entries || []) {
        const ex = exById[entry.exerciseId];
        const item = itemForLog(session, entry.exerciseId);
        const line = el("div", "dl");
        const name = el("span", "n");
        let nameText = ex ? ex.name : t("common.exercise.deleted");
        if (ex && ex.variant) nameText += ` (${ex.variant})`;
        if (ex && ex.emphasis) nameText += ` · ${ex.emphasis}`;
        name.textContent = nameText;
        line.appendChild(name);
        if (item?.method) line.appendChild(el("span", "chip method", t(`method.${item.method}`)));

        const value = el("span", "v");
        const sets = workingSets(entry.sets).filter((s) => !s.drop);
        if (sets.length === 0) {
          // Unperformed exercise (v1.1.1 polish item 1): the program listed
          // it but no set was ever logged for this entry. No set dots, just
          // the muted status text; the exercise name line above is unchanged.
          value.appendChild(el("span", null, t("log.detail.notPerformed")));
        } else if (sets.every((s) => s.holdSec > 0)) {
          // Hold-time entry (v1.1.1 polish item 7): render the common hold
          // duration ("45초") instead of a reps-based summary.
          value.appendChild(el("span", null, t("today.set.hold", { n: commonHoldSec(sets) })));
        } else {
          const load = commonLoad(sets);
          const parts = [];
          // A1/A3 gap closed: this used to always show the exercise's stored
          // unit; now it follows the global display-unit setting like Today.
          if (load != null) parts.push(formatLoad(load, ex?.unit === "kg" ? "kg" : "lb", settings.displayUnit || "both"));
          parts.push(`${sets.length}×${repsLabel(entry.targetReps)}`);
          value.appendChild(el("span", null, parts.join(" ")));
        }
        if (sets.length > 0) {
          for (const s of sets) {
            if (!s.effort) continue; // unrated set: no dot rather than a neutral one
            value.appendChild(el("span", `dot ${s.effort}`));
          }
        }
        line.appendChild(value);
        detail.appendChild(line);

        // Drop sets (C1): shown individually, e.g. "드롭 25 lb x 6".
        const dropSets = (entry.sets || []).filter((s) => s.drop);
        for (const d of dropSets) {
          const dLine = el("div", "dl drop");
          dLine.appendChild(el("span", "n", t("common.drop")));
          const dValue = el("span", "v");
          const w = formatLoad(d.weight, ex?.unit === "kg" ? "kg" : "lb", settings.displayUnit || "both");
          dValue.appendChild(el("span", null, `${w} × ${d.reps}`));
          dLine.appendChild(dValue);
          detail.appendChild(dLine);
        }
      }
      if (!data.isGuest) detail.appendChild(deleteLink("sessions", session.id));
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

      // v1.1.1 polish item 8: cardio sessions were excluded from this click
      // handler entirely, so their delete link (built by sessionDetail below)
      // was never reachable. entries is empty for cardio, so sessionDetail
      // renders no exercise lines for it - just the delete link.
      if (session.kind === "weights" || session.kind === "calisthenics" || session.kind === "cardio") {
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
          if (!data.isGuest) detail.appendChild(deleteLink("bodyweight", item.record.date));
          card.appendChild(detail);
          return;
        }
        detail.hidden = !detail.hidden;
      });
      return card;
    }

    function renderList() {
      while (filterRow.nextSibling) filterRow.nextSibling.remove();
      const visible = selectedKind === "all" ? items : items.filter((i) => i.kind === selectedKind);

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

  renderScreen(mine);
}
