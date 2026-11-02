import { APPROVED_EXNESS_SYMBOLS } from "./index";

export type RiskProposal = {
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  riskPercent: number;
  dailyLossPercent: number;
  environment: "demo" | "live";
  automated?: boolean;
};

export type RiskDecision =
  | { allowed: true; normalized: RiskProposal; checks: string[]; execution: "not_submitted" }
  | { allowed: false; reason: string; execution: "not_submitted" };

const reject = (reason: string): RiskDecision => ({ allowed: false, reason, execution: "not_submitted" });

/**
 * Pre-trade policy gate only. This module never places orders.
 * Broker-specific tick value, contract size, volume step and margin checks
 * must be added from trusted Exness instrument metadata before execution.
 */
export function validateRiskProposal(input: unknown): RiskDecision {
  if (!input || typeof input !== "object" || Array.isArray(input)) return reject("invalid_proposal");
  const p = input as Record<string, unknown>;
  const { symbol, side, volume, entryPrice, stopLoss, takeProfit, riskPercent, dailyLossPercent, environment } = p;

  if (typeof symbol !== "string" || !(APPROVED_EXNESS_SYMBOLS as readonly string[]).includes(symbol)) return reject("symbol_not_approved");
  if (side !== "buy" && side !== "sell") return reject("invalid_side");
  if (environment !== "demo" && environment !== "live") return reject("invalid_environment");
  if (environment === "live") return reject("live_execution_disabled");
  if (![volume, entryPrice, stopLoss, riskPercent, dailyLossPercent].every(v => typeof v === "number" && Number.isFinite(v) && v > 0)) return reject("invalid_numeric_input");
  if ((volume as number) <= 0) return reject("invalid_volume");
  if ((riskPercent as number) > 2) return reject("risk_per_trade_exceeds_2_percent");
  if ((dailyLossPercent as number) > 3) return reject("daily_loss_limit_exceeds_3_percent");

  const entry = entryPrice as number;
  const sl = stopLoss as number;
  if (side === "buy" && sl >= entry) return reject("buy_stop_loss_must_be_below_entry");
  if (side === "sell" && sl <= entry) return reject("sell_stop_loss_must_be_above_entry");

  if (takeProfit !== undefined) {
    if (typeof takeProfit !== "number" || !Number.isFinite(takeProfit) || takeProfit <= 0) return reject("invalid_take_profit");
    if (side === "buy" && takeProfit <= entry) return reject("buy_take_profit_must_be_above_entry");
    if (side === "sell" && takeProfit >= entry) return reject("sell_take_profit_must_be_below_entry");
  }

  const normalized: RiskProposal = {
    symbol, side, volume: volume as number, entryPrice: entry, stopLoss: sl,
    ...(typeof takeProfit === "number" ? { takeProfit } : {}),
    riskPercent: riskPercent as number, dailyLossPercent: dailyLossPercent as number,
    environment: "demo", automated: p.automated === true
  };
  return {
    allowed: true,
    normalized,
    checks: ["approved_symbol", "demo_environment_only", "protective_stop_present", "risk_limit_within_policy", "daily_loss_limit_within_policy"],
    execution: "not_submitted"
  };
}
