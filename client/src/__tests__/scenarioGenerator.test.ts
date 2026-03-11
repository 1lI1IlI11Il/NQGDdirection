import { describe, expect, it } from 'vitest'

import type { DirectionSignal } from '../components/DirectionPanel/directionBias'
import {
  buildAnalysisReport,
  computeProbabilityScore
} from '../lib/scenarioGenerator'
import {
  getICTAnalysis,
  type FairValueGap,
  type ICTAnalysis,
  type LiquidityLevel,
  type OHLCVBar,
  type OrderBlock
} from '../lib/ictAnalysis'

function createMockBars(closes: number[], startTime: number = 1_700_000_000): OHLCVBar[] {
  return closes.map((close, index) => ({
    time: startTime + (index * 60),
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1_000 + index
  }))
}

function createSignal(score: number, lastClose: number = 100): DirectionSignal {
  return {
    bias:
      score >= 3
        ? 'STRONG_BULL'
        : score >= 1
          ? 'BULL'
          : score === 0
            ? 'NEUTRAL'
            : score <= -3
              ? 'STRONG_BEAR'
              : 'BEAR',
    score,
    signals: {
      vwap: score > 0 ? 'bull' : score < 0 ? 'bear' : 'neutral',
      rsi: 'neutral',
      macd: score > 0 ? 'bull' : score < 0 ? 'bear' : 'neutral',
      bollinger: 'neutral'
    },
    lastClose,
    vwapValue: lastClose,
    rsiValue: 50,
    macdHistogramValue: score
  }
}

function createOrderBlock(
  type: OrderBlock['type'],
  low: number,
  high: number,
  time: number
): OrderBlock {
  return {
    type,
    low,
    high,
    time,
    mitigated: false,
    label: type === 'bullish' ? 'Bull OB' : 'Bear OB'
  }
}

function createLiquidityLevel(
  price: number,
  type: LiquidityLevel['type'],
  time: number
): LiquidityLevel {
  return {
    price,
    type,
    time,
    label: `${type} @ ${price}`
  }
}

function createFvg(
  type: FairValueGap['type'],
  bottom: number,
  top: number,
  time: number
): FairValueGap {
  return {
    type,
    bottom,
    top,
    time,
    filled: false
  }
}

function createIctAnalysis(overrides: Partial<ICTAnalysis> = {}): ICTAnalysis {
  return {
    structureBias: 'RANGING',
    swingPoints: [],
    orderBlocks: [],
    fvgs: [],
    liquidityLevels: [],
    nearestBullOB: null,
    nearestBearOB: null,
    currentPrice: 100,
    structureShifts: [],
    premiumDiscount: null,
    emaContext: null,
    ...overrides
  }
}

