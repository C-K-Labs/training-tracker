// App entry: boot, theme, tab routing, shared UI context.
//
// Screen module contract (js/ui/*.js):
//   export const titleKey  - i18n key for the app-bar title
//   export const subKey    - i18n key for the app-bar subtitle (optional)
//   export async function mount(root, ctx) - render into root
// ctx = { navigate, showToast, setTimer, setSub, remount }

import { t, setLang, getLang } from "./i18n.js";
import { openDB, getSettings, requestPersist, get, put } from "./store.js";
import { APP_VERSION, CHANGELOG } from "./version.js";
import { seedIfEmpty, syncLibrary } from "./seed.js";
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

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// -------------------------------------------------- update notice (v1.3.0)

// Shown once per version, over whatever screen is already mounted, so the
// user learns what changed after the service worker quietly swapped in new
// code. The kv record is written when the notice is closed, not when it is
// shown, so a reload before closing brings it back.
function showUpdateNotice() {
  const entry = CHANGELOG[0];
  if (!entry) return;

  const overlay = el("div", "onboard-overlay");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  const inner = el("div", "onboard-inner");
  const card = el("section", "card");

  // .onboard-header (not a bare .card h2, which uppercases its text and would
  // print the version as "V1.3.0") so the version reads exactly as written.
  const head = el("div", "onboard-header");
  head.appendChild(el("h1", null, t("update.notice.title", { v: `v${APP_VERSION}` })));
  card.appendChild(head);
  card.appendChild(el("div", "hint", entry.date));

  // Patch notes ship in every UI language (js/version.js); English is the
  // fallback for any entry that predates a language.
  const notes = entry.notes[getLang()] || entry.notes.en || [];
  const list = document.createElement("ul");
  list.style.margin = "8px 0";
  list.style.paddingLeft = "18px";
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "4px";
  for (const note of notes) list.appendChild(el("li", null, note));
  card.appendChild(list);

  card.appendChild(el("div", "hint", t("settings.about.autoupdate")));

  const close = el("button", "btn-primary", t("common.close"));
  close.type = "button";
  close.style.marginTop = "12px";
  close.addEventListener("click", async () => {
    overlay.remove();
    await put("kv", { key: "seenVersion", v: APP_VERSION });
  });
  card.appendChild(close);

  inner.appendChild(card);
  overlay.appendChild(inner);
  document.body.appendChild(overlay);
}

// didOnboard: a brand-new user who went through the wizard this boot already
// knows what the app does, so the version is recorded silently instead.
async function handleUpdateNotice(didOnboard) {
  const seen = await get("kv", "seenVersion");
  if (didOnboard) {
    await put("kv", { key: "seenVersion", v: APP_VERSION });
    return;
  }
  if (!seen || seen.v !== APP_VERSION) showUpdateNotice();
}

// ------------------------------------------------- install banner (v1.3.0)

// The beforeinstallprompt listener is registered at module scope because the
// browser can fire it before boot()'s awaits finish; the event is parked and
// the banner is only built once boot has confirmed the user is eligible.
let deferredInstallPrompt = null;
let installBannerAllowed = false;
let installBannerVisible = false;

function isStandalone() {
  const mm = typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches;
  return mm || navigator.standalone === true;
}

// iPadOS 13+ reports a Mac user agent, so a touch-capable "Mac" counts as iOS.
function isIOS() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}

async function dismissInstallBanner(bar) {
  bar.remove();
  installBannerVisible = false;
  await put("kv", { key: "installBannerDismissed", at: new Date().toISOString() });
}

function buildInstallBanner(textKey, onInstall) {
  const bar = el("div", "install-banner");
  bar.appendChild(el("div", "install-banner-text", t(textKey)));

  const actions = el("div", "install-banner-actions");
  if (onInstall) {
    const install = el("button", "btn-primary", t("install.banner.install"));
    install.type = "button";
    install.addEventListener("click", () => onInstall(bar));
    actions.appendChild(install);
  }
  const close = el("button", "link", t("common.close"));
  close.type = "button";
  close.addEventListener("click", () => dismissInstallBanner(bar));
  actions.appendChild(close);

  bar.appendChild(actions);
  document.body.appendChild(bar);
  installBannerVisible = true;
  return bar;
}

async function showPromptBanner() {
  if (!installBannerAllowed || !deferredInstallPrompt || installBannerVisible) return;
  // Re-checked here (not only at boot) because the flag may have been written
  // since: the parked event can fire long after the eligibility check.
  if (await get("kv", "installBannerDismissed")) return;
  if (installBannerVisible) return;

  buildInstallBanner("install.banner.text.android", async (bar) => {
    const prompt = deferredInstallPrompt;
    bar.remove();
    installBannerVisible = false;
    if (!prompt) return;
    try {
      prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice && choice.outcome === "accepted") {
        await put("kv", { key: "installBannerDismissed", at: new Date().toISOString() });
      }
    } catch {
      // A stale or already-consumed prompt event: nothing to recover, the
      // banner is gone either way.
    }
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showPromptBanner();
  });
}

// didOnboard: a user who just finished the wizard has seen enough dialogs for
// one visit; the banner waits until the next one.
async function setupInstallBanner(didOnboard) {
  if (didOnboard) return;
  if (isStandalone()) return;
  if (await get("kv", "installBannerDismissed")) return;

  if (isIOS()) {
    // iOS Safari never fires beforeinstallprompt: the only install path is
    // the share sheet, so the banner shows the instructions right away.
    buildInstallBanner("install.banner.text.ios", null);
    return;
  }

  installBannerAllowed = true;
  await showPromptBanner();
}

async function boot() {
  await openDB();
  await seedIfEmpty();
  // v1.5.0: existing installs pick up newly shipped library exercises here
  // (id-based merge, one run per LIBRARY_VERSION; see js/seed.js).
  await syncLibrary();
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
  const didOnboard = await onboarding.needsOnboarding(onboardedFlag);
  if (didOnboard) {
    await onboarding.mount(document.body, ctx);
  } else {
    await navigate("today");
  }

  // Both run after the screen (or the wizard) is mounted, so the notice
  // stacks over a finished screen and closing it leaves that screen intact.
  await handleUpdateNotice(didOnboard);
  await setupInstallBanner(didOnboard);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* offline layer optional in dev */ });
  }
}

boot();
