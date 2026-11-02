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


## Official Ed25519 signing and Gateway discovery (implemented; requires demo validation)
- `workers/exness/src/signing.ts` builds the documented `EXN-API-KEY`, `EXN-IDEMPOTENCY-KEY`, `EXN-TIMESTAMP`, `EXN-SIGN-VERSION`, `EXN-DATA` and `EXN-SIGN` headers.
- The signed payload includes the exact uppercase method, exact origin-relative path and query, timestamp in milliseconds, protocol version 1, idempotency key, and SHA-256 body hash. Ed25519 signs the decoded JSON payload bytes; header payload/signature values use unpadded base64url.
- The helper accepts the Exness-generated 128-character hex private-key format (64-byte seed + public key, using the seed for PKCS#8 import) or an unencrypted PKCS#8 PEM private key generated by the customer.
- `POST /api/exness/connections/:id/discover` decrypts the user's stored key server-side and signs `GET /v1/trading/access-point?account_id=...` against the saved Gateway host. The Gateway and returned Access Point are restricted to HTTPS Exness domains.
- `POST /api/exness/connections/:id/validate` performs Gateway discovery and then signs `GET /v1/configuration/accounts/{account_id}/account` against the returned Access Point. It verifies the account ID and required settings fields, then returns only safe account metadata (name, currency, leverage, trade mode, account status and execution mode). No balance, positions, or orders are requested.
- The validation endpoint is read-only and does not persist/cache the Access Point. The separate `/discover` route remains available for discovery-only checks.
- The API key, private signing key and Gateway must be obtained from the user's Exness Key Management screen. Never use example hostnames as production fallbacks.
- Signing tests run in CI using `bun run test:exness`; they verify a generated Ed25519 signature and reject invalid mutation idempotency keys and duplicate query parameter names.

### Current limitations
This is a signing, discovery and read-only account-validation implementation, not proof of a working Exness account connection. It has not yet been run against a real user's Exness Gateway or account. The worker route must be deployed with D1 and secrets configured, and tested with a demo API key that has read access. No trading order endpoint has been enabled.


### Read-only account validation
The `POST /api/exness/connections/:id/validate` endpoint is the recommended connection test. It first discovers the account Access Point from the configured Gateway, then reads the account configuration from that Access Point using the official account-details endpoint. A successful result confirms the API key can read the selected account configuration. `trade_mode` (`enabled` or `trading_disabled`) and `account_status` (`active` or `close_only`) are reported independently; neither state activates trading in Kopela. The route deliberately does not request balance, positions, or place orders.

### Read-only trading snapshot
`GET /api/exness/connections/:id/snapshot` rediscovers the account Access Point, verifies the account configuration, and requests `GET /v1/trading/accounts/{account_id}/snapshot`. The endpoint returns the provider's `account_state`, current open `positions`, and open `orders` without modifying them. If Exness reports `trade_mode=trading_disabled`, the endpoint returns a clear unavailable status instead of attempting the snapshot. Monetary fields are passed through as returned by Exness; Kopela does not yet derive equity, free margin, margin level, or risk figures from incomplete or assumed fields. This route remains read-only and trading stays disabled.

### Kopela demo onboarding UI
The Broker Terminal now provides a demo-only onboarding form. It posts the API key ID, account ID, official Gateway host and private signing key to the configured HTTPS Worker using the user's application bearer token. The Worker encrypts the private key before storing it in D1. The UI then calls the read-only `/validate` route and, on success, requests the read-only `/snapshot` route. The private signing key field is cleared after the create request. The Worker API sends CORS headers only for `https://pritchardsikazwe.github.io`; local development requires a separately configured trusted origin before browser requests will work. The frontend still requires a valid application JWT compatible with the Worker `AUTH_JWT_SECRET`; the app's sign-in provider is not yet wired to issue that token. Use demo credentials only. Do not paste credentials into chat or use the Exness trading password.
