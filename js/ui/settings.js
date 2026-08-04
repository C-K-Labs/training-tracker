// STUB: replaced by the settings-screen implementation (plan task 8).
import { t } from "../i18n.js";

export const titleKey = "tab.settings";
export const subKey = "screen.settings.sub";

export async function mount(root) {
  const div = document.createElement("div");
  div.className = "empty";
  div.textContent = t("common.waiting");
  root.appendChild(div);
}
