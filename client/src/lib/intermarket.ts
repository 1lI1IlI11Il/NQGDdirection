import type { OHLCVBar } from './indicators'

type StructureBias = 'BULLISH' | 'BEARISH' | 'RANGING'
type TrackedSymbol = 'NQ=F' | 'ES=F' | 'GC=F' | 'SI=F' | 'CL=F'

export type CorrelationStatus = 'CONVERGING' | 'DIVERGING' | 'UNKNOWN'

export interface AssetSnapshot {
  symbol: string
  lastClose: number
  change1d: number
  structureBias: 'BULLISH' | 'BEARISH' | 'RANGING'
}

export interface IntermarketAnalysis {
  nqSpCorrelation: CorrelationStatus
  goldSilverRelativeStrength: 'GOLD_LEADING' | 'SILVER_LEADING' | 'NEUTRAL'
  oilRiskSentiment: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL'
  availableAssets: string[]
  missingAssets: string[]
  summary: string
  confirmsBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'CONFLICTING'
}

const REQUIRED_SYMBOLS: TrackedSymbol[] = ['NQ=F', 'ES=F', 'GC=F', 'SI=F', 'CL=F']

function toUtcDayKey(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function findReferenceClose(bars: OHLCVBar[]): number | null {
  if (bars.length < 2) {
    return null
  }

  const latestDayKey = toUtcDayKey(bars[bars.length - 1].time)
  for (let i = bars.length - 2; i >= 0; i -= 1) {
    if (toUtcDayKey(bars[i].time) !== latestDayKey) {
      return bars[i].close
    }
  }

  return bars[bars.length - 2].close
}

function inferStructureBias(bars: OHLCVBar[]): StructureBias {
  if (bars.length < 2) {
    return 'RANGING'
  }

  const recent = bars.slice(-Math.min(5, bars.length))
  const firstClose = recent[0].close
  const lastClose = recent[recent.length - 1].close

  let highestHigh = Number.NEGATIVE_INFINITY
  let lowestLow = Number.POSITIVE_INFINITY

  for (const bar of recent) {
    if (bar.high > highestHigh) {
      highestHigh = bar.high
    }
    if (bar.low < lowestLow) {
      lowestLow = bar.low
    }
  }

  const priceRange = highestHigh - lowestLow
  if (priceRange <= 0 || firstClose === 0) {
    return 'RANGING'
  }

  const netChange = ((lastClose - firstClose) / Math.abs(firstClose)) * 100
  const closeLocation = (lastClose - lowestLow) / priceRange

  if (netChange >= 0.25 && closeLocation >= 0.6) {
    return 'BULLISH'
  }

  if (netChange <= -0.25 && closeLocation <= 0.4) {
    return 'BEARISH'
  }

  return 'RANGING'
}

function buildSummary(
  nqSpCorrelation: CorrelationStatus,
  goldSilverRelativeStrength: IntermarketAnalysis['goldSilverRelativeStrength'],
  oilRiskSentiment: IntermarketAnalysis['oilRiskSentiment'],
  confirmsBias: IntermarketAnalysis['confirmsBias'],
  missingAssets: string[],
  snapshots: Partial<Record<TrackedSymbol, AssetSnapshot>>
): string {
  const signals: string[] = []
  const nqBias = snapshots['NQ=F']?.structureBias

  if (nqSpCorrelation === 'CONVERGING') {
    if (nqBias === 'BULLISH') {
      signals.push('NQ and ES are structurally converging on the upside')
    } else if (nqBias === 'BEARISH') {
      signals.push('NQ and ES are structurally converging on the downside')
    } else {
      signals.push('NQ and ES are structurally aligned but range-bound')
    }
  } else if (nqSpCorrelation === 'DIVERGING') {
    signals.push('NQ and ES are structurally diverging')
  }

  if (goldSilverRelativeStrength === 'GOLD_LEADING') {
    signals.push('gold is outperforming silver')
  } else if (goldSilverRelativeStrength === 'SILVER_LEADING') {
    signals.push('silver is outperforming gold')
  }

  if (oilRiskSentiment === 'RISK_ON') {
    signals.push('oil is leaning risk-on')
  } else if (oilRiskSentiment === 'RISK_OFF') {
    signals.push('oil is leaning risk-off')
  }

  const leadSentence =
    signals.length > 0
      ? `${signals.join(', ')}.`
      : 'Intermarket context is limited because tracked cross-asset data is incomplete.'

  let confirmsText = 'does not provide a majority directional confirmation'
  if (confirmsBias === 'BULLISH') {
    confirmsText = 'provides a bullish intermarket confirmation'
  } else if (confirmsBias === 'BEARISH') {
    confirmsText = 'provides a bearish intermarket confirmation'
  } else if (confirmsBias === 'CONFLICTING') {
    confirmsText = 'is mixed rather than confirming a single directional bias'
  }

  const missingText =
    missingAssets.length > 0 ? ` and missing data for ${missingAssets.join(', ')}` : ''

  return `${leadSentence} This is supplementary context only, ${confirmsText}; price structure remains primary${missingText}.`
}

export function analyzeIntermarket(
  assets: Partial<Record<string, { bars: OHLCVBar[]; structureBias: 'BULLISH' | 'BEARISH' | 'RANGING' }>>,
): IntermarketAnalysis {
  const availableAssets: string[] = []
  const missingAssets: string[] = []
  const snapshots: Partial<Record<TrackedSymbol, AssetSnapshot>> = {}

  for (const symbol of REQUIRED_SYMBOLS) {
    const asset = assets[symbol]
    if (!asset || asset.bars.length === 0) {
      missingAssets.push(symbol)
      continue
    }

    availableAssets.push(symbol)
    snapshots[symbol] = {
      ...computeAssetSnapshot(symbol, asset.bars),
      structureBias: asset.structureBias
    }
  }

  let nqSpCorrelation: CorrelationStatus = 'UNKNOWN'
  if (snapshots['NQ=F'] && snapshots['ES=F']) {
    nqSpCorrelation =
      snapshots['NQ=F'].structureBias === snapshots['ES=F'].structureBias ? 'CONVERGING' : 'DIVERGING'
  }

  let goldSilverRelativeStrength: IntermarketAnalysis['goldSilverRelativeStrength'] = 'NEUTRAL'
  if (snapshots['GC=F'] && snapshots['SI=F']) {
    const goldChange = snapshots['GC=F'].change1d
    const silverChange = snapshots['SI=F'].change1d

    if (goldChange > silverChange) {
      goldSilverRelativeStrength = 'GOLD_LEADING'
    } else if (goldChange < silverChange) {
      goldSilverRelativeStrength = 'SILVER_LEADING'
    }
  }

  let oilRiskSentiment: IntermarketAnalysis['oilRiskSentiment'] = 'NEUTRAL'
  if (snapshots['CL=F']?.structureBias === 'BULLISH') {
    oilRiskSentiment = 'RISK_ON'
  } else if (snapshots['CL=F']?.structureBias === 'BEARISH') {
    oilRiskSentiment = 'RISK_OFF'
  }

  let bullishVotes = 0
  let bearishVotes = 0
  let conflictingSignals = 0

  if (nqSpCorrelation === 'CONVERGING') {
    if (snapshots['NQ=F']?.structureBias === 'BULLISH') {
      bullishVotes += 1
    } else if (snapshots['NQ=F']?.structureBias === 'BEARISH') {
      bearishVotes += 1
    }
  } else if (nqSpCorrelation === 'DIVERGING') {
    conflictingSignals += 1
  }

  if (goldSilverRelativeStrength === 'SILVER_LEADING') {
    bullishVotes += 1
  } else if (goldSilverRelativeStrength === 'GOLD_LEADING') {
    bearishVotes += 1
  }

  if (oilRiskSentiment === 'RISK_ON') {
    bullishVotes += 1
  } else if (oilRiskSentiment === 'RISK_OFF') {
    bearishVotes += 1
  }

  let confirmsBias: IntermarketAnalysis['confirmsBias'] = 'NEUTRAL'
  if (bullishVotes >= 2 && bullishVotes > bearishVotes) {
    confirmsBias = 'BULLISH'
  } else if (bearishVotes >= 2 && bearishVotes > bullishVotes) {
    confirmsBias = 'BEARISH'
  } else if (bullishVotes > 0 && bearishVotes > 0) {
    confirmsBias = 'CONFLICTING'
  } else if (conflictingSignals > 0) {
    confirmsBias = 'CONFLICTING'
  }

  return {
    nqSpCorrelation,
    goldSilverRelativeStrength,
    oilRiskSentiment,
    availableAssets,
    missingAssets,
    summary: buildSummary(
      nqSpCorrelation,
      goldSilverRelativeStrength,
      oilRiskSentiment,
      confirmsBias,
      missingAssets,
      snapshots
    ),
    confirmsBias
  }
}

export function computeAssetSnapshot(symbol: string, bars: OHLCVBar[]): AssetSnapshot {
  if (bars.length === 0) {
    return {
      symbol,
      lastClose: 0,
      change1d: 0,
      structureBias: 'RANGING'
    }
  }

  const lastClose = bars[bars.length - 1].close
  const referenceClose = findReferenceClose(bars)
  const change1d =
    referenceClose === null || referenceClose === 0
      ? 0
      : ((lastClose - referenceClose) / referenceClose) * 100

  return {
    symbol,
    lastClose,
    change1d,
    structureBias: inferStructureBias(bars)
  }
}
