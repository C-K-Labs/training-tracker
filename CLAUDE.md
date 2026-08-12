# Training Tracker

## Stack
- Vanilla HTML/CSS/JS progressive web app (PWA). No build step, no framework.
- Deployed as a static site (GitHub Pages). Everything must work served as-is.
- All user data lives client-side (localStorage/IndexedDB) with JSON
  export/import for backup. No backend, no accounts.

## Run
- Open index.html directly in a browser, or serve the folder with any static
  server for service-worker testing (e.g. python -m http.server).

## Test
- node --test tests/rules.test.mjs tests/gen.test.mjs tests/i18n.test.mjs tests/crypto.test.mjs tests/push.test.mjs
  (run from the project root; covers the rule engine, course generator,
  i18n dictionary parity across all six languages, the cloud-backup
  crypto module, and the push client's key decoding)

## Data Conventions (from training-program-reference.md)
- Smith machine and barbell loads EXCLUDE the bar weight.
- Dumbbell loads are per hand.
- Standing cable row is logged in kilograms; everything else in pounds.
- Warm-up sets and working sets are distinct and must never be conflated.
- Bodyweight protocol: Saturday morning, fasted.

## Rules
- Personal training records must NEVER be committed to this repo. The repo
  holds code only; data stays on the user's device. Exports go to exports/
  (gitignored).
- training-program-reference.md is the source document for seed data and
  program rules. Treat it as read-only history; the app supersedes it for
  new records.
- Training-science rules hardcoded into the app (volume ranges, progression
  rates, return-from-layoff loading) must be verified against reputable
  sources (NSCA/ACSM, peer-reviewed meta-analyses, Stronger by Science,
  Renaissance Periodization) before adoption.
