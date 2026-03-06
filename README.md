# Market Compass

Intraday technical analysis dashboard for futures markets.
Combines ICT (Inner Circle Trader) methodology, Murphy intermarket analysis, and Linda Bradford Raschke's short-term trading principles into a single real-time interface.

---

## Supported Assets

| Symbol | Name | Exchange |
|--------|------|----------|
| NQ=F | Nasdaq 100 Futures | CME |
| ES=F | S&P 500 Futures | CME |
| GC=F | Gold Futures | COMEX |
| SI=F | Silver Futures | COMEX |
| CL=F | Crude Oil Futures | NYMEX |

## Analysis Engine

Each asset is analyzed across two timeframes (4H and 15m) with the following priority stack:

1. **HTF Structure (40 pts)** — 4H trend direction, BOS / CHoCH / MSS detection
2. **Liquidity Position (30 pts)** — BSL / SSL levels, nearest Bull/Bear Order Block
3. **ICT PD Array (20 pts)** — FVG, OB, premium / discount zone alignment
4. **Indicator Confirmation (10 pts)** — EMA(20/50/200), RSI, MACD, VWAP, ATR

Intermarket context (NQ–SP500 correlation, Gold–Silver relative strength, Oil risk sentiment) is computed separately and used as supplementary context only — it never overrides price structure signals.

Each analysis produces:
- Direction verdict: 상승 / 하락 / 중립
- Probability score: 0–100 (weighted, rule-based)
- Primary scenario with entry zone, stop, targets, and invalidation
- Alternative scenario
- Risk warnings (data limits, event risks)

---

## Getting Started

### Prerequisites

- Node.js 22+
- npm

### Run locally

```bash
# Clone
git clone https://github.com/1lI1IlI11Il/NQGDdirection.git
cd NQGDdirection

# Install dependencies
cd server && npm install && cd ..
cd client && npm install && cd ..

# Start both server and client
bash start.sh
```

- Frontend: http://localhost:5173
- API server: http://localhost:3001

---

## Data Refresh — Live / Eco Mode

The header provides three controls:

| Control | Description |
|---------|-------------|
| `● Live · 1m` | Live mode ON — fetches every **60 seconds** (default) |
| `○ Eco · 3m` | Eco mode OFF — fetches every **180 seconds** |
| `↻` | Manual immediate refresh |
| `next Xs` | Countdown to next automatic fetch |

**Why Eco mode?** Yahoo Finance is a public API with no official rate limit. Running at 60-second intervals for extended periods risks IP-based throttling, especially on shared hosting (e.g., Vercel). Eco mode reduces API calls to 1/3, significantly lowering the risk of being blocked.

| Mode | Calls/hour | Calls/day (12h) | Calls/month |
|------|-----------|-----------------|-------------|
| Live (1m) | 120 | 1,440 | 43,200 |
| Eco (3m) | 40 | 480 | 14,400 |

---

## Project Structure

```
NQGDdirection/
├── client/                         # React + Vite frontend
│   └── src/
│       ├── App.tsx                 # Tab-based UI shell + Live/Eco toggle
│       ├── hooks/
│       │   └── useMarketData.ts    # Data fetching (5 symbols × 2 timeframes, configurable interval)
│       ├── lib/
│       │   ├── indicators.ts       # VWAP, RSI, MACD, Bollinger, EMA(20/50/200), ATR
│       │   ├── ictAnalysis.ts      # Swing, OB, FVG, liquidity, BOS/CHoCH/MSS, P/D zone
│       │   ├── intermarket.ts      # Cross-asset correlation analysis
│       │   └── scenarioGenerator.ts# Probability scoring, scenario/invalidation builder
│       ├── components/
│       │   ├── Chart/
│       │   │   └── MarketChart.tsx # Candlestick + overlay chart
│       │   └── DirectionPanel/
│       │       ├── directionBias.ts    # Full analysis orchestrator
│       │       └── DirectionPanel.tsx  # 9-section analysis UI
│       └── __tests__/              # Vitest — 14 scenario-based tests
└── server/                         # Hono API server
    └── src/
        ├── index.ts                # Server entry
        └── routes/market.ts        # Yahoo Finance proxy
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 19 + TypeScript |
| Build tool | Vite 6 |
| Styling | Tailwind CSS 4 |
| Backend | Hono (Node.js) |
| Data source | Yahoo Finance (via server proxy) |
| Charts | lightweight-charts |
| Testing | Vitest (14 tests) |

---

## UI Navigation

### Asset tabs (top)
Click any asset tab to switch the view. Each tab shows:
- Colored dot — current structural bias (green = bullish, red = bearish, gray = ranging)
- Direction arrow — ▲ / ▼ / ─

### Timeframe sub-tabs (per asset)
Switch between **15m** (intraday entry) and **4H** (higher timeframe trend) within the selected asset.

---

## Analysis Output Format

Each Direction Panel shows 9 sections:

1. **요약** — Asset, direction, probability score, one-line conclusion
2. **시장 구조** — HTF trend, LTF structure, BOS/CHoCH/MSS events, liquidity location
3. **ICT 체크** — BSL/SSL, FVG count, Order Block range, Premium/Discount zone
4. **보조지표** — EMA alignment, RSI, MACD histogram, VWAP position
5. **인터마켓** — NQ–SP500 correlation, Gold–Silver relative strength, Oil sentiment
6. **트레이드 시나리오** — Primary: entry, stop, targets, invalidation
7. **대체 시나리오** — Reversal conditions and response plan
8. **리스크 경고** — Data limitations, event risk (CPI, FOMC, NFP, etc.)
9. **최종 판정** — 상승 / 하락 / 중립 with 3-sentence rationale

---

## Vercel Deployment Notes

The frontend (static build) deploys to Vercel without changes. The Hono server requires conversion to Vercel Serverless Functions via `@hono/vercel` adapter.

**Free tier feasibility (single user, 12h/day, Eco mode):**

| Metric | Usage | Free limit | Status |
|--------|-------|-----------|--------|
| Function invocations | ~14,400/month | 100,000/month | ✅ |
| Function duration | ~1.6 GB-hours | 100 GB-hours | ✅ |
| Bandwidth | ~1 GB/month | 100 GB/month | ✅ |
| Build minutes | ~60 min/month | 6,000 min/month | ✅ |

> This tool is for analysis and educational purposes only. Nothing here constitutes investment advice.
