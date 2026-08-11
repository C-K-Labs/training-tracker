# Roadmap

Single source of truth for project status and what comes next. Update this
file at the end of every working session.

## Status (2026-08-11 evening, v1.3.1 + v1.3.2)

Two same-day follow-ups after the user's real-device test, both deployed
and live-verified (commits e9d232e, a976134; sw v18):

- v1.3.1 NEW: onboarding step 0 gained "코드로 복원" - the user's exact
  blocked flow (code from Safari, fresh home-screen PWA container, no way
  to enter it). Restore adopts the code on the new device; onboarding file
  import now accepts .ttpack. NEW: completed sessions are editable in the
  log - per-exercise set weight/reps/hold/effort with add/delete set, and
  cardio minutes/distance/HR/RPE/note; deep-copy buffers (cancel is
  lossless), guests stay read-only, stats/suggestions pick edits up
  automatically. User confirmed both work on the phone.
- v1.3.2 FIX: iOS auto-zoom on input focus (inputs now 16px, the Safari
  threshold; .field rule carries its own copy since it outranks the global
  selector) and double-tap-zoom misfires on rapid set-logging taps
  (touch-action: manipulation on controls). Pinch zoom kept (a11y).
- Known minor gaps parked for later: edited reps still display the
  program's targetReps in the log summary line (editor does not expose
  targetReps yet); generated-course program names are Korean literals in
  all languages (gen.js SPLIT_BY_DAYS); the install banner overlays the
  last card's content instead of pushing it up.

## Status (2026-08-11, v1.3.0)

v1.3.0 deployed and live-verified (commits 92d6ff6 + d88a9dc, sw v16), on
top of the v1.1.2 (ja/zh, 6 languages) and v1.2.0 (warm-up ramp, tier rest
defaults, out-of-order flow) releases earlier the same week. Theme: user
communication + data portability, after deciding AGAINST store publication
(fees; PWA link distribution covers both platforms).

- Backend: Cloudflare Worker (worker/, deployed at
  training-tracker-api.ck-labs.workers.dev, account subdomain ck-labs).
  /feedback files issues into the PRIVATE repo C-K-Labs/training-tracker-
  feedback (read them with `gh issue list` there; that is the user-feedback
  inbox for bugfix work). /backup stores opaque encrypted blobs only.
  GitHub fine-grained token (Issues RW on that repo only, expires
  2027-08-11 - RENEW BEFORE THEN) lives in wrangler secrets. Free plan:
  hard caps, no billing risk.
- In-app feedback form (settings): type + message + optional contact, no
  login, rate-limited, honeypot server-side.
- E2EE cloud backup: device-generated sync code -> PBKDF2 310k -> AES-GCM
  key + 128-bit slot id (js/crypto.js); server cannot read backups; slots
  expire 180 days after last write; restore adopts the code on the second
  device. File backup now .ttpack (same JSON inside; imports .ttpack+.json),
  iOS share sheet on touch devices, advanced row.
- Install banner (iOS instructions / Android+desktop real install prompt,
  standalone-suppressed, dismissal persisted) + per-version update notice +
  settings about card with full ko/en changelog (js/version.js is the
  single source of version truth; bump APP_VERSION + CHANGELOG + sw cache
  each release so users get the notice).
- Verification: 89 node tests (new: i18n 6-language parity guard, crypto
  roundtrip/tamper); three delegated UI builds each browser-verified; live
  prod pass after deploy (update notice, install banner with real
  beforeinstallprompt, cloud backup roundtrip + delete from the real
  origin, 0 console errors). Security: change-scoped review of the Worker
  (2 Medium + 4 Low found, all fixed same day incl. the E2EE redesign;
  baseline in the skillset home reports\).

## Status (2026-08-06)

v1.1.1 polish batch complete and deployed on top of v1.1:

- Log detail marks unperformed exercises 미수행 instead of "0x8"; cardio
  sessions gained their missing delete link (was unreachable, real defect);
  trend selector lists current-program exercises first; program editor
  field edits autosave silently (structural actions still toast); warm-up
  sets open at 50% of target snapped to inventory; daily check covers five
  pain areas (knee, low back, shoulder, elbow, wrist); calisthenics quick
  log supports hold-seconds mode; deleting a library exercise warns with
  usage counts and every surface renders 삭제된 운동 for orphaned ids.
