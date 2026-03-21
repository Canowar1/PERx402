import express, { type Request, type Response } from "express";

const PORT = 9999;

const MOCK_PAY_TO = "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV";
const USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

const app = express();

app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "mock-x402-api",
    endpoints: ["/api/market-data"],
  });
});

app.get("/api/market-data", (req: Request, res: Response) => {
  const paymentHeader = req.headers["x-payment"];

  if (!paymentHeader) {
    res.status(402).json({
      scheme: "exact",
      network: "solana",
      maxAmountRequired: "100000",
      resource: `http://localhost:${PORT}/api/market-data`,
      description: "Market data API access",
      payTo: MOCK_PAY_TO,
      maxTimeoutSeconds: 60,
      asset: USDC_MINT,
      extra: {},
    });
    return;
  }

  res.status(200).json({
    symbol: "SOL/USDC",
    price: 178.42,
    volume24h: 1234567,
    timestamp: Math.floor(Date.now() / 1000),
    source: "premium-data-api",
    message: "This data was paid for privately via Shadow Proxy",
  });
});

app.listen(PORT, () => {
  console.log(`Mock x402 API server running on http://localhost:${PORT}`);
  console.log(`  Health:      GET http://localhost:${PORT}/`);
  console.log(`  Market data: GET http://localhost:${PORT}/api/market-data`);
});
