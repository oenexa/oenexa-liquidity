export interface Pool {
  id: string;
  tokenA: string;
  tokenB: string;
  reserveA: number;
  reserveB: number;
  totalLpShares: number;
  feePercent: number; // e.g. 0.3% = 0.003
}

export interface SwapQuote {
  poolId: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  expectedOutputAmount: number;
  feeAmount: number;
  priceImpactPercent: number;
}

export interface SwapResult {
  txId: string;
  poolId: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  effectivePrice: number;
  timestamp: string;
}
