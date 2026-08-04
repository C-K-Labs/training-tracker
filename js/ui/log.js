// STUB: replaced by the log-screen implementation (plan task 6).
import { t } from "../i18n.js";

export const titleKey = "tab.log";
export const subKey = "screen.log.sub";

export async function mount(root) {
  const div = document.createElement("div");
  div.className = "empty";
  div.textContent = t("common.waiting");
  root.appendChild(div);
}
