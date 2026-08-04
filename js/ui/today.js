// STUB: replaced by the today-screen implementation (plan task 5).
import { t } from "../i18n.js";

export const titleKey = "tab.today";
export const subKey = "screen.today.sub.idle";

export async function mount(root) {
  const div = document.createElement("div");
  div.className = "empty";
  div.textContent = t("common.waiting");
  root.appendChild(div);
}
