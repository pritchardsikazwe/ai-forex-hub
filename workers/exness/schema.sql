CREATE TABLE IF NOT EXISTS exness_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  api_key_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  gateway_origin TEXT NOT NULL,
  private_key_ciphertext TEXT NOT NULL,
  private_key_iv TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('demo','live')),
  status TEXT NOT NULL DEFAULT 'pending_validation',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exness_connections_user ON exness_connections(user_id, created_at);