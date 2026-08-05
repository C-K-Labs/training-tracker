// App entry: boot, theme, tab routing, shared UI context.
//
// Screen module contract (js/ui/*.js):
//   export const titleKey  - i18n key for the app-bar title
//   export const subKey    - i18n key for the app-bar subtitle (optional)
//   export async function mount(root, ctx) - render into root
// ctx = { navigate, showToast, setTimer, setSub, remount }

import { t, setLang } from "./i18n.js";
import { openDB, getSettings, requestPersist, get } from "./store.js";
import { seedIfEmpty } from "./seed.js";
import * as today from "./ui/today.js";
import * as log from "./ui/log.js";
import * as stats from "./ui/stats.js";
import * as settingsScreen from "./ui/settings.js";
import * as onboarding from "./onboarding.js";

const screens = { today, log, stats, settings: settingsScreen };
let currentScreen = "today";

const rootEl = document.getElementById("screen-root");
const titleEl = document.getElementById("screen-title");
const subEl = document.getElementById("screen-sub");
const timerEl = document.getElementById("session-timer");

export function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function showToast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function setTimer(text) {
  if (text == null) {
    timerEl.hidden = true;
  } else {
    timerEl.hidden = false;
    timerEl.textContent = text;
  }
}

function setSub(text) {
  subEl.textContent = text;
}

function refreshTabLabels() {
  for (const span of document.querySelectorAll("[data-tab-label]")) {
    span.textContent = t(`tab.${span.dataset.tabLabel}`);
  }
}

async function navigate(name) {
  const mod = screens[name];
  if (!mod) return;
  currentScreen = name;
  for (const tab of document.querySelectorAll(".tab")) {
    tab.classList.toggle("sel", tab.dataset.screen === name);
  }
  titleEl.textContent = t(mod.titleKey);
  subEl.textContent = mod.subKey ? t(mod.subKey) : "";
  if (name !== "today") setTimer(null);
  rootEl.innerHTML = "";
  const section = document.createElement("section");
  section.className = "screen";
  rootEl.appendChild(section);
  await mod.mount(section, ctx);
  window.scrollTo(0, 0);
}

const ctx = {
  navigate,
  showToast,
  setTimer,
  setSub,
  applyTheme,
  refreshTabLabels,
  remount: () => navigate(currentScreen),
};

async function boot() {
  await openDB();
  await seedIfEmpty();
  const settings = await getSettings();
  setLang(settings.language);
  applyTheme(settings.theme);
  requestPersist();

  document.title = t("app.title");
  refreshTabLabels();
  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => navigate(tab.dataset.screen));
  }

  // First-run onboarding (C4): only for users with no sessions AND no
  // programs yet who haven't already been through (or skipped) it. A single
  // kv get plus the session/program counts (onboarding.needsOnboarding)
  // keeps this cheap for existing users, who fall straight through to
  // navigate("today") as before.
  const onboardedFlag = await get("kv", "onboarded");
  if (await onboarding.needsOnboarding(onboardedFlag)) {
    await onboarding.mount(document.body, ctx);
  } else {
    await navigate("today");
  }

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* offline layer optional in dev */ });
  }
}

boot();
