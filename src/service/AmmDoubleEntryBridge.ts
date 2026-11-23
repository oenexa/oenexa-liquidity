import crypto from 'node:crypto';

export interface LiquidityLedgerPosting {
  accountCode: string; // 1101 (Hot Vault), 2101 (Spot Liability), 2103 (Earn/Staking Liability), 4101 (LP Fees)
  userId?: string;
  asset: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: string;
}

export interface AmmSwapJournal {
  journalId: string;
  poolId: string;
  inputAsset: string;
  outputAsset: string;
  postings: LiquidityLedgerPosting[];
  kBefore: number;
  kAfter: number;
  timestamp: string;
}

export class AmmDoubleEntryBridge {
  private feeBps = 30; // 0.30% Uniswap-style fee

  public executeSwapWithDoubleEntry(params: {
    userId: string;
    poolId: string;
    reserveA: number; // e.g. ONXC
    reserveB: number; // e.g. USDT
    assetIn: 'A' | 'B';
    amountIn: number;
  }): { amountOut: number; newReserveA: number; newReserveB: number; journal: AmmSwapJournal } {
    if (params.amountIn <= 0) throw new Error('Input amount must be > 0');
    if (params.reserveA <= 0 || params.reserveB <= 0) throw new Error('Reserves must be positive');

    const kBefore = params.reserveA * params.reserveB;

    let reserveIn = params.assetIn === 'A' ? params.reserveA : params.reserveB;
    let reserveOut = params.assetIn === 'A' ? params.reserveB : params.reserveA;

    // Deduct 0.30% fee
    const amountInWithFee = params.amountIn * (10000 - this.feeBps);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 10000 + amountInWithFee;
    const amountOut = numerator / denominator;

    let newReserveA = params.assetIn === 'A' ? params.reserveA + params.amountIn : params.reserveA - amountOut;
    let newReserveB = params.assetIn === 'A' ? params.reserveB - amountOut : params.reserveB + params.amountIn;

    const kAfter = newReserveA * newReserveB;
    if (kAfter < kBefore) {
      throw new Error(`Constant product invariant violated: kAfter (${kAfter}) < kBefore (${kBefore})`);
    }

    const inAssetSymbol = params.assetIn === 'A' ? 'ONXC' : 'USDT';
    const outAssetSymbol = params.assetIn === 'A' ? 'USDT' : 'ONXC';

    // Double-Entry Postings:
    // User pays Input: Debit 2101 (Client liability decreases)
    // Pool receives Input: Credit 2103 (AMM Earn/LP reserve liability increases)
    // Pool delivers Output: Debit 2103 (AMM Earn/LP reserve liability decreases)
    // User receives Output: Credit 2101 (Client liability increases)
    const postings: LiquidityLedgerPosting[] = [
      {
        accountCode: '2101',
        userId: params.userId,
        asset: inAssetSymbol,
        direction: 'DEBIT',
        amount: params.amountIn.toFixed(8),
      },
      {
        accountCode: '2103', // AMM Earn Pool Reserve
        asset: inAssetSymbol,
        direction: 'CREDIT',
        amount: params.amountIn.toFixed(8),
      },
      {
        accountCode: '2103',
        asset: outAssetSymbol,
        direction: 'DEBIT',
        amount: amountOut.toFixed(8),
      },
      {
        accountCode: '2101',
        userId: params.userId,
        asset: outAssetSymbol,
        direction: 'CREDIT',
        amount: amountOut.toFixed(8),
      },
    ];

    // Invariant Verification per asset
    this.verifyInvariant(inAssetSymbol, postings);
    this.verifyInvariant(outAssetSymbol, postings);

    const journal: AmmSwapJournal = {
      journalId: `jrnl_swap_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      poolId: params.poolId,
      inputAsset: inAssetSymbol,
      outputAsset: outAssetSymbol,
      postings,
      kBefore,
      kAfter,
      timestamp: new Date().toISOString(),
    };

    return { amountOut, newReserveA, newReserveB, journal };
  }

  private verifyInvariant(asset: string, postings: LiquidityLedgerPosting[]): void {
    const assetPostings = postings.filter((p) => p.asset === asset);
    const debits = assetPostings
      .filter((p) => p.direction === 'DEBIT')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const credits = assetPostings
      .filter((p) => p.direction === 'CREDIT')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    if (Math.abs(debits - credits) > 0.0000001) {
      throw new Error(`AMM Double-entry imbalance for ${asset}: Debits=${debits}, Credits=${credits}`);
    }
  }
}
