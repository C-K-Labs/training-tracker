// First-run onboarding wizard (v1.1, C4): a full-screen overlay that walks a
// new user through goal/days/experience/equipment/session-length questions,
// runs js/gen.js on the answers, and previews the generated course before
// committing it. Also reachable later from Settings ("추천 코스 생성"),
// skipping the initial data-or-fresh question.
//
// Date.now() is intentionally only ever called from THIS file (never inside
// js/gen.js) to build the idPrefix, keeping the generator itself pure.

import { t, getLang, setLang, availableLangs } from "./i18n.js";
import { getAll, bulkPut, put, getSettings, saveSettings, importPack } from "./store.js";
import { generateCourse, volumeReport } from "./gen.js";
import { normalizeCode, deriveFromCode, decryptBlob } from "./crypto.js";

// Same worker endpoint settings' cloud rows use. It is duplicated here on
// purpose: js/ui/settings.js imports this module, so importing it back would
// create a cycle.
const BACKUP_ENDPOINT = "https://training-tracker-api.ck-labs.workers.dev/backup";

const GOALS = ["hypertrophy", "strength", "fatloss", "fitness"];
const EXPERIENCES = ["beginner", "intermediate", "advanced"];
const EQUIPMENT = ["gym", "home_dumbbell", "bodyweight"];
const DAY_OPTIONS = [2, 3, 4, 5, 6];
const MINUTE_OPTIONS = [30, 45, 60, 90];
const MAJOR_PARTS = ["legs", "back", "chest", "shoulders", "arms"];

// Question steps only (1-5); step 0 is the data-or-fresh branch and step 6
// is the preview, neither counted in the progress dots.
const QUESTION_STEPS = 5;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function dotsRow(step) {
  const row = el("div", "wizard-dots");
  for (let i = 1; i <= QUESTION_STEPS; i++) {
    row.appendChild(el("span", `wizard-dot${i === step ? " on" : ""}`));
  }
  return row;
}

function header(titleKey, descKey) {
  const wrap = el("div", "onboard-header");
  wrap.appendChild(el("h1", null, t(titleKey)));
  if (descKey) wrap.appendChild(el("p", null, t(descKey)));
  return wrap;
}

function backLink(onClick) {
  const btn = el("button", "link", t("common.back"));
  btn.type = "button";
  btn.addEventListener("click", onClick);
  return btn;
}

function optionCard(titleText, descText, selected, onClick) {
  const btn = el("button", `goalopt${selected ? " sel" : ""}`);
  btn.type = "button";
  btn.appendChild(el("strong", null, titleText));
  if (descText) btn.appendChild(el("span", "d", descText));
  btn.addEventListener("click", onClick);
  return btn;
}

function chipRow(values, selected, labelFor, onPick) {
  const row = el("div", "filter-row");
  for (const v of values) {
    const chip = el("button", `filter${v === selected ? " sel" : ""}`, labelFor(v));
    chip.type = "button";
    chip.addEventListener("click", () => onPick(v));
    row.appendChild(chip);
  }
  return row;
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("read-failed"));
    reader.readAsText(file);
  });
}

async function markOnboarded() {
  await put("kv", { key: "onboarded", done: true });
}

// Best-guess UI language from the browser locale. English is the fallback
// for unsupported locales: a German or French system should not land on the
// stored default (Korean).
function detectLang() {
  const nav = (typeof navigator !== "undefined" && navigator.language) || "";
  const short = nav.toLowerCase().split("-")[0];
  return availableLangs().includes(short) ? short : "en";
}

