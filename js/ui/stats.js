// STUB: replaced by the stats-screen implementation (plan task 7).
import { t } from "../i18n.js";

export const titleKey = "tab.stats";
export const subKey = "screen.stats.sub";

export async function mount(root) {
  const div = document.createElement("div");
  div.className = "empty";
  div.textContent = t("common.waiting");
  root.appendChild(div);
}
