# Exness Trader API integration

## Scope
This repository adds a server-side foundation for per-user Exness connections. It does not yet execute trades or claim a successful live API connection.

## Security model
- The browser must never receive a user's Exness private signing key after submission.
- The Worker encrypts each private key with AES-GCM using a 32-byte key supplied as the Cloudflare secret `CREDENTIALS_ENCRYPTION_KEY` (base64 encoded).
- User isolation is enforced by a verified HS256 bearer JWT. The identity provider must issue tokens with a stable `sub` claim and matching shared secret.
- Never use Vite `VITE_*` variables for signing/encryption secrets.
- Do not log request bodies, signatures, API keys, private keys or decrypted credentials.
- The current connection endpoint stores credentials with status `pending_validation`; it does not call Exness yet.

## Worker routes
- `GET /health`: service health only.
- `POST /api/exness/connections`: authenticated encrypted credential registration. JSON: `apiKeyId`, `privateSigningKey`, `accountId`, `gateway` (HTTPS origin), optional `environment` (`demo` or `live`).
- `GET /api/exness/connections`: list only the authenticated user's non-secret connection metadata.
- `DELETE /api/exness/connections/:id`: delete only the authenticated user's connection.
- `/api/exness/trading/*`: deliberately returns 503 until the official API adapter is completed and certified.

## Required before actual Exness connectivity
1. Implement the exact current Exness Public Trader API request-signing algorithm and all required headers from the official docs.
2. Implement Access Point/Gateway discovery from the documented discovery service; do not trust arbitrary client-supplied hosts in production.
3. Implement secure private-key parsing and Ed25519 signing using the exact Exness canonical request format.
4. Validate account ownership and permissions with a read-only demo request.
5. Verify response signatures and handle clock skew, rate limits, retries and idempotency.
6. Implement market data, order, position and operation-status adapters from the current official API schema.
7. Test all trading flows on a demo account, including ambiguous timeouts and duplicate-submit prevention.
8. Add risk controls, per-user automation consent, kill switch, audit trails and live-account confirmation.
9. Have the Exness account/API eligibility and applicable programme terms confirmed before enabling production use.

## Authentication contract
The Worker expects `Authorization: Bearer <JWT>`. JWTs must use HS256 with the Cloudflare secret `AUTH_JWT_SECRET`, include `sub` and a future `exp`. This is an integration contract, not a complete user-authentication product. Connect it to the app's real identity provider before exposing the Worker publicly.

## Cloudflare setup
1. Create a D1 database named `ai-forex-hub`.
2. Replace the placeholder `database_id` in this folder's `wrangler.toml`.
3. Apply the migration with `wrangler d1 migrations apply ai-forex-hub --remote --config workers/exness/wrangler.toml`.
4. Set secrets on the Worker: `wrangler secret put AUTH_JWT_SECRET --config workers/exness/wrangler.toml` and `wrangler secret put CREDENTIALS_ENCRYPTION_KEY --config workers/exness/wrangler.toml`.
5. Generate the encryption key locally with a cryptographically secure random 32-byte generator and base64-encode it. Store a backup securely; losing it makes stored credentials unrecoverable.
6. Deploy with `wrangler deploy --config workers/exness/wrangler.toml`.
7. Connect the frontend to the Worker URL only after authentication is integrated.

## Frontend deployment
The existing Vite site remains on Cloudflare Pages, connected to GitHub branch `main` (or a reviewed merge). Build command: `bun run build`; output: `dist`. The Worker is deployed separately.


## Demo-only pre-trade risk gate (implemented; not an execution service)
- `POST /api/exness/risk/validate` is authenticated and validates a proposed order without submitting it.
- It rejects symbols outside the central 11-symbol allowlist, all live-environment proposals, invalid direction/price/volume inputs, missing protective stop-loss values, risk above 2% per trade, and daily-loss settings above 3%.
- A successful response explicitly returns `execution: "not_submitted"`. This endpoint is a policy pre-check, not a broker order validator.
- It does not calculate actual cash risk or margin because trusted broker instrument metadata (tick size/value, contract size, volume steps and margin rules) is not yet connected.
- Before any order route is enabled, add tests for every rejection case and positive case, load trusted instrument metadata from Exness, calculate monetary exposure, enforce aggregate open-risk and daily realised/unrealised loss, add idempotency and audit records, then certify all flows on demo.
- Automated strategies must pass through this gate and a separate user-consent/kill-switch policy. This endpoint does not run a bot or place trades.