// mount(root, ctx, opts):
//   opts.skipDataStep - true when launched from Settings (data already
//   exists, so the import-or-fresh branch is meaningless there).
//   opts.onDone - called after the overlay closes; defaults to going to the
//   Today tab (the first-run path). Settings passes a remount-settings
//   callback instead.
export async function mount(root, ctx, opts = {}) {
  const skipDataStep = !!opts.skipDataStep;
  const finish = typeof opts.onDone === "function" ? opts.onDone : () => ctx.navigate("today");

  const overlay = el("div", "onboard-overlay");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  root.appendChild(overlay);

  // First-run only: the wizard opens on a language step (-1), pre-applying
  // the browser locale so the step itself already reads in the likely
  // language. The choice is persisted to settings on pick.
  if (!skipDataStep) setLang(detectLang());

  const state = {
    step: skipDataStep ? 1 : -1,
    goal: null,
    days: 3,
    experience: null,
    equipment: null,
    sessionMinutes: 60,
    course: null,
  };

  function close() {
    overlay.remove();
  }

  function goTo(step) {
    state.step = step;
    render();
  }

  // -------------------------------------------------------------- step -1

  function renderLangStep(inner) {
    inner.appendChild(header("onboarding.lang.title"));
    const list = el("div", "goalopt-list");
    for (const code of availableLangs()) {
      list.appendChild(optionCard(
        t(`lang.${code}`),
        null,
        getLang() === code,
        async () => {
          setLang(code);
          const settings = await getSettings();
          settings.language = code;
          await saveSettings(settings);
          document.title = t("app.title");
          ctx.refreshTabLabels();
          goTo(0);
        },
      ));
    }
    inner.appendChild(list);
  }

  // -------------------------------------------------------------- step 0

  function renderDataStep(inner) {
    inner.appendChild(header("onboarding.step0.title", "onboarding.step0.desc"));

    const choiceBox = el("div");
    choiceBox.style.display = "flex";
    choiceBox.style.flexDirection = "column";
    choiceBox.style.gap = "10px";
    inner.appendChild(choiceBox);

    const importBtn = el("button", "btn-secondary", t("onboarding.step0.import"));
    importBtn.type = "button";
    // A freshly installed home-screen PWA gets its own storage container, so
    // a sync code made in the browser is the only way back to the data - the
    // file picker is not always reachable there.
    const restoreBtn = el("button", "btn-secondary", t("onboarding.step0.restore"));
    restoreBtn.type = "button";
    const freshBtn = el("button", "btn-primary", t("onboarding.step0.fresh"));
    freshBtn.type = "button";
    freshBtn.addEventListener("click", () => goTo(1));
    choiceBox.append(importBtn, restoreBtn, freshBtn);

    importBtn.addEventListener("click", () => {
      choiceBox.remove();
      inner.appendChild(renderImportForm());
    });

    restoreBtn.addEventListener("click", () => {
      choiceBox.remove();
      inner.appendChild(renderRestoreForm());
    });

    inner.appendChild(backLink(() => goTo(-1)));
  }

  function renderImportForm() {
    const box = el("div", "card");
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";

    const file = document.createElement("input");
    file.type = "file";
    file.accept = ".ttpack,.json,application/json";
    box.appendChild(file);

    let mode = "merge";
    const seg = el("div", "seg");
    const buttons = [];
    for (const [value, key] of [["replace", "settings.data.import.replace"], ["merge", "settings.data.import.merge"]]) {
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

    const run = el("button", "btn-primary", t("common.confirm"));
    run.type = "button";
    run.addEventListener("click", async () => {
      const chosen = file.files && file.files[0];
      if (!chosen) return;
      if (mode === "replace" && !confirm(t("settings.data.import.replace.confirm"))) return;
      try {
        const parsed = JSON.parse(await readFileText(chosen));
        const counts = await importPack(parsed, mode);
        await markOnboarded();
        ctx.showToast(t("settings.data.import.ok", {
          e: counts.exercises, p: counts.programs, s: counts.sessions,
        }));
        close();
        finish();
      } catch {
        ctx.showToast(t("settings.data.import.err"));
      }
    });
    box.appendChild(run);

    box.appendChild(backLink(() => goTo(0)));
    return box;
  }

  // Restore straight from the cloud during first run: the typed code derives
  // the slot, so a wrong code simply addresses a slot that does not exist.
  // The database is empty here, so "merge" and "replace" are the same thing
  // and no destructive confirmation is needed.
  function renderRestoreForm() {
    const box = el("div", "card");
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "10px";

    const codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.placeholder = t("settings.data.restore.code.ph");
    codeInput.setAttribute("autocapitalize", "characters");
    codeInput.setAttribute("autocomplete", "off");
    codeInput.setAttribute("spellcheck", "false");
    box.appendChild(codeInput);

    const run = el("button", "btn-primary", t("settings.data.restore.run"));
    run.type = "button";
    run.addEventListener("click", async () => {
      const canonical = normalizeCode(codeInput.value);
      if (!canonical) {
        ctx.showToast(t("settings.data.restore.badcode"));
        return;
      }
      run.disabled = true;
      run.textContent = t("settings.data.cloud.working");
      try {
        const { slotId } = await deriveFromCode(canonical);
        const res = await fetch(`${BACKUP_ENDPOINT}?slot=${slotId}`);
        if (res.status === 404) {
          ctx.showToast(t("settings.data.restore.notfound"));
        } else if (res.status === 429) {
          ctx.showToast(t("settings.data.cloud.err.rate"));
        } else if (!res.ok) {
          ctx.showToast(t("settings.data.cloud.err"));
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
            const counts = await importPack(pack, "merge");
            // This device now shares the backup: adopt the code so it can
            // back up here too, without a second setup.
            const settings = await getSettings();
            settings.cloudBackup = { code: canonical, lastAt: body.updatedAt };
            await saveSettings(settings);
            await markOnboarded();
            ctx.showToast(t("settings.data.import.ok", {
              e: counts.exercises, p: counts.programs, s: counts.sessions,
            }));
            close();
            finish();
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

    box.appendChild(backLink(() => goTo(0)));
    return box;
  }

  // -------------------------------------------------------------- step 1-5

  function renderGoalStep(inner) {
    inner.appendChild(header("onboarding.step.goal.title"));
    const list = el("div", "goalopt-list");
    for (const key of GOALS) {
      list.appendChild(optionCard(
        t(`onboarding.goal.${key}.title`),
        t(`onboarding.goal.${key}.desc`),
        state.goal === key,
        () => { state.goal = key; goTo(2); },
      ));
    }
    inner.appendChild(list);
    inner.appendChild(backLink(() => goTo(0)));
  }

  function renderDaysStep(inner) {
    inner.appendChild(header("onboarding.step.days.title"));
    inner.appendChild(chipRow(
      DAY_OPTIONS,
      state.days,
      (n) => t("onboarding.days.chip", { n }),
      (n) => { state.days = n; goTo(3); },
    ));
    inner.appendChild(backLink(() => goTo(1)));
  }

  function renderExperienceStep(inner) {
    inner.appendChild(header("onboarding.step.experience.title"));
    const list = el("div", "goalopt-list");
    for (const key of EXPERIENCES) {
      list.appendChild(optionCard(
        t(`onboarding.experience.${key}.title`),
        t(`onboarding.experience.${key}.desc`),
        state.experience === key,
        () => { state.experience = key; goTo(4); },
      ));
    }
    inner.appendChild(list);
    inner.appendChild(backLink(() => goTo(2)));
  }

  function renderEquipmentStep(inner) {
    inner.appendChild(header("onboarding.step.equipment.title"));
    const list = el("div", "goalopt-list");
    for (const key of EQUIPMENT) {
      list.appendChild(optionCard(
        t(`onboarding.equipment.${key}.title`),
        t(`onboarding.equipment.${key}.desc`),
        state.equipment === key,
        () => { state.equipment = key; goTo(5); },
      ));
    }
    inner.appendChild(list);
    inner.appendChild(backLink(() => goTo(3)));
  }

  function renderMinutesStep(inner) {
    inner.appendChild(header("onboarding.step.minutes.title"));
    inner.appendChild(chipRow(
      MINUTE_OPTIONS,
      state.sessionMinutes,
      (n) => t("onboarding.minutes.chip", { n }),
      (n) => {
        state.sessionMinutes = n;
        state.course = generateCourse(
          {
            goal: state.goal,
            daysPerWeek: state.days,
            experience: state.experience,
            equipment: state.equipment,
            sessionMinutes: state.sessionMinutes,
          },
          { idPrefix: `gen-${Date.now().toString(36)}` },
        );
        goTo(6);
      },
    ));
    inner.appendChild(backLink(() => goTo(4)));
  }

  // ----------------------------------------------------------- preview

  function renderPreviewStep(inner) {
    inner.appendChild(header("onboarding.preview.title"));
    const course = state.course;

    const list = el("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "8px";
    for (const program of course.programs) {
      const row = el("div", "onboard-session");
      row.appendChild(el("div", "name", program.name));
      row.appendChild(el("div", "meta", t("onboarding.preview.items", { n: program.items.length })));
      list.appendChild(row);
    }
    inner.appendChild(list);

    const report = volumeReport(course);
    const chipRowEl = el("div", "daily-row");
    for (const part of MAJOR_PARTS) {
      if (!(part in report)) continue;
      chipRowEl.appendChild(el("span", "chip neutral", t("onboarding.preview.partSets", {
        part: t(`bodypart.${part}`), n: report[part] || 0,
      })));
    }
    inner.appendChild(chipRowEl);

    const notes = el("div", "onboard-notes");
    for (const key of course.notes) notes.appendChild(el("div", null, t(key)));
    inner.appendChild(notes);

    const actions = el("div", "btn-row");
    const confirm = el("button", "btn-primary", t("onboarding.preview.confirm"));
    confirm.type = "button";
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      await bulkPut("exercises", course.exercises);
      await bulkPut("programs", course.programs);
      if (course.restOverrides && Object.keys(course.restOverrides).length > 0) {
        const settings = await getSettings();
        settings.restOverrides = { ...settings.restOverrides, ...course.restOverrides };
        await saveSettings(settings);
      }
      await markOnboarded();
      ctx.showToast(t("settings.saved"));
      close();
      finish();
    });
    const skip = el("button", "btn-secondary", t("onboarding.preview.skip"));
    skip.type = "button";
    skip.addEventListener("click", async () => {
      skip.disabled = true;
      await markOnboarded();
      close();
      finish();
    });
    actions.append(confirm, skip);
    inner.appendChild(actions);

    inner.appendChild(backLink(() => goTo(5)));
  }

  // ------------------------------------------------------------ render

  function render() {
    overlay.textContent = "";
    const inner = el("div", "onboard-inner");
    overlay.appendChild(inner);

    if (state.step >= 1 && state.step <= QUESTION_STEPS) {
      inner.appendChild(dotsRow(state.step));
    }

    switch (state.step) {
      case -1: renderLangStep(inner); break;
      case 0: renderDataStep(inner); break;
      case 1: renderGoalStep(inner); break;
      case 2: renderDaysStep(inner); break;
      case 3: renderExperienceStep(inner); break;
      case 4: renderEquipmentStep(inner); break;
      case 5: renderMinutesStep(inner); break;
      case 6: renderPreviewStep(inner); break;
      default: renderDataStep(inner);
    }
  }

  render();
}

// Convenience used by boot(): true when the user has no data yet AND hasn't
// already been through (or skipped) onboarding before.
export async function needsOnboarding(onboardedFlag) {
  const [sessions, programs] = await Promise.all([getAll("sessions"), getAll("programs")]);
  return sessions.length === 0 && programs.length === 0 && !onboardedFlag?.done;
}
