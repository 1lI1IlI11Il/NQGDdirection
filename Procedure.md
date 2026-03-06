# Development Procedure

This document covers the implementation approach, technology choices, and step-by-step development process for Market Compass.

---

## 1. Background and Objectives

### Starting Point

The original repository (`NQGDdirection`) was a basic chart dashboard that displayed Nasdaq and Gold price data with a simple Direction indicator (STRONG_BULL / BULL / NEUTRAL / BEAR / STRONG_BEAR) derived from four indicators: VWAP position, RSI level, MACD histogram sign, and Bollinger Band position.

### Problems to Solve

| Issue | Impact |
|-------|--------|
| Only 2 assets (NQ, GC) | Could not perform intermarket analysis |
| Flat indicator scoring | No prioritization between price structure and indicators |
| No ICT structure vocabulary | BOS, CHoCH, MSS, FVG were not modeled |
| No scenario output | No actionable trade context |
| Single scrolling page | Reading 5 assets of analysis was overwhelming |

### Objectives

Implement the following analytical framework into the codebase:

- **John J. Murphy** — Intermarket relationships between bonds, equities, commodities, currencies
- **Michael J. Huddleston (ICT)** — Liquidity, inducement, fair value gap, order block, premium/discount
- **Linda Bradford Raschke** — Risk-defined short-term trade scenarios with explicit invalidation

---

## 2. Repository Exploration

Before writing any code, the full repository was read via the GitHub API:

```
client/src/
  App.tsx                   ← UI shell (NQ + GC only)
  hooks/useMarketData.ts    ← fetches 15m + 1h bars for NQ=F, GC=F
  lib/indicators.ts         ← VWAP, RSI, MACD, Bollinger
  lib/ictAnalysis.ts        ← OB, FVG, swing points, liquidity
  components/DirectionPanel/
    directionBias.ts        ← 4-signal score → 5-level bias
    DirectionPanel.tsx      ← compact ICT + indicator display

server/src/routes/market.ts ← Yahoo Finance proxy (Hono)
```

Key findings:

- The implementation was **hybrid**: rule-based indicator scoring + ICT structural detection
- The existing `ictAnalysis.ts` had solid foundations (swing detection, OB detection, FVG, liquidity) but was missing BOS/CHoCH/MSS classification and premium/discount zone
- `directionBias.ts` treated all four indicators equally — no priority weighting
- The `useMarketData` hook hardcoded only two symbols

---

## 3. Architecture Design

### Priority Stack (implemented in `scenarioGenerator.ts`)

```
Priority 1 — HTF Structure       (40 points)
  4H structureBias: BULLISH=+40, BEARISH=-40, RANGING=0

Priority 2 — Liquidity Position  (30 points)
  nearestBullOB present + below price  → +15
  nearestBearOB present + above price  → -15
  Bullish FVGs > bearish FVGs          → +15
  Bearish FVGs > bullish FVGs          → -15

Priority 3 — ICT PD Array        (20 points)
  LTF structureBias aligns with HTF   → +20 or -20
  Opposing                             → partial reduction

Priority 4 — Indicator Confirm   (10 points)
  DirectionSignal.score mapped to ±10
```

Indicators can confirm but never override price structure. A score ≥ 55 → 상승, ≤ 45 → 하락, 46–54 → 중립.

### Module Boundaries

```
indicators.ts       → pure calculation, no state
ictAnalysis.ts      → price structure analysis
intermarket.ts      → cross-asset context (supplementary only)
scenarioGenerator.ts → scoring + scenario assembly
directionBias.ts    → orchestrates all modules, exposes FullDirectionResult
```

---

## 4. Implementation Process

Development was executed using **Pumasi** — a parallel development workflow where Claude acts as PM/designer and Codex CLI instances execute the implementation tasks concurrently.

### Round 1 — New Foundations (3 tasks in parallel)

| Task | File | What was added |
|------|------|----------------|
| indicators-ema-atr | `indicators.ts` | `calculateEMAValues`, `calculateATR`, `getEMAAlignment`, extended `IndicatorResults` |
| intermarket-analysis | `intermarket.ts` (new) | `analyzeIntermarket`, `computeAssetSnapshot`, correlation logic |
| scenario-generator | `scenarioGenerator.ts` (new) | `computeProbabilityScore`, `generateScenarios`, `buildAnalysisReport`, `detectDataLimitations` |

### Round 2 — Core Logic Extension (3 tasks in parallel)

| Task | File | What was added |
|------|------|----------------|
| ict-analysis-extend | `ictAnalysis.ts` | `detectStructureShifts` (BOS/CHoCH/MSS), `computePremiumDiscountZone`, `computeEMAContext` |
| direction-bias-extend | `directionBias.ts` | `computeFullAnalysis`, `FullDirectionResult` |
| market-data-expand | `useMarketData.ts` | Added SI=F, CL=F, ES=F; `SUPPORTED_SYMBOLS` constant |

