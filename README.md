# OENEXA Liquidity Service (`oenexa-liquidity`)

> **Automated Market Maker (AMM) Liquidity Pools & Smart Order Routing Engine**  
> Governed by the OENEXA FinTech Architecture & Liquidity Engineering Organizations.

## 1. Domain Ownership
This repository authoritatively owns the **Liquidity & AMM Pool Domain**:
- **Owned Data**: Liquidity Pools (e.g. `ONXC-USDT`, `ONXC-ETH`), LP Share Tokens, Pool Reserves (`reserveA`, `reserveB`), Swap Routing Graphs.
- **Owned APIs**: `POST /v1/liquidity/pools`, `POST /v1/liquidity/add`, `POST /v1/liquidity/remove`, `POST /v1/liquidity/swap`.
- **Database Boundary**: Isolated `oenexa-liquidity-prod-db`. Zero shared databases.

## 2. AMM Formula & Slippage Controls
- **Invariant**: Constant-product invariant $(x + \Delta x \cdot (1 - \phi)) \cdot (y - \Delta y) = k$, with swap fee $\phi = 0.3\%$.
- **Slippage Protection**: Explicit `minOutputAmount` checks preventing sandwich attacks and MEV frontrunning.