describe('scenarioGenerator', () => {
  it('bullish case: HTF/LTF bullish with nearest bull OB produces Bullish and >= 60 probability', () => {
    const bullOrderBlock = createOrderBlock('bullish', 96, 99, 1)
    const bearOrderBlock = createOrderBlock('bearish', 108, 111, 2)
    const report = buildAnalysisReport({
      asset: 'NQ',
      timeframe: '15m',
      htfBias: 'BULLISH',
      ltfBias: 'BULLISH',
      ictAnalysis: createIctAnalysis({
        structureBias: 'BULLISH',
        orderBlocks: [bullOrderBlock, bearOrderBlock],
        fvgs: [createFvg('bullish', 101, 103, 3)],
        liquidityLevels: [
          createLiquidityLevel(104, 'BSL', 4),
          createLiquidityLevel(107, 'BSL', 5)
        ],
        nearestBullOB: bullOrderBlock,
        nearestBearOB: bearOrderBlock
      }),
      indicatorSignal: createSignal(2)
    })

    expect(report.direction).toBe('Bullish')
    expect(report.probabilityScore.direction).toBe('Bullish')
    expect(report.probabilityScore.value).toBeGreaterThanOrEqual(60)
    expect(report.primaryScenario.direction).toBe('Bullish')
  })

  it('bearish case: HTF/LTF bearish with nearest bear OB produces Bearish and >= 60 probability', () => {
    const bullOrderBlock = createOrderBlock('bullish', 89, 92, 1)
    const bearOrderBlock = createOrderBlock('bearish', 101, 104, 2)
    const report = buildAnalysisReport({
      asset: 'NQ',
      timeframe: '15m',
      htfBias: 'BEARISH',
      ltfBias: 'BEARISH',
      ictAnalysis: createIctAnalysis({
        structureBias: 'BEARISH',
        currentPrice: 95,
        orderBlocks: [bullOrderBlock, bearOrderBlock],
        fvgs: [createFvg('bearish', 97, 99, 3)],
        liquidityLevels: [
          createLiquidityLevel(93, 'SSL', 4),
          createLiquidityLevel(90, 'SSL', 5)
        ],
        nearestBullOB: bullOrderBlock,
        nearestBearOB: bearOrderBlock
      }),
      indicatorSignal: createSignal(-2, 95)
    })

    expect(report.direction).toBe('Bearish')
    expect(report.probabilityScore.direction).toBe('Bearish')
    expect(report.probabilityScore.value).toBeGreaterThanOrEqual(60)
    expect(report.primaryScenario.direction).toBe('Bearish')
  })

  it('neutral/range case: HTF/LTF ranging produces Neutral direction', () => {
    const bullOrderBlock = createOrderBlock('bullish', 96, 98, 1)
    const bearOrderBlock = createOrderBlock('bearish', 102, 104, 2)
    const report = buildAnalysisReport({
      asset: 'NQ',
      timeframe: '15m',
      htfBias: 'RANGING',
      ltfBias: 'RANGING',
      ictAnalysis: createIctAnalysis({
        structureBias: 'RANGING',
        orderBlocks: [bullOrderBlock, bearOrderBlock],
        liquidityLevels: [
          createLiquidityLevel(97, 'SSL', 3),
          createLiquidityLevel(103, 'BSL', 4)
        ],
        nearestBullOB: bullOrderBlock,
        nearestBearOB: bearOrderBlock
      }),
      indicatorSignal: createSignal(0)
    })

    expect(report.direction).toBe('Neutral')
    expect(report.primaryScenario.direction).toBe('Neutral')
  })

  it('data missing case: empty bars produce data limitations entries', () => {
    const emptyBars = createMockBars([])
    const report = buildAnalysisReport({
      asset: 'NQ',
      timeframe: '15m',
      htfBias: 'RANGING',
      ltfBias: 'RANGING',
      ictAnalysis: getICTAnalysis(emptyBars),
      indicatorSignal: createSignal(0)
    })

    expect(report.dataLimitations.length).toBeGreaterThan(0)
  })

  it('conflicting signals case: HTF bullish and LTF bearish stays in mid probability band', () => {
    const probabilityScore = computeProbabilityScore(
      'BULLISH',
      'BEARISH',
      createIctAnalysis(),
      createSignal(0)
    )

    expect(probabilityScore.value).toBeGreaterThanOrEqual(40)
    expect(probabilityScore.value).toBeLessThanOrEqual(60)
  })

  it('event risk warning: provided event risks are preserved in the report', () => {
    const bullOrderBlock = createOrderBlock('bullish', 96, 99, 1)
    const eventRisks = [
      {
        type: 'FOMC' as const,
        description: 'FOMC statement due within 30 minutes',
        severity: 'HIGH' as const
      }
    ]
    const report = buildAnalysisReport({
      asset: 'NQ',
      timeframe: '15m',
      htfBias: 'BULLISH',
      ltfBias: 'BULLISH',
      ictAnalysis: createIctAnalysis({
        structureBias: 'BULLISH',
        orderBlocks: [bullOrderBlock],
        fvgs: [createFvg('bullish', 101, 103, 2)],
        liquidityLevels: [
          createLiquidityLevel(104, 'BSL', 3),
          createLiquidityLevel(106, 'BSL', 4)
        ],
        nearestBullOB: bullOrderBlock
      }),
      indicatorSignal: createSignal(2),
      eventRisks
    })

    expect(report.eventRisks).toEqual(eventRisks)
    expect(report.finalVerdict).toContain('FOMC statement due within 30 minutes')
  })

  it('generated report copy is fully English-facing', () => {
    const bullOrderBlock = createOrderBlock('bullish', 96, 99, 1)
    const report = buildAnalysisReport({
      asset: 'NQ',
      timeframe: '15m',
      htfBias: 'BULLISH',
      ltfBias: 'BULLISH',
      ictAnalysis: createIctAnalysis({
        structureBias: 'BULLISH',
        currentPrice: 101,
        orderBlocks: [bullOrderBlock],
        fvgs: [createFvg('bullish', 101, 103, 2)],
        liquidityLevels: [createLiquidityLevel(104, 'BSL', 3)],
        nearestBullOB: bullOrderBlock,
      }),
      indicatorSignal: createSignal(2, 101)
    })

    expect(report.direction).toBe('Bullish')
    expect(report.finalVerdict).toMatch(/^[^가-힣]*$/)
    expect(report.primaryScenario.invalidationCondition).toMatch(/^[^가-힣]*$/)
    expect(report.primaryScenario.rationale).toMatch(/^[^가-힣]*$/)
  })
})
