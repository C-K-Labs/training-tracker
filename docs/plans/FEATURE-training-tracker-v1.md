# Feature Plan: Training Tracker v1

Status: complete 2026-08-04. All 11 tasks done; integration gate passed
(browser e2e on every acceptance criterion, node unit tests 19/19,
change-scoped security review clean). Real-session success criterion pending
the user's next actual gym visit.
Design mockup (approved): https://claude.ai/code/artifact/19ae6f1f-02af-4b5c-8593-73a4a442f7cd

## Spec

**Goal.** A mobile-first PWA that records training sessions with minimal taps
and automatically applies the program rules documented in
`training-program-reference.md` (progression, recovery loading, volume
balance), replacing per-session chat logging.

**Users.** The owner initially; structured for open-source release later, so
the app ships neutral and all personal data lives in a separate imported pack.

**In scope (v1).**
- Weight session logging: per-set weight/reps/effort (hard/normal/easy),
  warm-up sets distinct from working sets, session timer via start/end
  timestamps.
- Running log: duration, pace or speed, average HR.
- Calisthenics log: exercises (planche progressions, L-sit, push-ups), hold
  times or reps.
- Body-weight log (Saturday fasted protocol noted in UI).
- Next-load suggestion from effort ratings, snapped to gym-specific available
  weights.
- Recovery mode: auto-suggested after a 14+ day gap, 83% of last load,
  weeks 1-2 hold, week 3 return; manual toggle always available.
- Exercise variants as distinct tracking keys (e.g. lat pulldown upright vs
  45-degree); balance check aggregates by parent exercise's body part.
- Weekly volume balance per body part vs the 10-20 set range, Monday-start
  calendar week.
- Daily checks: sleep hours, condition 1-5, per-area pain 0-3, heat flag,
  protein target check, free note.
- Program pack import (JSON: exercise library + program templates + optional
  load history) and full-history JSON export.
- Korean UI via an i18n string layer (en/es/pt planned, structure only in v1).
- Theme: follows system, manual light/dark override in settings.
- Installable PWA with offline support (manifest + service worker).

**Out of scope (v1).** Backend/accounts/sync, detailed nutrition tracking,
additional languages' translations, native app packaging, GitHub Pages
deployment (separate web-launch playbook when ready).

**Success criterion.** One real gym session recorded phone-in-hand from
warm-up to last set, with a next-load suggestion and balance view afterward.

**Acceptance criteria.** (verified 2026-08-04, browser e2e + unit tests)
- [x] A weights session can be started from a program template, every set
      logged with weight/reps/effort, and finished with duration recorded.
      (e2e: session A, 2 warm-ups + 3 working sets, timer, persisted schema)
- [x] Effort pattern produces the correct next-load suggestion snapped to the
      configured inventory. (unit tests for all branches; e2e: all-easy at
      90 lb suggested and applied 95 lb to the program)
- [x] With a last-session date 14+ days old, the app proposes recovery mode
      and prescribes 83% loads rounded to available weights. (e2e: 39-day gap
      detected, 90 lb prescribed as 70 lb)
- [x] Variants track separate load histories. (variant = separate exercise id;
      trend selector lists them individually)
- [x] Balance view shows Monday-week sets per body part against the 10-20
      band. (e2e: legs 3 sets after the test session)
- [x] Running, calisthenics, and body-weight entries can be logged and appear
      in the log/stats. (e2e: run + body-weight saved and verified in IDB)
- [x] A program pack JSON imports cleanly; a full export re-imports without
      loss. (e2e import toast 20/3/10; export file round-trip counts match;
      settings excluded from packs by design, device-specific)
- [x] Works offline after first load. (e2e: server stopped, full app served
      from service-worker cache) Installable: manifest + 192/512 icons + SW
      present; store-grade install prompt not testable headless.
- [x] All UI strings resolve through the i18n layer. (workers' missing-key
      reports resolved; remaining literal is the pain-area data key)
- [x] Data persists across browser restart (IndexedDB + persist() requested;
      data survived reloads throughout e2e).

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Storage | IndexedDB (thin promise wrapper, no deps) + navigator.storage.persist() | User prioritized robustness and app-grade future; larger quota, SW-compatible |
| Code structure | ES modules, no build step | Serves as-is on GitHub Pages; rules testable in node |
| PWA | Manifest + cache-first service worker in v1 | Gym connectivity is poor; offline is a precondition of real use |
| Seed/import | JSON program pack, same format as export | One serializer; app ships neutral for open source; personal pack stays gitignored |
| Next-load rule | Simple state rule from reference 3.7 (stabilize then add) + >3%/month overshoot warning | Predictable mid-workout; user chose over percentage math |
| Inventory | Per-equipment-type increments + per-exercise overrides | One-time setup; handles leg press max 280 lb case |
| Recovery | Auto-suggest at 14+ day gap + manual toggle | Matches reference 3.6 protocol; user keeps control |
| Variants | Variant = separate tracking key; balance aggregates by body part | Different pull angles use different loads; accurate per-variant progression |
| Balance week | Monday-start calendar week | Program is Mon/Wed/Fri; intuitive "this week" |
| Screens | Bottom tabs: 오늘 / 기록 / 통계 / 설정 | Standard one-thumb mobile pattern |
| UI language | Korean first through i18n dictionary layer | en/es/pt planned; no literals in screen code |
| Terminology | Category is "맨몸운동" (calisthenics); planche is an exercise within it | User correction 2026-08-04 |
| Theme | System default + manual override, token-based CSS | Approved in mockup |
| Accent | Energy orange/amber; dark-mode chart colors #CE7513/#2EA97A/#E85D4A, light #E56910/#22A06B/#C9372C | Validated with dataviz palette script on both surfaces |
| Effort levels | 힘듦/보통/여유 stored as hard/normal/easy | User's three-level request; chips always carry text labels (CVD-safe) |
| Daily checks | Condition, pain, auto timer, nutrition all included | User selected all four proposals |
| Units | Store {value, unit, convention} per exercise (per-hand, excludes-bar, stack, bodyweight) | Preserves reference.md conventions; display in native gym units |

