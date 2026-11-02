import { validateRiskProposal } from "./risk";
import { APPROVED_EXNESS_SYMBOLS } from "./symbols";
import { exnessSignedFetch } from "./signing";
export interface Env {
  DB: D1Database;
  CREDENTIALS_ENCRYPTION_KEY: string;
  AUTH_JWT_SECRET: string;
  EXNESS_API_BASE_URL?: string;
}
type Claims = { sub: string; exp: number; iss?: string; aud?: string };

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const b64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
const toB64 = (a: Uint8Array) => btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
async function authenticate(req: Request, env: Env): Promise<Claims | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !env.AUTH_JWT_SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.AUTH_JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, b64u(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!valid) return null;
  try { const claims = JSON.parse(new TextDecoder().decode(b64u(parts[1]))) as Claims; return claims.sub && claims.exp * 1000 > Date.now() ? claims : null; } catch { return null; }
}
async function encryptionKey(env: Env) {
  const raw = Uint8Array.from(atob(env.CREDENTIALS_ENCRYPTION_KEY), c => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("CREDENTIALS_ENCRYPTION_KEY must be base64-encoded 32-byte key");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encrypt(value: string, env: Env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env), new TextEncoder().encode(value));
  return { ciphertext: toB64(new Uint8Array(cipher)), iv: toB64(iv) };
}
async function decrypt(ciphertext: string, ivValue: string, env: Env) {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64u(ivValue) },
    await encryptionKey(env),
    b64u(ciphertext)
  );
  return new TextDecoder().decode(plain);
}
function safeGateway(value: string) {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password || u.pathname !== "/" || u.search || u.hash || !(u.hostname === "exness.com" || u.hostname.endsWith(".exness.com"))) throw new Error("Gateway must be an official HTTPS Exness host from Key Management");
  return u.origin;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") return json({ service: "ai-forex-hub-exness", status: "online", trading: "disabled_until_official_adapter_validation" });
    if (url.pathname.startsWith("/api/")) {
      const claims = await authenticate(req, env);
      if (!claims) return json({ error: "unauthorized" }, 401);
      if (req.method === "POST" && url.pathname === "/api/exness/connections") {
        let body: any;
        try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
        const { apiKeyId, privateSigningKey, accountId, gateway } = body ?? {};
        if (![apiKeyId, privateSigningKey, accountId, gateway].every(v => typeof v === "string" && v.trim())) return json({ error: "apiKeyId, privateSigningKey, accountId and gateway are required" }, 400);
        if (apiKeyId.length > 256 || accountId.length > 128 || privateSigningKey.length > 12000) return json({ error: "input_too_large" }, 413);
        let origin: string;
        try { origin = safeGateway(gateway); } catch { return json({ error: "invalid_gateway_origin" }, 400); }
        try {
          const sealed = await encrypt(privateSigningKey, env);
          const id = crypto.randomUUID();
          await env.DB.prepare("INSERT INTO exness_connections (id,user_id,api_key_id,account_id,gateway_origin,private_key_ciphertext,private_key_iv,environment,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
            .bind(id, claims.sub, apiKeyId.trim(), accountId.trim(), origin, sealed.ciphertext, sealed.iv, body.environment === "live" ? "live" : "demo", "pending_validation", new Date().toISOString()).run();
          return json({ id, accountId: accountId.trim(), environment: body.environment === "live" ? "live" : "demo", status: "pending_validation", message: "Credentials encrypted and stored. Live API validation is not enabled until the official Exness signing and account-discovery adapter is configured." }, 201);
        } catch (e) { return json({ error: "connection_storage_failed", detail: e instanceof Error ? e.message : "unknown" }, 500); }
      }
      if (req.method === "POST" && url.pathname.startsWith("/api/exness/connections/") && url.pathname.endsWith("/discover")) {
        const id = url.pathname.split("/")[4];
        if (!id) return json({ error: "missing_connection_id" }, 400);
        const row = await env.DB.prepare("SELECT api_key_id,account_id,gateway_origin,private_key_ciphertext,private_key_iv FROM exness_connections WHERE id=? AND user_id=?").bind(id, claims.sub).first<any>();
        if (!row) return json({ error: "connection_not_found" }, 404);
        if (!/^\\d{1,20}$/.test(row.account_id) || BigInt(row.account_id) > 18446744073709551615n) return json({ error: "invalid_account_id" }, 400);
        try {
          const privateKey = await decrypt(row.private_key_ciphertext, row.private_key_iv, env);
          const path = "/v1/trading/access-point?account_id=" + encodeURIComponent(row.account_id);
          const response = await exnessSignedFetch({
            baseUrl: row.gateway_origin,
            apiKey: row.api_key_id,
            privateKey,
            method: "GET",
            pathAndQuery: path
          });
          const payload: any = await response.json().catch(() => null);
          if (!response.ok) return json({ error: "exness_discovery_failed", upstream_status: response.status, upstream_code: payload?.error_code ?? payload?.code ?? null }, 502);
          if (payload?.account_id !== row.account_id || typeof payload?.access_point !== "string") return json({ error: "invalid_discovery_response" }, 502);
          const accessPoint = new URL(payload.access_point);
          if (accessPoint.protocol !== "https:" || !(accessPoint.hostname === "exness.com" || accessPoint.hostname.endsWith(".exness.com"))) return json({ error: "untrusted_access_point" }, 502);
          return json({ account_id: row.account_id, access_point: accessPoint.origin, status: "access_point_discovered", note: "Discovery succeeded. Account authorization and a read-only account-details check are the next validation step. No trades were placed." });
        } catch (e) {
          return json({ error: "discovery_request_failed", detail: e instanceof Error ? e.message : "unknown" }, 502);
        }
      }
      if (req.method === "GET" && url.pathname === "/api/exness/connections") {
        const rows = await env.DB.prepare("SELECT id,account_id,gateway_origin,environment,status,created_at FROM exness_connections WHERE user_id=? ORDER BY created_at DESC").bind(claims.sub).all();
        return json({ connections: rows.results ?? [] });
      }
      if (req.method === "DELETE" && url.pathname.startsWith("/api/exness/connections/")) {
        const id = url.pathname.split("/").pop();
        if (!id) return json({ error: "missing_connection_id" }, 400);
        const result = await env.DB.prepare("DELETE FROM exness_connections WHERE id=? AND user_id=?").bind(id, claims.sub).run();
        return json({ deleted: (result.meta.changes ?? 0) > 0 });
      }
      if (req.method === "GET" && url.pathname === "/api/exness/instruments") return json({ instruments: APPROVED_EXNESS_SYMBOLS, count: APPROVED_EXNESS_SYMBOLS.length, policy: "strict_allowlist" });
      if (req.method === "POST" && url.pathname === "/api/exness/risk/validate") {
        let proposal: unknown;
        try { proposal = await req.json(); } catch { return json({ error: "invalid_json", execution: "not_submitted" }, 400); }
        const decision = validateRiskProposal(proposal);
        return json(decision, decision.allowed ? 200 : 422);
      }
      if (url.pathname.startsWith("/api/exness/trading/")) return json({ error: "trading_adapter_not_enabled", message: "Order placement, position management and market-data routes remain disabled until Exness API signing, access-point discovery, response verification and demo certification are implemented." }, 503);
    }
    return json({ error: "not_found" }, 404);
  }
};