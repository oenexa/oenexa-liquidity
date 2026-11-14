import crypto from 'node:crypto';
import type { Pool, SwapQuote, SwapResult } from '../domain/types.js';

export class AmmLiquidityService {
  private pools = new Map<string, Pool>();

  constructor() {
    // Seed default ONXC / USDT liquidity pool: 1,000,000 ONXC & 2,582,000 USDT (Price = 2.582)
    this.createPool('ONXC', 'USDT', 1_000_000, 2_582_000);
  }

  public createPool(tokenA: string, tokenB: string, reserveA: number, reserveB: number): Pool {
    const id = `${tokenA.toUpperCase()}-${tokenB.toUpperCase()}`;
    const totalLpShares = Math.sqrt(reserveA * reserveB);

    const pool: Pool = {
      id,
      tokenA: tokenA.toUpperCase(),
      tokenB: tokenB.toUpperCase(),
      reserveA,
      reserveB,
      totalLpShares,
      feePercent: 0.003, // 0.3%
    };

    this.pools.set(id, pool);
    return pool;
  }

  public getPool(poolId: string): Pool | undefined {
    return this.pools.get(poolId.toUpperCase());
  }

  /**
   * Calculates AMM swap output using constant product: (x + dx*(1-fee))*(y - dy) = k
   */
  public getQuote(poolId: string, inputToken: string, inputAmount: number): SwapQuote {
    const pool = this.pools.get(poolId.toUpperCase());
    if (!pool) throw new Error(`Pool '${poolId}' does not exist.`);
    if (inputAmount <= 0) throw new Error('Input amount must be positive.');

    const token = inputToken.toUpperCase();
    const isTokenA = token === pool.tokenA;
    if (!isTokenA && token !== pool.tokenB) {
      throw new Error(`Token '${token}' is not part of pool '${poolId}'.`);
    }

    const [reserveIn, reserveOut] = isTokenA
      ? [pool.reserveA, pool.reserveB]
      : [pool.reserveB, pool.reserveA];
    const outputToken = isTokenA ? pool.tokenB : pool.tokenA;

    const feeAmount = inputAmount * pool.feePercent;
    const inputWithFee = inputAmount - feeAmount;

    // dy = (y * dx_with_fee) / (x + dx_with_fee)
    const expectedOutputAmount = (reserveOut * inputWithFee) / (reserveIn + inputWithFee);

    const initialPrice = reserveOut / reserveIn;
    const executionPrice = expectedOutputAmount / inputAmount;
    const priceImpactPercent = Math.max(0, ((initialPrice - executionPrice) / initialPrice) * 100);

    return {
      poolId: pool.id,
      inputToken: token,
      outputToken,
      inputAmount,
      expectedOutputAmount: parseFloat(expectedOutputAmount.toFixed(6)),
      feeAmount: parseFloat(feeAmount.toFixed(6)),
      priceImpactPercent: parseFloat(priceImpactPercent.toFixed(2)),
    };
  }

  /**
   * Executes atomic token swap with slippage protection
   */
  public swap(
    poolId: string,
    inputToken: string,
    inputAmount: number,
    minOutputAmount: number
  ): SwapResult {
    const quote = this.getQuote(poolId, inputToken, inputAmount);
    if (quote.expectedOutputAmount < minOutputAmount) {
      throw new Error(
        `Slippage exceeded: expected ${quote.expectedOutputAmount}, minimum required was ${minOutputAmount}.`
      );
    }

    const pool = this.pools.get(poolId.toUpperCase())!;
    const isTokenA = inputToken.toUpperCase() === pool.tokenA;

    if (isTokenA) {
      pool.reserveA += inputAmount;
      pool.reserveB -= quote.expectedOutputAmount;
    } else {
      pool.reserveB += inputAmount;
      pool.reserveA -= quote.expectedOutputAmount;
    }

    return {
      txId: `swp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      poolId: pool.id,
      inputToken: quote.inputToken,
      outputToken: quote.outputToken,
      inputAmount,
      outputAmount: quote.expectedOutputAmount,
      effectivePrice: parseFloat((quote.expectedOutputAmount / inputAmount).toFixed(6)),
      timestamp: new Date().toISOString(),
    };
  }
}