## Architecture

```
training/
  index.html            app shell, tab nav, screen containers
  css/app.css           design tokens (from mockup) + components
  js/
    app.js              entry, tab routing, screen mounting
    store.js            IndexedDB wrapper, schema, export/import, migrations
    rules.js            PURE functions: nextLoad, recoveryLoad, snapToInventory,
                        weeklyBalance, gapDays, overshootWarning
    i18n.js             t(key) dictionary layer, ko strings (en/es/pt slots)
    seed.js             neutral default exercise library + empty program
    ui/today.js         session flow, set entry, daily checks, timer
    ui/log.js           history list + detail
    ui/stats.js         SVG charts (load trend, balance, body weight)
    ui/settings.js      inventory, program editor, import/export, language/theme
  sw.js                 cache-first service worker
  manifest.json         PWA manifest + icons
  tests/rules.test.mjs  node --test unit tests for rules.js
  docs/plans/           this document
```

**Data model (IndexedDB stores).**
- `exercises`: { id, name, bodyPart, equipment, unit, loadConvention,
  variant, spinalLoad } — variant included in identity.
- `programs`: { id, name, kind: weights|run|calisthenics, items: [{
  exerciseId, sets, reps|max, targetLoad, warmupSets }] }
- `sessions`: { id, date, programId, kind, recovery, startedAt, endedAt,
  daily: { sleepH, condition, pain: {area: 0-3}, heat, proteinOk, note },
  entries: [{ exerciseId, sets: [{ weight, reps, effort, warmup }] }] }
- `bodyweight`: { date, kg, fasted }
- `settings`: { inventory: { dumbbells[], plateMin, cableStep,
  overrides: {exerciseId: steps[] | max} }, language, theme, recoveryRule:
  { gapDays: 14, factor: 0.83 }, lastBackupAt }

**Program pack JSON** = { formatVersion, exercises[], programs[],
history?: sessions[], bodyweight?[] }. Export = same shape with everything.
Import modes: replace or merge (by id+date).

**rules.js is pure** (no DOM, no storage) so node --test covers progression,
recovery, snapping, and balance math directly.

## Task Checklist

| # | Task | Touches | Verification | Size/Route |
|---|---|---|---|---|
| 1 | App shell: index.html, css tokens from mockup, tab router | index.html, css, js/app.js | Serve locally, tabs switch, both themes render | small, direct |
| 2 | store.js: IDB wrapper, schema, export/import round-trip | js/store.js | node cannot run IDB: verified in task 10 e2e; shape unit-tested where pure | medium, direct |
| 3 | rules.js pure functions + tests | js/rules.js, tests/ | node --test green (progression, 83%, snap, balance, gap) | medium, direct + test-gen |
| 4 | i18n.js + ko dictionary | js/i18n.js | grep screens for hardcoded literals = none | small, direct |
| 5 | Today screen: session flow, set entry, timer, daily checks, recovery banner | js/ui/today.js | Browser: record a full mock session | large, delegate |
| 6 | Log screen: grouped history + detail | js/ui/log.js | Browser: imported history renders | medium, delegate |
| 7 | Stats screen: trend chart, balance bars, body weight | js/ui/stats.js | Browser: charts match mockup in both themes | medium, delegate |
| 8 | Settings screen: inventory editor, program editor, import/export, language/theme | js/ui/settings.js | Browser: change inventory, see suggestion snap change | large, delegate |
| 9 | PWA: manifest, icons, service worker | sw.js, manifest.json | Lighthouse-style check: installable, offline reload works | small, direct |
| 10 | Personal program pack generated from reference.md into exports/ (gitignored) | exports/program-pack.json | Import in app; history chart shows 4-6월 data | small, direct |
| 11 | Integration gate: /verify full flow, security-check on diff, acceptance checklist | - | All acceptance boxes checked | gate |

Checkpoint skills: test-gen after task 3 and after UI logic lands;
security-check on the import/export surface (file parsing) before the gate.

## Risks / Open Questions

- iOS/Safari can evict site data under pressure even with persist();
  mitigation: prominent export backup + lastBackupAt nudge.
- Session timer across screen lock: derive from timestamps, never intervals.
- Bar-weight exclusion convention must be visible in UI labels to avoid the
  documented 160 lb misread recurring.
- Program editor kept minimal in v1 (reorder, sets/reps/load edit); full
  exercise CRUD may slip to v1.1 if it inflates task 8.
- Deployment to GitHub Pages intentionally deferred to the web-launch
  playbook (dependency-audit, security stack, launch-check).
