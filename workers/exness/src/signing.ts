const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).split("+").join("-").split("/").join("_").split("=").join("");

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)), c => c.charCodeAt(0));
}

function privateKeyPkcs8(value: string): Uint8Array {
  const trimmed = value.trim();
  if (/^[0-9a-fA-F]{128}$/.test(trimmed)) {
    const seed = trimmed.slice(0, 64).match(/.{2}/g)!.map(v => parseInt(v, 16));
    // RFC 8410 PKCS#8 wrapper around the 32-byte Ed25519 seed.
    return new Uint8Array([0x30,0x2e,0x02,0x01,0x00,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x04,0x22,0x04,0x20,...seed]);
  }
  const pem = trimmed.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "");
  const der = decodeBase64(pem);
  // PKCS#8 Ed25519 DER is 48 bytes and can be imported directly.
  if (der.length === 48 && der[0] === 0x30) return der;
  if (der.length === 32) {
    return new Uint8Array([0x30,0x2e,0x02,0x01,0x00,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x04,0x22,0x04,0x20,...der]);
  }
  return der;
}

async function sha256Base64Url(body: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(body))));
}

export async function buildExnessSignedHeaders(args: {
  apiKey: string;
  privateKey: string;
  method: string;
  pathAndQuery: string;
  body?: string;
  idempotencyKey?: string;
  timestamp?: number;
}): Promise<Record<string, string>> {
  const method = args.method.toUpperCase();
  if (!args.pathAndQuery.startsWith("/") || args.pathAndQuery.startsWith("//")) throw new Error("Signed path must be an origin-relative path");
  const parsed = new URL(args.pathAndQuery, "https://signing.invalid");
  if (parsed.origin !== "https://signing.invalid") throw new Error("Invalid signed path");
  const keys = [...parsed.searchParams.keys()];
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate query parameters are not allowed");
  const idempotencyKey = method === "GET" ? "" : (args.idempotencyKey ?? crypto.randomUUID());
  if (method !== "GET" && !/^[A-Za-z0-9._~-]{5,128}$/.test(idempotencyKey)) throw new Error("A valid idempotency key is required for mutating requests");
  const timestamp = args.timestamp ?? Date.now();
  const body = args.body ?? "";
  const payload = {
    api_key: args.apiKey,
    idempotency_key: idempotencyKey,
    timestamp,
    sign_version: 1,
    method,
    path: args.pathAndQuery,
    body_hash: await sha256Base64Url(body)
  };
  const payloadBytes = enc.encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey("pkcs8", privateKeyPkcs8(args.privateKey), { name: "Ed25519" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, key, payloadBytes));
  return {
    "EXN-API-KEY": args.apiKey,
    "EXN-IDEMPOTENCY-KEY": idempotencyKey,
    "EXN-TIMESTAMP": String(timestamp),
    "EXN-SIGN-VERSION": "1",
    "EXN-DATA": b64url(payloadBytes),
    "EXN-SIGN": b64url(signature)
  };
}

export async function exnessSignedFetch(args: {
  baseUrl: string;
  apiKey: string;
  privateKey: string;
  method: string;
  pathAndQuery: string;
  body?: string;
  idempotencyKey?: string;
}): Promise<Response> {
  const headers = await buildExnessSignedHeaders(args);
  if (args.body !== undefined) headers["content-type"] = "application/json";
  return fetch(new URL(args.pathAndQuery, args.baseUrl).toString(), {
    method: args.method.toUpperCase(),
    headers,
    ...(args.body !== undefined ? { body: args.body } : {})
  });
}
