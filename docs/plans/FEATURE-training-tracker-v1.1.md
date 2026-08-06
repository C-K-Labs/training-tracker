# Feature Plan: training-tracker v1.1

Locked plan. Approved by the user on 2026-08-05 after three consultation
rounds, a design mockup review, and an evidence-checked program analysis.
Execution is autonomous against this document; deploy happens per group.

## Spec

- Goal: absorb the first real-gym-session feedback into the app. Timer-driven
  session flow, correct units everywhere, richer records (cardio, water,
  protein, body composition), program intelligence (methods, variant targets,
  goal-based generation, onboarding), and guest-profile data separation.
- Users: the owner (Korean, kg-familiar gym with lb equipment) and friends
  who may receive the app or share packs (e.g. runner without a HR watch).
- Out of scope this pass: watch interface (native app track, roadmap note
  only), training methods beyond pyramid/superset/dropset (data model must
  stay extensible), es/pt beyond dictionary fill.
- Success criteria: every acceptance item below verified in the browser;
  node test suite green; per-group deploys live on GitHub Pages.

### Acceptance checklist

- [x] A1 Saving a working set auto-starts a rest countdown in a bar above
      the tab bar; timestamp-based (survives screen off/reload); vibration
      plus beep at zero; +30s and skip controls.
- [x] A2 Rest duration: global default (90s) with per-exercise overrides;
      settings copy recommends 2-3 min compounds, 1-1.5 min isolation.
- [x] A3 Display unit setting both/kg/lb affects all load displays and
      inputs; stored values never change; "both" shows converted + original.
- [x] A4 Inventory editor: min/max/step range generator plus per-chip
      toggle and manual add; suggestions use enabled chips only.
- [x] B1 Run records generalized to cardio with activity selection
      (running, cycling, rowing, swimming, hiking, walking, custom); HR
      optional; RPE chips (easy/normal/hard); pace auto-computed from
      time+distance; existing run sessions migrated to cardio/running.
- [x] B2 Daily check gains water cups (cup=250ml, editable target, guide
      not cap, overshoot allowed) stored per day.
- [x] B3 Protein target = latest bodyweight x coefficient, shown under
      bodyweight; coefficient setting documents ranges (1.2-1.6 general,
      1.6-2.2 hypertrophy, 1.8-2.7 cutting, g/kg; lb-mode shows g/lb
      equivalents 0.54-0.73 / 0.73-1.0 / 0.82-1.22).
- [x] B4 Bodyweight unit setting (kg/lb) independent of load display unit;
      governs bodyweight entry and protein coefficient display; storage
      stays kg.
- [x] B5 Bodyweight entries accept optional body fat percent and skeletal
      muscle mass; stats show tiles + trend for both; analysis sentence
      based on lean-mass change appears only with 2+ data points.
- [x] B6 Stats: weekly cardio minutes vs WHO 150-300 moderate band.
- [x] C1 Program items accept method normal/pyramid/superset/dropset;
      picker shows one-line tradeoffs; session screen renders set structure
      accordingly (pyramid ramps, superset alternates with rest at pair end,
      dropset chains descending loads from inventory steps).
- [x] C2 Exercise variants carry a target-emphasis label feeding session
      display and the weekly body-part balance stats.
- [x] C3 Rule-based generator: goal x days/week x experience x equipment x
      session length -> split template (full-body/upper-lower/PPL) with
      sessions; volume within 10-20 sets/part/week; main lifts 2x/week;
      rest defaults 2-3 min compounds, 1-1.5 min isolation; pure functions
      with node tests.
- [x] C4 Onboarding wizard on first run without data: import branch or
      5-question flow (goal, days/week, experience, equipment, session
      minutes) ending in a generated course preview the user can edit.
- [x] D1 Pack import offers merge-into-mine or view-as-guest; guest
      profiles are read-only, switchable in log/stats, deletable, and
      excluded from my stats, suggestions, and backups.
- [x] E1 en dictionary filled; es/pt filled; terminology must be what
      lifters actually use in each language (verified list below).
- [x] E2 Generator exercise catalog localized with real names
      (e.g. en Lat Pulldown / es jalon al pecho / pt puxada alta).

## Design Decisions (from consultation)

1. Rest timer: global default + per-exercise override; auto-start on set
   save; timestamp-based; vibration+sound; +30s/skip. (round 1)
2. Units: store original units untouched; global display unit both/kg/lb
   ("both" = converted + original); inputs accepted in display unit and
   converted back to storage unit. (rounds 1, mockup round 2)
3. Inventory: range generator + individual chip editing. (round 1)
4. Profiles: my-data + read-only guest profiles; minimal schema change.
   (round 1)
5. Water: daily check, cup taps, configurable target labeled as a guide
   (EFSA: adult male total ~2.5L/day incl. food, ~2L from fluids; more on
   training days); overshoot allowed. (round 2, accuracy review)
6. Protein: configurable coefficient with documented ranges; corrected
   cutting range 1.8-2.7 g/kg BW (the 2.3-3.1 figure is per kg FFM, Helms
   2014); coefficient display follows the bodyweight unit (g/kg or g/lb).
   (round 2 + user addition 2026-08-05)
