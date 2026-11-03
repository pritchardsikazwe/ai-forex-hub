CREATE TABLE IF NOT EXISTS robot_settings (
  user_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  strategies_json TEXT NOT NULL DEFAULT '{"scalping":false,"dayTrading":true,"swingTrading":false}',
  risk_per_trade REAL NOT NULL DEFAULT 1 CHECK (risk_per_trade >= 0.1 AND risk_per_trade <= 2),
  daily_loss_limit REAL NOT NULL DEFAULT 3 CHECK (daily_loss_limit >= 0.5 AND daily_loss_limit <= 3),
  updated_at TEXT NOT NULL
);
