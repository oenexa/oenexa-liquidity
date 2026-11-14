import { describe, it, expect } from 'vitest';
import { AmmLiquidityService } from '../service/AmmLiquidityService.js';

describe('OENEXA Automated Market Maker (AMM) Liquidity Engine', () => {
  it('initializes default ONXC-USDT liquidity pool with balanced reserves', () => {
    const service = new AmmLiquidityService();
    const pool = service.getPool('ONXC-USDT');

    expect(pool).toBeDefined();
    expect(pool?.reserveA).toBe(1_000_000);
    expect(pool?.reserveB).toBe(2_582_000);
    expect(pool?.feePercent).toBe(0.003);
  });

  it('computes accurate AMM swap quote with fee deduction', () => {
    const service = new AmmLiquidityService();
    // Swap 1,000 ONXC for USDT
    const quote = service.getQuote('ONXC-USDT', 'ONXC', 1000);

    expect(quote.inputAmount).toBe(1000);
    expect(quote.feeAmount).toBe(3); // 0.3% of 1000
    // Expected output should be approximately 2,574.26 USDT with minimal price impact
    expect(quote.expectedOutputAmount).toBeGreaterThan(2500);
    expect(quote.priceImpactPercent).toBeLessThan(0.5);
  });

  it('executes swap successfully and enforces slippage protection threshold', () => {
    const service = new AmmLiquidityService();
    const quote = service.getQuote('ONXC-USDT', 'ONXC', 1000);

    // Slippage violation test
    expect(() => {
      service.swap('ONXC-USDT', 'ONXC', 1000, quote.expectedOutputAmount + 50);
    }).toThrow(/Slippage exceeded/);

    // Successful swap
    const result = service.swap('ONXC-USDT', 'ONXC', 1000, quote.expectedOutputAmount - 10);
    expect(result.outputAmount).toBe(quote.expectedOutputAmount);
    expect(result.txId.startsWith('swp_')).toBe(true);

    const poolAfter = service.getPool('ONXC-USDT');
    expect(poolAfter?.reserveA).toBe(1_001_000);
    expect(poolAfter?.reserveB).toBe(2_582_000 - quote.expectedOutputAmount);
  });
});
