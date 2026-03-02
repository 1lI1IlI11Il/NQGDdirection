import type { OHLCVBar, IndicatorResults } from '../../lib/indicators'

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
    rsiValue
  }
}