- Tab-bar overlap item closed as not-reproducible (measured clearances
  23-59px at max scroll in three scenarios, including with the rest bar).
- 72 node tests green; i18n parity 364 keys x 4 languages; browser-verified
  per item via CDP.

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
3. ~~Polish backlog~~ RESOLVED 2026-08-06 (v1.1.1, see top).
4. ~~v1.1 candidates~~ RESOLVED: pain areas, hold-time, cardio delete, and
   orphaned-exercise handling shipped in v1.1.1 (2026-08-06).
5. ~~i18n~~ RESOLVED: en/es/pt filled in v1.1 group E (2026-08-05).
6. Before promoting the app publicly (not needed for personal use): run the
   web-launch playbook (dependency-audit, security-check-stack,
   launch-check) and polish the README.
7. ~~Later: Capacitor wrap if a store app is ever wanted~~ DECIDED
   2026-08-11: no store publication (Play $25 + 12-tester gate, Apple
   $99/yr + 4.2 risk); PWA link distribution instead. Revisit only if
   real user demand appears through the feedback inbox.
8. v1.4 SCOPE SETTLED (2026-08-11 evening, user approved the shape; start
   here next session with a design proposal for the push part):
   - Web push via the existing Worker: rest-end / next-set notifications
     ("휴식 끝. 다음: 스쿼트 80kg 3세트") scheduled at rest-start, updated
     per set. Lands on the lock screen AND mirrors to ALL four watch
     ecosystems with zero per-watch code, because watches mirror phone
     notifications: Apple Watch (iOS 16.4+ installed-PWA push mirrors like
     any app; needs phone screen off + watch worn), Suunto Run (has
     notification mirroring per its user guide), Garmin (Connect smart
     notifications), Galaxy/Wear OS (per-app mirroring). iOS precondition:
     home-screen install + notification permission. SuuntoPlus app path is
     OBSOLETE - mirroring covers it. True live lock-screen progress
     (Live Activity style) is native-only and stays out.
     Design notes for the Worker scheduler: needs delayed delivery
     (rest timers are ~90-150s, finer than cron's 1-minute grain) - look
     at Durable Object alarms on the free plan vs client-side re-push.
   - Localize generated-course program names (gen.js SPLIT_BY_DAYS Korean
     literals; user packs unaffected, only non-Korean generator users see
     it - confirmed real but narrow 2026-08-11).
   - Expose targetReps in the session editor (summary line still shows
     program target after editing reps).
   - Install banner pushes content up instead of overlaying the last card.
   - EXCLUDED by user decision: Android Web Bluetooth HR.
   - PENDING user decision: body-composition trend smoothing (moving
     average over daily noise) - explained, awaiting yes/no.
9. Operational: GitHub token for the feedback Worker expires 2027-08-11;
   regenerate and `wrangler secret put GITHUB_TOKEN` before then.

## How to resume a session

- Tests: `node --test tests/rules.test.mjs tests/gen.test.mjs
  tests/i18n.test.mjs tests/crypto.test.mjs` (run from project root).
- User feedback inbox: `gh issue list --repo C-K-Labs/training-tracker-feedback`
- Worker deploy: `npx wrangler deploy` in worker\ (only when the Worker
  itself changes; app deploys never require it).
- Local run: `py -m http.server` in the project root, open localhost.
- Deploy: commit to master, `git push` (Pages rebuilds automatically).
- Data model and rules: js/store.js (schemas + sanitizers), js/rules.js
  (all training rules, pure and unit-tested).
- The personal pack in exports/ is the seed for any fresh device; it never
  enters the repo. The user's phone holds its own IndexedDB copy; remind
  about Settings > 전체 기록 내보내기 backups.
- Design reference: approved mockup artifact
  https://claude.ai/code/artifact/19ae6f1f-02af-4b5c-8593-73a4a442f7cd
