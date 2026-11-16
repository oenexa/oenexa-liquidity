import http from 'node:http';
import { AmmLiquidityService } from './service/AmmLiquidityService.js';

export * from './domain/types.js';
export * from './service/AmmLiquidityService.js';

const amm = new AmmLiquidityService();
const PORT = Number(process.env.PORT) || 8084;

export const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200);
    return res.end(JSON.stringify({ status: 'UP', service: 'oenexa-liquidity', timestamp: new Date().toISOString() }));
  }

  if (req.url?.startsWith('/api/liquidity/quote') && req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const poolId = url.searchParams.get('poolId') || 'ONXC_USDT';
    const token = url.searchParams.get('token') || 'ONXC';
    const amount = Number(url.searchParams.get('amount')) || 100;
    try {
      const quote = amm.getQuote(poolId, token, amount);
      res.writeHead(200);
      return res.end(JSON.stringify({ success: true, data: quote }));
    } catch (err: any) {
      res.writeHead(400);
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  res.writeHead(404);
  return res.end(JSON.stringify({ success: false, error: 'Endpoint Not Found' }));
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[oenexa-liquidity] Automated Market Maker Microservice listening on port ${PORT}`);
  });
}
