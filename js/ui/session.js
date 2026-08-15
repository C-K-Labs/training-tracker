// Session tab (v1.9.0): the weights-session screen, split out of the Today
// tab so quick logs stay reachable while a session is running. All the code
// lives in js/ui/today.js (the two screens share every helper and the rest
// bar); this module only adapts it to the screen-module contract.

export { sessionTitleKey as titleKey, sessionSubKey as subKey, mountSession as mount } from "./today.js";
