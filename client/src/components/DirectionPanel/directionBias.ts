import type { OHLCVBar, IndicatorResults } from '../../lib/indicators'
import type { ICTAnalysis, StructureBias } from '../../lib/ictAnalysis'
import { buildAnalysisReport, type AnalysisReport, type EventRisk } from '../../lib/scenarioGenerator'
import type { IntermarketAnalysis } from '../../lib/intermarket'

export type BiasLevel = 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR'

export interface DirectionSignal {
  bias: BiasLevel
  score: number
  signals: {
    vwap: 'bull' | 'bear' | 'neutral'
    rsi: 'overbought' | 'oversold' | 'neutral'
    macd: 'bull' | 'bear' | 'neutral'
    bollinger: 'upper' | 'lower' | 'neutral'
  }
  lastClose: number
  vwapValue: number
  rsiValue: number
  macdHistogramValue?: number
}

export interface FullDirectionResult {
  signal: DirectionSignal
  report: AnalysisReport
  intermarket: IntermarketAnalysis | null
  htfBias?: StructureBias
}

function getIntermarketConfirmationText(
  confirmsBias: IntermarketAnalysis['confirmsBias']
): string {
  if (confirmsBias === 'BULLISH') {
    return '인터마켓 컨텍스트는 상승 확인을 보조하지만 최종 우선순위는 가격 구조(ICT)에 둡니다.'
  }

  if (confirmsBias === 'BEARISH') {
    return '인터마켓 컨텍스트는 하락 확인을 보조하지만 최종 우선순위는 가격 구조(ICT)에 둡니다.'
  }

  if (confirmsBias === 'CONFLICTING') {
    return '인터마켓 컨텍스트는 상충되어 방향 확인 신호로 사용하지 않고 가격 구조(ICT)를 우선합니다.'
  }

  return '인터마켓 컨텍스트는 뚜렷한 방향 확인을 제공하지 않아 가격 구조(ICT)를 우선합니다.'
}

function applyIntermarketSummary(
  report: AnalysisReport,
  intermarket?: IntermarketAnalysis
): AnalysisReport {
  if (!intermarket) {
    return report
  }

  return {
    ...report,
    finalVerdict: `${report.finalVerdict} ${getIntermarketConfirmationText(intermarket.confirmsBias)}`
  }
}

export function computeDirectionBias(
  bars: OHLCVBar[],
  indicators: IndicatorResults
): DirectionSignal {
  const lastBar = bars[bars.length - 1]
  const lastVwap = indicators.vwap[indicators.vwap.length - 1]
  const lastRsi = indicators.rsi[indicators.rsi.length - 1]
  const lastMacd = indicators.macd[indicators.macd.length - 1]
  const lastBollinger = indicators.bollinger[indicators.bollinger.length - 1]

  const lastClose = lastBar?.close ?? 0
  const vwapValue = lastVwap?.value ?? lastClose
  const rsiValue = lastRsi?.value ?? 50
  const macdHistogram = lastMacd?.histogram ?? 0
  const upperBand = lastBollinger?.upper ?? lastClose
  const lowerBand = lastBollinger?.lower ?? lastClose

  const vwapSignal: DirectionSignal['signals']['vwap'] =
    lastClose > vwapValue ? 'bull' : lastClose < vwapValue ? 'bear' : 'neutral'
  const rsiSignal: DirectionSignal['signals']['rsi'] =
    rsiValue > 70 ? 'overbought' : rsiValue < 30 ? 'oversold' : 'neutral'
  const macdSignal: DirectionSignal['signals']['macd'] =
    macdHistogram > 0 ? 'bull' : macdHistogram < 0 ? 'bear' : 'neutral'
  const bollingerSignal: DirectionSignal['signals']['bollinger'] =
    lastClose > upperBand ? 'upper' : lastClose < lowerBand ? 'lower' : 'neutral'

  const vwapScore = vwapSignal === 'bull' ? 1 : vwapSignal === 'bear' ? -1 : 0
  const rsiScore = rsiSignal === 'oversold' ? 1 : rsiSignal === 'overbought' ? -1 : 0
  const macdScore = macdSignal === 'bull' ? 1 : macdSignal === 'bear' ? -1 : 0
  const bollingerScore =
    bollingerSignal === 'lower' ? 1 : bollingerSignal === 'upper' ? -1 : 0

  const score = vwapScore + rsiScore + macdScore + bollingerScore

  const bias: BiasLevel =
    score >= 3
      ? 'STRONG_BULL'
      : score >= 1
        ? 'BULL'
        : score === 0
          ? 'NEUTRAL'
          : score <= -3
            ? 'STRONG_BEAR'
            : 'BEAR'

  return {
    bias,
    score,
    signals: {
      vwap: vwapSignal,
      rsi: rsiSignal,
      macd: macdSignal,
      bollinger: bollingerSignal
    },
    lastClose,
    vwapValue,
    rsiValue,
    macdHistogramValue: macdHistogram
  }
}

export function computeFullAnalysis(params: {
  asset: string
  timeframe: string
  bars: OHLCVBar[]
  indicators: IndicatorResults
  ictAnalysis: ICTAnalysis
  htfBias: StructureBias
  eventRisks?: EventRisk[]
  intermarket?: IntermarketAnalysis
}): FullDirectionResult {
  const signal = computeDirectionBias(params.bars, params.indicators)
  const report = applyIntermarketSummary(
    buildAnalysisReport({
      asset: params.asset,
      timeframe: params.timeframe,
      htfBias: params.htfBias,
      ltfBias: params.ictAnalysis.structureBias,
      ictAnalysis: params.ictAnalysis,
      indicatorSignal: signal,
      eventRisks: params.eventRisks
    }),
    params.intermarket
  )

  return {
    signal,
    report,
    intermarket: params.intermarket ?? null,
    htfBias: params.htfBias
  }
}
