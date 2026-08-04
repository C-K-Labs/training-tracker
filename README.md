# Training Tracker

A mobile-first workout tracking PWA. Records sessions against a structured
program (exercises with variant details, per-set load/reps/effort), suggests
the next load based on a three-level effort rating and gym-specific available
weights, distinguishes normal and recovery sessions, and checks weekly volume
balance per body part.

Built around the program and principles documented in
`training-program-reference.md`.

## Quickstart

No install, no build. Open `index.html` in a browser, or serve statically:

    python -m http.server

For the installable PWA experience (home screen icon, offline), serve over
HTTP(S) and use the browser's "Add to Home Screen".

## Data

All records are stored in the browser (localStorage/IndexedDB). Nothing leaves
the device. Use the in-app JSON export for backups; exported files belong in
`exports/`, which is gitignored so personal data never enters the repository.

## Configuration

No environment variables required.
