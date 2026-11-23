import { describe, it, expect, beforeEach } from 'vitest';
import { AmmDoubleEntryBridge } from '../service/AmmDoubleEntryBridge.js';

describe('AmmDoubleEntryBridge Constant-Product & Balanced Ledger Postings', () => {
  let bridge: AmmDoubleEntryBridge;

  beforeEach(() => {
    bridge = new AmmDoubleEntryBridge();
  });

  it('executes swaps preserving kAfter >= kBefore and balanced debit-credit postings', () => {
    const res = bridge.executeSwapWithDoubleEntry({
      userId: 'usr_trader_amm',
      poolId: 'pool_onxc_usdt',
      reserveA: 100000, // 100,000 ONXC
      reserveB: 500000, // 500,000 USDT (Price = 5 USDT)
      assetIn: 'B', // Swapping 1,000 USDT for ONXC
      amountIn: 1000,
    });

    expect(res.amountOut).toBeGreaterThan(0);
    expect(res.journal.kAfter).toBeGreaterThanOrEqual(res.journal.kBefore);

    // Verify USDT Leg (Debits == Credits)
    const usdtPostings = res.journal.postings.filter((p) => p.asset === 'USDT');
    const usdtDebits = usdtPostings
      .filter((p) => p.direction === 'DEBIT')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const usdtCredits = usdtPostings
      .filter((p) => p.direction === 'CREDIT')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    expect(usdtDebits).toBeCloseTo(1000, 6);
    expect(usdtCredits).toBeCloseTo(1000, 6);

    // Verify ONXC Leg (Debits == Credits)
    const onxcPostings = res.journal.postings.filter((p) => p.asset === 'ONXC');
    const onxcDebits = onxcPostings
      .filter((p) => p.direction === 'DEBIT')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const onxcCredits = onxcPostings
      .filter((p) => p.direction === 'CREDIT')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    expect(onxcDebits).toBeCloseTo(res.amountOut, 6);
    expect(onxcCredits).toBeCloseTo(res.amountOut, 6);
  });
});