7. Course generation: rule-based template generator, offline, testable.
   (round 2)
8. Methods: pyramid/superset/dropset only, extensible model. (round 3)
9. Variant target labels integrated into balance stats. (round 3)
10. Onboarding: standard 5 questions. (round 3)
11. Cardio: HR optional, RPE primary intensity, pace auto-calc. (mockup
    feedback)
12. i18n: fill en/es/pt with real gym terminology; no literal translations.
    (user addition 2026-08-05)
13. Deploy per group; watch excluded (roadmap note).

Approved mockup: https://claude.ai/code/artifact/4620ce7d-cfa7-4df0-9607-14451a0c7f8b
(production implementation should match its structure and states).

## Personal program change (approved, evidence-checked)

Additions: leg curl (machine), dumbbell RDL (new movement, learning
protocol: 20-25 lb/hand, hinge technique, no load progression for 2-3
weeks), pec deck fly, close-grip lat pulldown (variant exercise).
Removed from programs (kept in library/history): front raise, leg press.
Sessions keep 8 items, 2 per part, ~18 sets/part/week, main lifts 2x/week,
heavy/high-rep undulation preserved. Hamstrings now trained directly 2x/week
(the audited gap). Applied to exports/program-pack.json.

## Architecture

- js/store.js: settings schema additions (displayUnit, bodyweightUnit,
  restDefault, restOverrides, proteinCoef, waterTargetMl, activeProfile);
  DB v2 migration: profileId on sessions/bodyweight (default "me"), cardio
  kind migration (run -> cardio + activity), bodyweight optional bodyFatPct
  / muscleMassKg, water store keyed by date, profiles registry in kv.
- js/rules.js: unit conversion + formatting, rest resolution, pyramid/
  dropset load laddering, generator (pure, tested). New tests in
  tests/rules.test.mjs.
- js/ui/today.js: rest bar, method-aware set flow, cardio form, water card,
  protein line.
- js/ui/settings.js: units, rest, inventory editor, protein/water,
  profiles, program method picker, regenerate course.
- js/ui/stats.js: body comp tiles/trend/analysis, cardio minutes band,
  variant-aware balance.
- js/ui/log.js: profile switcher chips, cardio rendering.
- js/onboarding.js (new): first-run wizard using the generator.
- js/i18n.js: fill en/es/pt.
- sw.js: bump cache version per deploy.

## Task Checklist (grouped; deploy after each group)

- [x] G-A Usability (delegate): store settings + unit/rest rules + tests;
      rest bar; display-unit formatting everywhere; inventory editor.
      Verify: node tests, browser walk of A1-A4.
- [x] G-B Records (delegate): DB v2 migration (profileId groundwork +
      cardio + body comp + water); cardio UI; water card; protein line;
      bodyweight unit; stats additions. Verify: node tests, migration
      round-trip on seeded data, B1-B6.
- [x] G-C Intelligence (delegate): methods model + session rendering;
      variant emphasis labels + balance integration; generator + tests;
      onboarding wizard; settings regenerate. Verify: C1-C4.
- [x] G-D Profiles (delegate): guest import path, switcher, exclusions,
      delete. Verify: D1 with a second pack.
- [x] G-E i18n (delegate + supervisor terminology review): fill en/es/pt.
      Verify: E1-E2 spot check against the approved terminology list.
- [x] Pack update (direct, done first): program-pack.json per approved
      program.
- [x] Final gate: full browser e2e of acceptance list, security-check on
      the complete diff, ROADMAP.md update, final deploy.

## Approved terminology anchors for E (verified by supervisor)

en: Lat Pulldown, Seated/Standing Cable Row, Romanian Deadlift (RDL),
Leg Curl, Leg Press, Hip Thrust, Pec Deck Fly, Incline Dumbbell Press,
Overhead Press, Lateral Raise, Reverse Pec Deck, Pull-up, Dips, Warm-up set,
Working set, Superset, Drop set.
es: jalon al pecho, remo en polea, peso muerto rumano, curl femoral,
prensa de piernas, hip thrust, aperturas en contractora (pec deck), press
inclinado con mancuernas, press militar, elevaciones laterales, dominadas,
fondos, serie de calentamiento, serie efectiva, superserie, serie descendente.
pt: puxada alta, remada baixa/na polia, levantamento terra romeno, mesa
flexora, leg press, elevacao pelvica, crucifixo na maquina (peck deck),
supino inclinado com halteres, desenvolvimento, elevacao lateral, barra
fixa, mergulho nas paralelas, serie de aquecimento, serie valida,
bi-serie/superserie, drop set.

## Risks / Open Questions

- DB migration is the riskiest step; G-B must include a pre-migration
  export prompt and idempotent upgrade path.
- Rest-timer audio on iOS requires a user gesture to unlock AudioContext;
  fall back to vibration+visual if audio is blocked.
- Dropset laddering depends on inventory steps; when no lower step exists,
  fall back to bodyweight/skip with a hint.
- Guest profile exclusion must be enforced in every aggregate (stats,
  suggestions, backup); add a shared query helper to avoid misses.
