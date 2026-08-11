# Training Tracker Worker

Cloudflare Worker backing the PWA: relays in-app feedback to GitHub issues in
the private repo `C-K-Labs/training-tracker-feedback`, and stores opt-in cloud
backups under sync codes in Workers KV.

## Endpoints

- `POST /feedback` body `{type, message, contact?, meta?, website?}` (honeypot
  field `website` must stay empty). Rate limit: 5/hour/IP.
- `POST /backup` body `{slot, blob}`. `slot` is a client-derived 32-hex-char
  id, `blob` is opaque ciphertext (the app encrypts with AES-GCM using a key
  derived from the sync code; this server cannot read backups). First write
  claims the slot; later writes overwrite it. Max blob 1.4M chars. Slots
  expire 180 days after the last write (refreshed on every backup).
- `GET /backup?slot=<32 hex>` returns `{blob, updatedAt}`.
- `DELETE /backup?slot=<32 hex>` removes the slot.
- Backup rate limit: 20/hour/IP shared across read/write/delete.

## One-time setup

1. `npm install` (in this folder)
2. `npx wrangler login`
3. `npx wrangler kv namespace create STORE` then paste the returned id into
   `wrangler.jsonc` (`kv_namespaces[0].id`)
4. `npx wrangler secret put GITHUB_TOKEN` and paste a fine-grained PAT that has
   Issues Read+Write on `training-tracker-feedback` only. The token lives only
   in Cloudflare; never commit it anywhere.
5. `npm run deploy`

## Develop

`npm run dev` runs locally with an emulated KV. The GitHub call needs a real
token; put `GITHUB_TOKEN=...` in `.dev.vars` (gitignored) if testing feedback
locally, or test it against the deployed Worker.
