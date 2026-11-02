import { describe, expect, test } from "bun:test";
import { buildExnessSignedHeaders } from "../src/signing";

const decode = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)), c => c.charCodeAt(0));
};

describe("Exness request signing", () => {
  test("creates a verifiable Ed25519 signature and exact GET headers", async () => {
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const privateDer = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
    const publicRaw = await crypto.subtle.exportKey("raw", pair.publicKey);
    const pem = "-----BEGIN PRIVATE KEY-----\n" + btoa(String.fromCharCode(...privateDer)) + "\n-----END PRIVATE KEY-----";
    const headers = await buildExnessSignedHeaders({
      apiKey: "exnsk-test-key",
      privateKey: pem,
      method: "GET",
      pathAndQuery: "/v1/trading/access-point?account_id=123456",
      timestamp: 1770000000000
    });
    const payloadBytes = decode(headers["EXN-DATA"]);
    const signature = decode(headers["EXN-SIGN"]);
    const publicKey = await crypto.subtle.importKey("raw", publicRaw, { name: "Ed25519" }, false, ["verify"]);
    expect(await crypto.subtle.verify({ name: "Ed25519" }, publicKey, signature, payloadBytes)).toBe(true);
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    expect(payload.path).toBe("/v1/trading/access-point?account_id=123456");
    expect(payload.idempotency_key).toBe("");
    expect(headers["EXN-IDEMPOTENCY-KEY"]).toBe("");
    expect(payload.sign_version).toBe(1);
  });

  test("requires a non-empty idempotency key for mutations", async () => {
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
    const pem = "-----BEGIN PRIVATE KEY-----\n" + btoa(String.fromCharCode(...der)) + "\n-----END PRIVATE KEY-----";
    await expect(buildExnessSignedHeaders({
      apiKey: "exnsk-test-key", privateKey: pem, method: "POST",
      pathAndQuery: "/v1/trading/accounts/123/orders", body: "{}", idempotencyKey: "bad key"
    })).rejects.toThrow("idempotency key");
  });

  test("rejects duplicate query parameter names", async () => {
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
    const pem = "-----BEGIN PRIVATE KEY-----\n" + btoa(String.fromCharCode(...der)) + "\n-----END PRIVATE KEY-----";
    await expect(buildExnessSignedHeaders({
      apiKey: "exnsk-test-key", privateKey: pem, method: "GET",
      pathAndQuery: "/v1/test?a=1&a=2"
    })).rejects.toThrow("Duplicate query");
  });
});