### Round 3 — UI and Tests (3 tasks in parallel)

| Task | File | What was added |
|------|------|----------------|
| direction-panel-ui | `DirectionPanel.tsx` | 9-section full analysis view |
| app-expand | `App.tsx` | 5-asset support, `computeFullAnalysis` wiring |
| test-suite | `src/__tests__/` | 14 scenario-based tests |

After all rounds: tab-based navigation was added to `App.tsx` (asset tabs + timeframe sub-tabs) and README / Procedure documentation was written.

---

## 5. Instrumentation and Verification

### Gates per task (automated)

Each Codex task was given shell-command gates that had to pass before the task was marked done:

- File existence check (`[ -f path ]`)
- Key export/type grep (`grep -q 'FunctionName'`)
- TypeScript compile (`npx tsc --noEmit --skipLibCheck`)
- Vite production build (`npm run build`)

### Final verification

```
npx tsc --noEmit   → 0 errors
npm run build      → ✓ built in 1.99s
npx vitest run     → 14/14 tests passed
```

Test scenarios covered:

| Case | Module |
|------|--------|
| Bullish — HTF+LTF aligned, OB present | scenarioGenerator |
| Bearish — HTF+LTF aligned, OB present | scenarioGenerator |
| Neutral — both RANGING | scenarioGenerator |
| Data missing — 0 bars | scenarioGenerator |
| Conflicting signals — HTF vs LTF diverge | scenarioGenerator |
| Event risk — eventRisks propagated | scenarioGenerator |
| BOS detection | ictAnalysis |
| CHoCH detection | ictAnalysis |
| Premium zone | ictAnalysis |
| Discount zone | ictAnalysis |
| NQ–SP500 converging | intermarket |
| NQ–SP500 diverging | intermarket |
| Missing asset handling | intermarket |
| Majority bias conclusion | intermarket |

---

## 6. Design Decisions

### Why indicators are confirmation-only (10 pt weight)

Murphy's framework and ICT methodology both place price structure above derived indicators. Indicators are lagging — they confirm what price structure has already shown. Giving them 10/100 points ensures they can tip a borderline case but cannot reverse a clear structural signal.

### Why intermarket is supplementary

Intermarket relationships (Murphy) operate on higher timeframes (daily / weekly). Using them to override intraday (15m / 4H) price structure would introduce false reversals. The current design makes them visible and informative without giving them decision weight.

### Why graceful degradation matters

Yahoo Finance data can be incomplete or delayed for some symbols. Every analysis step checks for null/undefined inputs and either produces a `'확인 필요'` marker or skips the field rather than throwing or producing a misleading output.

### Tab UI vs. scrolling

Five assets × two timeframes × 9 analysis sections = substantial content. A tab-based approach (asset tab → timeframe sub-tab) reduces cognitive load by surfacing one asset at a time. The bias dot and direction arrow on each tab give a quick status overview without switching.

---

## 7. File Change Summary

| File | Type | Change |
|------|------|--------|
| `client/src/lib/indicators.ts` | Modified | +EMA(20/50/200), +ATR |
| `client/src/lib/ictAnalysis.ts` | Modified | +BOS/CHoCH/MSS, +PremiumDiscount, +EMAContext |
| `client/src/lib/intermarket.ts` | New | Full intermarket module |
| `client/src/lib/scenarioGenerator.ts` | New | Scoring + scenario engine |
| `client/src/components/DirectionPanel/directionBias.ts` | Modified | +computeFullAnalysis |
| `client/src/components/DirectionPanel/DirectionPanel.tsx` | Modified | 9-section UI |
| `client/src/hooks/useMarketData.ts` | Modified | 5 symbols, typed constants |
| `client/src/App.tsx` | Modified | Tab navigation, 5 assets |
| `client/src/__tests__/*.test.ts` | New | 14 tests (3 files) |
| `client/package.json` | Modified | +vitest devDependency |

Total: +2,804 lines inserted, 85 lines removed across 13 files.

---

## 8. Remaining Improvement Areas

- **Kill zone timing**: Session context (London / NY open) is not yet wired into the analysis — the system prompt supports it but the UI has no session clock input
- **Manual event risk input**: CPI / FOMC / NFP dates could be fetched from an economic calendar API and surfaced automatically
- **Historical backtesting**: The scoring model is deterministic and could be backtested against historical OHLCV data to calibrate weights
- **Breaker / mitigation block detection**: `ictAnalysis.ts` detects OBs but does not yet distinguish between breaker blocks and mitigation blocks
- **EMA slope**: `getEMAAlignment` returns alignment state but not slope — slope (rising / falling) would add signal quality
