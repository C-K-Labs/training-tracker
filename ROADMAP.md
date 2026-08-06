# Roadmap

Single source of truth for project status and what comes next. Update this
file at the end of every working session.

## Status (2026-08-05)

v1.1 complete and deployed (commits 1f33154..HEAD, five feature deploys).

- Shipped from first-real-session feedback: rest countdown bar (timestamp
  based, per-exercise overrides, vibration+beep), display units both/kg/lb
  (storage untouched), dumbbell range+chip inventory editor, cardio
  generalization with run-migration (DB v2) and RPE/optional HR/auto pace,
  daily water cups vs configurable guide target, protein target from
  bodyweight x coefficient (unit-aware g/kg / g/lb, documented ranges),
  body fat / skeletal muscle tracking with lean-mass analysis, WHO weekly
  cardio band, training methods (pyramid/superset/dropset) with method-aware
  session flow, variant emphasis labels feeding balance stats, rule-based
  course generator (720-combination invariant sweep, 0 failures) + first-run
  onboarding wizard + settings regenerate, read-only guest profiles, full
  en/es/pt dictionaries with native gym terminology (353-key parity).
- Verification: 64 node tests green; per-group browser verification
  (Playwright/CDP); release-checkpoint security review clean (baseline in
  the skillset home reports\).
- Personal program updated in exports/program-pack.json (leg curl, dumbbell
  RDL, pec deck fly, close-grip pulldown in; front raise and leg press out
  of programs): REIMPORT THE PACK ON THE PHONE (merge) to pick it up, or
  edit the sessions in-app to match.
- Watch interface: excluded from v1.1 by decision; standalone watch use
  needs a native app (Wear OS/watchOS) with its own data sync. Revisit as a
  separate track if wanted.
- Plan document with all acceptance items checked:
  docs/plans/FEATURE-training-tracker-v1.1.md
- v1.1 design mockup artifact:
  https://claude.ai/code/artifact/4620ce7d-cfa7-4df0-9607-14451a0c7f8b

## Status (2026-08-04)

v1 complete and deployed.

- Live app: https://c-k-labs.github.io/training-tracker/ (GitHub Pages,
  serves master root; a push to master redeploys in about a minute)
- Repo: https://github.com/C-K-Labs/training-tracker (public)
- master history: bfd2a99 bootstrap → c7e8009 foundation → ab8c180 screens
  → 3f7067e icons → 671abf4 plan-complete
- Plan document with verified acceptance criteria:
  docs/plans/FEATURE-training-tracker-v1.md

## Done (2026-08-04, single session)

1. Bootstrap: git anchor, .gitignore (secrets + exports/), project CLAUDE.md,
   README.
2. Plan: interview-driven decisions (storage, rules, inventory model, variant
   tracking, screens, i18n, theme), Artifact design mockup (approved), one
   plan approval, then autonomous execution.
3. Foundation: app shell + CSS tokens from the approved mockup (chart colors
   pass the dataviz CVD validator on both themes), IndexedDB store with
   whitelist sanitizers for pack import, pure rule engine in js/rules.js
   (19 node tests), Korean i18n layer with en/es/pt slots, PWA base
   (manifest, network-first service worker, icons).
4. Screens (4 parallel opus workers, one file each; supervisor review +
   patches): today (session flow, effort-driven next-load suggestions,
   recovery mode, daily checks, run/bodyweight/calisthenics quick logs),
   log (filtered month-grouped timeline + detail), stats (weight/week tiles,
   trend chart, weekly balance vs 10-20 band), settings (inventory, program
   and library editors, recovery rule, import/export, language/theme).
5. Personal program pack generated from training-program-reference.md into
   exports/program-pack.json (gitignored): 20 exercises with variants,
   sessions A/B/C, 10 history sessions, 2 bodyweight entries.
6. Integration gate: browser e2e covering every acceptance criterion
   (recovery 83% math, warm-up vs working set gating, suggestion applied to
   program 90→95, pack import/export round-trip, offline reload from SW
   cache, theme switching), change-scoped security review clean.
7. Deployed: gh CLI installed, repo created and pushed, Pages enabled,
   live URL verified in a real browser.

## Next

1. **First real gym session (2026-08-05).** The v1 success criterion.
   Collect friction points: input flow speed mid-set, load units, anything
   covered by the tab bar, suggestion usefulness.
2. ~~Privacy: reference doc in public history~~ RESOLVED 2026-08-04: history
   rewritten with filter-branch to drop training-program-reference.md from
   every commit, backup refs and reflog purged, force-pushed. The file now
   lives only locally (gitignored). Caveat: the repo was public for under an
   hour with the old hashes; GitHub can cache orphaned commits until its own
   GC, so treat exposure as unlikely but not provably zero.
3. Polish backlog (small):
   - Log detail renders unperformed exercises as "0×8"; hide or mark them.
   - Bottom-most interactive elements can sit under the fixed tab bar;
     add scroll padding.
   - Trend selector orders by most recent use; consider main lifts first.
   - Program editor toasts on every field change; batch or quiet it.
   - Warm-up sets open at the working load; consider a lower default.
4. v1.1 candidates: multiple pain areas in the daily check (knee only now),
   hold-time units for calisthenics (reps only now), delete path for run
   sessions in the log, orphaned-exercise handling when the library entry is
   deleted.
5. i18n: fill the en dictionary, then es/pt (structure is ready; screens
   have no hardcoded UI strings).
6. Before promoting the app publicly (not needed for personal use): run the
   web-launch playbook (dependency-audit, security-check-stack,
   launch-check) and polish the README.
7. Later: Capacitor wrap if a store app is ever wanted; export reminder
   nudge when lastBackupAt is stale.

## How to resume a session

- Tests: `node --test tests/rules.test.mjs` (run from project root).
- Local run: `py -m http.server` in the project root, open localhost.
- Deploy: commit to master, `git push` (Pages rebuilds automatically).
- Data model and rules: js/store.js (schemas + sanitizers), js/rules.js
  (all training rules, pure and unit-tested).
- The personal pack in exports/ is the seed for any fresh device; it never
  enters the repo. The user's phone holds its own IndexedDB copy; remind
  about Settings > 전체 기록 내보내기 backups.
- Design reference: approved mockup artifact
  https://claude.ai/code/artifact/19ae6f1f-02af-4b5c-8593-73a4a442f7cd
