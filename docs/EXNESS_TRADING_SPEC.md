# AI Forex Hub — Exness Trading Specification

## Product modes
1. Manual: user reviews a generated signal and explicitly submits a trade.
2. Semi-automatic: user approves each proposed order before submission.
3. Fully automatic: a user-enabled strategy may submit orders within hard risk limits.

## Required product capabilities
- Connect and disconnect eligible Exness accounts using each user's own API credentials.
- Demo/live environment separation and prominent environment indicators.
- Account summary, instruments, market data, order and position views.
- Manual order ticket with symbol, direction, volume, order type, stop loss and take profit.
- Approval queue for semi-automatic trades.
- Automation controls, strategy selection, per-account risk limits and emergency stop.
- Trade history, execution status, rejection reasons and audit trail.
- Per-user isolation, rate limits, request idempotency and security notifications.

## Trading safety gates
- Demo is the default; live trading requires explicit opt-in and confirmation.
- Enforce per-trade risk, daily loss, maximum exposure, volume step/min/max and available margin.
- Require a protective stop loss for automated trades unless a separately reviewed strategy policy permits otherwise.
- Do not interpret request acceptance as fill confirmation.
- On timeout, reconcile order/operation status before retrying.
- Stop automation on stale prices, API/authentication failure, clock drift, risk breach or uncertain execution state.
- Never promise returns or describe any strategy as guaranteed.

## Release gates
No live trading until the official Exness signature canonicalization, Gateway discovery, account permissions, market-data subscriptions, order schemas, event/operation reconciliation and demo test suite are implemented against the current official docs.


## Approved trading universe (strict whitelist)
The only permitted trading symbols are:

| Category | Exact Exness symbol |
|---|---|
| Forex | `EURUSDm`, `GBPUSDm`, `AUDUSDm`, `NZDUSDm`, `USDCADm`, `USDCHFm`, `USDJPYm` |
| Gold | `XAUUSDm`, `XAUUSD247m` |
| Silver | `XAGUSDm` |
| Crypto | `BTCUSDm` |

Enforce this allowlist server-side before signal publication, order validation and execution. The frontend may display the same list for usability, but must never be the security boundary. Reject unknown symbols even if a client submits them directly. Preserve the exact broker symbol suffixes; do not silently map to unsuffixed symbols. Any addition or removal requires an explicit product-owner change and a matching backend test.
