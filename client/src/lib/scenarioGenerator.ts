import type { ICTAnalysis, StructureBias } from './ictAnalysis'
import type { DirectionSignal } from '../components/DirectionPanel/directionBias'

export type Direction = 'Bullish' | 'Bearish' | 'Neutral'

export interface TradeScenario {
  rank: 1 | 2
  direction: Direction
  entryZone: { low: number; high: number } | null
  stopLoss: number | null
  targets: number[]
  invalidationCondition: string
  probability: number
  rationale: string
}

export interface EventRisk {
  type: 'CPI' | 'FOMC' | 'NFP' | 'INVENTORY' | 'GEOPOLITICAL' | 'OTHER'
  description: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface ProbabilityScore {
  value: number
  breakdown: {
    htfStructure: number
    liquidityPosition: number
    ictConfirmation: number
    indicatorConfirmation: number
  }
  direction: Direction
}

export interface AnalysisReport {
  asset: string
  timeframe: string
  direction: Direction
  probabilityScore: ProbabilityScore
  primaryScenario: TradeScenario
  alternativeScenario: TradeScenario
  eventRisks: EventRisk[]
  dataLimitations: string[]
  finalVerdict: string
  generatedAt: number
}

type DirectionalBias = Exclude<Direction, 'Neutral'>
type PriceZone = TradeScenario['entryZone']
type ScoreBreakdown = ProbabilityScore['breakdown']
type FvgSummary = {
  bullishCount: number
  bearishCount: number
  bias: StructureBias
}

const PROBABILITY_WEIGHTS = {
  htfStructure: 40,
  liquidityPosition: 30,
  ictConfirmation: 20,
  indicatorConfirmation: 10
} as const

const LIQUIDITY_COMPONENTS = {
  orderBlock: 20,
  fvg: 10
} as const

const ICT_COMPONENTS = {
  structure: 10,
  orderBlock: 10
} as const

const INDICATOR_SCORE_LIMIT = 4
const STOP_BUFFER_RATIO = 0.25
const FALLBACK_TARGET_MULTIPLIERS = [1, 2, 3] as const
const PRIMARY_SCENARIO_GAP = 5
const MIN_HTF_BARS = 40
const MIN_LTF_BARS = 80

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function roundPrice(value: number): number {
  return Number(value.toFixed(4))
}

function formatPrice(value: number): string {
  return Number(value.toFixed(2)).toString()
}

function formatZone(zone: PriceZone): string {
  if (!zone) {
    return 'Observation zone not defined'
  }

  return `${formatPrice(zone.low)}-${formatPrice(zone.high)}`
}

function toDirection(bias: StructureBias): Direction {
  if (bias === 'BULLISH') {
    return 'Bullish'
  }

  if (bias === 'BEARISH') {
    return 'Bearish'
  }

  return 'Neutral'
}

function toStructureBias(direction: DirectionalBias): StructureBias {
  return direction === 'Bullish' ? 'BULLISH' : 'BEARISH'
}

function getOppositeDirection(direction: DirectionalBias): DirectionalBias {
  return direction === 'Bullish' ? 'Bearish' : 'Bullish'
}

function createZone(low: number, high: number): PriceZone {
  return {
    low: roundPrice(Math.min(low, high)),
    high: roundPrice(Math.max(low, high))
  }
}

function getZoneSize(zone: PriceZone): number {
  if (!zone) {
    return 0
  }

  return Math.max(zone.high - zone.low, 0)
}

function summarizeFvgs(ictAnalysis: ICTAnalysis): FvgSummary {
  const bullishCount = ictAnalysis.fvgs.filter((gap) => gap.type === 'bullish' && !gap.filled).length
  const bearishCount = ictAnalysis.fvgs.filter((gap) => gap.type === 'bearish' && !gap.filled).length

  if (bullishCount > bearishCount) {
    return { bullishCount, bearishCount, bias: 'BULLISH' }
  }

  if (bearishCount > bullishCount) {
    return { bullishCount, bearishCount, bias: 'BEARISH' }
  }

  return { bullishCount, bearishCount, bias: 'RANGING' }
}

function getDirectionalOrderBlock(
  ictAnalysis: ICTAnalysis,
  direction: DirectionalBias
): ICTAnalysis['nearestBullOB'] {
  return direction === 'Bullish' ? ictAnalysis.nearestBullOB : ictAnalysis.nearestBearOB
}

function getOppositeOrderBlock(
  ictAnalysis: ICTAnalysis,
  direction: DirectionalBias
): ICTAnalysis['nearestBullOB'] {
  return direction === 'Bullish' ? ictAnalysis.nearestBearOB : ictAnalysis.nearestBullOB
}

function buildDirectionalBreakdown(
  direction: DirectionalBias,
  htfBias: StructureBias,
  ltfBias: StructureBias,
  ictAnalysis: ICTAnalysis,
  indicatorSignal: DirectionSignal
): ScoreBreakdown {
  const targetBias = toStructureBias(direction)
  const oppositeBias = toStructureBias(getOppositeDirection(direction))
  const alignedOrderBlock = getDirectionalOrderBlock(ictAnalysis, direction)
  const oppositeOrderBlock = getOppositeOrderBlock(ictAnalysis, direction)
  const fvgSummary = summarizeFvgs(ictAnalysis)

  const htfStructure =
    htfBias === targetBias
      ? PROBABILITY_WEIGHTS.htfStructure
      : htfBias === 'RANGING'
        ? PROBABILITY_WEIGHTS.htfStructure / 2
        : 0

  const liquidityPosition =
    (alignedOrderBlock ? LIQUIDITY_COMPONENTS.orderBlock : 0) +
    (fvgSummary.bias === targetBias ? LIQUIDITY_COMPONENTS.fvg : 0)

  const alignedStructureCount =
    Number(ltfBias === targetBias) + Number(ictAnalysis.structureBias === targetBias)
  const opposingStructureCount =
    Number(ltfBias === oppositeBias) + Number(ictAnalysis.structureBias === oppositeBias)

  const structureConfirmation =
    alignedStructureCount === 2
      ? ICT_COMPONENTS.structure
      : alignedStructureCount === 1 && opposingStructureCount === 0
        ? ICT_COMPONENTS.structure / 2
        : 0

  const orderBlockConfirmation =
    alignedOrderBlock && oppositeOrderBlock
      ? ICT_COMPONENTS.orderBlock / 2
      : alignedOrderBlock
        ? ICT_COMPONENTS.orderBlock
        : 0

  const alignedIndicatorScore =
    direction === 'Bullish' ? indicatorSignal.score : -indicatorSignal.score
  const indicatorConfirmation = Math.round(
    (clamp(alignedIndicatorScore, 0, INDICATOR_SCORE_LIMIT) / INDICATOR_SCORE_LIMIT) *
      PROBABILITY_WEIGHTS.indicatorConfirmation
  )

  return {
    htfStructure,
    liquidityPosition,
    ictConfirmation: structureConfirmation + orderBlockConfirmation,
    indicatorConfirmation
  }
}

function buildNeutralBreakdown(
  htfBias: StructureBias,
  ltfBias: StructureBias,
  ictAnalysis: ICTAnalysis,
  indicatorSignal: DirectionSignal
): ScoreBreakdown {
  const fvgSummary = summarizeFvgs(ictAnalysis)
  const hasBullOrderBlock = ictAnalysis.nearestBullOB !== null
  const hasBearOrderBlock = ictAnalysis.nearestBearOB !== null

  const htfStructure = htfBias === 'RANGING' ? PROBABILITY_WEIGHTS.htfStructure / 2 : 0

  const orderBlockBalance =
    hasBullOrderBlock && hasBearOrderBlock
      ? LIQUIDITY_COMPONENTS.orderBlock
      : !hasBullOrderBlock && !hasBearOrderBlock
        ? LIQUIDITY_COMPONENTS.orderBlock / 2
        : 0

  const fvgBalance =
    fvgSummary.bullishCount === 0 && fvgSummary.bearishCount === 0
      ? LIQUIDITY_COMPONENTS.fvg / 2
      : fvgSummary.bias === 'RANGING'
        ? LIQUIDITY_COMPONENTS.fvg
        : 0

  const structureBalance =
    ltfBias === 'RANGING' && ictAnalysis.structureBias === 'RANGING'
      ? ICT_COMPONENTS.structure
      : toDirection(ltfBias) !== toDirection(ictAnalysis.structureBias) ||
          ltfBias === 'RANGING' ||
          ictAnalysis.structureBias === 'RANGING'
        ? ICT_COMPONENTS.structure / 2
        : 0

  const orderBlockBalanceConfirmation =
    hasBullOrderBlock && hasBearOrderBlock
      ? ICT_COMPONENTS.orderBlock
      : !hasBullOrderBlock && !hasBearOrderBlock
        ? ICT_COMPONENTS.orderBlock / 2
        : 0

  const indicatorConfirmation = Math.round(
    (1 - Math.abs(clamp(indicatorSignal.score, -INDICATOR_SCORE_LIMIT, INDICATOR_SCORE_LIMIT)) /
      INDICATOR_SCORE_LIMIT) *
      PROBABILITY_WEIGHTS.indicatorConfirmation
  )

  return {
    htfStructure,
    liquidityPosition: orderBlockBalance + fvgBalance,
    ictConfirmation: structureBalance + orderBlockBalanceConfirmation,
    indicatorConfirmation
  }
}

function toProbabilityScore(direction: Direction, breakdown: ScoreBreakdown): ProbabilityScore {
  return {
    value:
      breakdown.htfStructure +
      breakdown.liquidityPosition +
      breakdown.ictConfirmation +
      breakdown.indicatorConfirmation,
    breakdown,
    direction
  }
}

function pickProbabilityScore(
  bullish: ProbabilityScore,
  bearish: ProbabilityScore,
  neutral: ProbabilityScore,
  indicatorSignal: DirectionSignal,
  htfBias: StructureBias,
  ictAnalysis: ICTAnalysis
): ProbabilityScore {
  if (neutral.value >= bullish.value && neutral.value >= bearish.value) {
    return neutral
  }

  if (bullish.value === bearish.value) {
    if (indicatorSignal.score > 0) {
      return bullish
    }

    if (indicatorSignal.score < 0) {
      return bearish
    }

    if (htfBias === 'BULLISH') {
      return bullish
    }

    if (htfBias === 'BEARISH') {
      return bearish
    }

      return toDirection(ictAnalysis.structureBias) === 'Bearish' ? bearish : bullish
  }

  return bullish.value > bearish.value ? bullish : bearish
}

function getDirectionalTargets(
  ictAnalysis: ICTAnalysis,
  direction: DirectionalBias,
  entryZone: PriceZone
): number[] {
  const directionalLiquidity =
    direction === 'Bullish'
      ? ictAnalysis.liquidityLevels
          .filter((level) => level.type === 'BSL' && level.price > ictAnalysis.currentPrice)
          .sort((a, b) => a.price - b.price)
      : ictAnalysis.liquidityLevels
          .filter((level) => level.type === 'SSL' && level.price < ictAnalysis.currentPrice)
          .sort((a, b) => b.price - a.price)

  const targets = directionalLiquidity.slice(0, 3).map((level) => roundPrice(level.price))
  if (targets.length > 0) {
    return targets
  }

  if (direction === 'Bullish' && ictAnalysis.nearestBearOB) {
    return [roundPrice(ictAnalysis.nearestBearOB.low), roundPrice(ictAnalysis.nearestBearOB.high)]
  }

  if (direction === 'Bearish' && ictAnalysis.nearestBullOB) {
    return [roundPrice(ictAnalysis.nearestBullOB.high), roundPrice(ictAnalysis.nearestBullOB.low)]
  }

  const zoneSize = getZoneSize(entryZone)
  if (zoneSize === 0) {
    return []
  }

  return FALLBACK_TARGET_MULTIPLIERS.map((multiplier) =>
    roundPrice(
      direction === 'Bullish'
        ? ictAnalysis.currentPrice + zoneSize * multiplier
        : ictAnalysis.currentPrice - zoneSize * multiplier
    )
  )
}

function getNeutralTargets(ictAnalysis: ICTAnalysis): number[] {
  if (ictAnalysis.nearestBullOB && ictAnalysis.nearestBearOB) {
    return [
      roundPrice(Math.min(ictAnalysis.nearestBullOB.high, ictAnalysis.nearestBearOB.low)),
      roundPrice(Math.max(ictAnalysis.nearestBullOB.high, ictAnalysis.nearestBearOB.low))
    ]
  }

  return ictAnalysis.liquidityLevels
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.price - ictAnalysis.currentPrice) - Math.abs(b.price - ictAnalysis.currentPrice)
    )
    .slice(0, 2)
    .map((level) => roundPrice(level.price))
}

function dedupeTargets(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value))))
}

function getScenarioZone(ictAnalysis: ICTAnalysis, direction: Direction): PriceZone {
  if (direction === 'Bullish' && ictAnalysis.nearestBullOB) {
    return createZone(ictAnalysis.nearestBullOB.low, ictAnalysis.nearestBullOB.high)
  }

  if (direction === 'Bearish' && ictAnalysis.nearestBearOB) {
    return createZone(ictAnalysis.nearestBearOB.low, ictAnalysis.nearestBearOB.high)
  }

  if (direction === 'Neutral' && ictAnalysis.nearestBullOB && ictAnalysis.nearestBearOB) {
    return createZone(ictAnalysis.nearestBullOB.high, ictAnalysis.nearestBearOB.low)
  }

  return null
}

function getScenarioStopLoss(direction: Direction, entryZone: PriceZone): number | null {
  if (!entryZone || direction === 'Neutral') {
    return null
  }

  const buffer = Math.max(getZoneSize(entryZone) * STOP_BUFFER_RATIO, 0)
  if (direction === 'Bullish') {
    return roundPrice(entryZone.low - buffer)
  }

  return roundPrice(entryZone.high + buffer)
}

function buildInvalidationCondition(
  asset: string,
  direction: Direction,
  entryZone: PriceZone
): string {
  if (direction === 'Bullish') {
    if (!entryZone) {
      return `${asset} loses its bullish case if price fails to reclaim the recent swing-low structure.`
    }

    return `${asset} weakens the bullish setup if it closes and holds below ${formatPrice(entryZone.low)}.`
  }

  if (direction === 'Bearish') {
    if (!entryZone) {
      return `${asset} weakens the bearish case if price reclaims the recent swing-high resistance.`
    }

    return `${asset} weakens the bearish setup if it closes and holds above ${formatPrice(entryZone.high)}.`
  }

  if (entryZone) {
    return `${asset} weakens the neutral case if it closes outside the ${formatZone(entryZone)} balance zone.`
  }

  return `${asset} weakens the neutral case once price expands clearly into one-sided structure.`
}

function buildScenarioRationale(
  asset: string,
  direction: Direction,
  probability: number,
  ictAnalysis: ICTAnalysis,
  entryZone: PriceZone,
  isAlternative: boolean
): string {
  const confidenceText =
    probability >= 70
      ? 'Higher-timeframe structure and secondary confirmation are aligned well.'
      : probability >= 55
        ? 'There is directional edge, but the confirmation signals are not fully aligned.'
        : 'The edge is limited, so the opposing scenario still deserves attention.'

  if (direction === 'Bullish') {
    const zoneText = entryZone ? `${formatZone(entryZone)} bullish OB` : 'no nearby bullish OB'
    return `${asset} can continue probing upside liquidity while support holds around ${zoneText}. ${isAlternative ? 'This becomes the fallback path if the primary scenario starts to fail.' : confidenceText}`
  }

  if (direction === 'Bearish') {
    const zoneText = entryZone ? `${formatZone(entryZone)} bearish OB` : 'no nearby bearish OB'
    return `${asset} can continue sweeping downside liquidity while resistance holds around ${zoneText}. ${isAlternative ? 'This becomes the fallback path if the primary scenario starts to fail.' : confidenceText}`
  }

  const liquidityCount = ictAnalysis.liquidityLevels.length
  return `${asset} is trading in a short-term balance regime with order blocks and liquidity resting on both sides. ${liquidityCount > 0 ? 'Watch the nearest liquidity levels for a range expansion trigger.' : 'Nearby liquidity clues are limited, so structural change matters more than range assumptions.'}`
}

function buildScenario(
  rank: 1 | 2,
  direction: Direction,
  probability: number,
  ictAnalysis: ICTAnalysis,
  asset: string,
  isAlternative: boolean
): TradeScenario {
  const entryZone = getScenarioZone(ictAnalysis, direction)
  const stopLoss = getScenarioStopLoss(direction, entryZone)
  const targets = dedupeTargets(
      direction === 'Neutral'
      ? getNeutralTargets(ictAnalysis)
      : getDirectionalTargets(ictAnalysis, direction, entryZone)
  )

  return {
    rank,
    direction,
    entryZone,
    stopLoss,
    targets,
    invalidationCondition: buildInvalidationCondition(asset, direction, entryZone),
    probability: clamp(Math.round(probability), 0, 100),
    rationale: buildScenarioRationale(asset, direction, probability, ictAnalysis, entryZone, isAlternative)
  }
}

function getAlternativeDirection(
  primaryDirection: Direction,
  ictAnalysis: ICTAnalysis
): DirectionalBias {
  if (primaryDirection === 'Bullish') {
    return 'Bearish'
  }

  if (primaryDirection === 'Bearish') {
    return 'Bullish'
  }

  const ictDirection = toDirection(ictAnalysis.structureBias)
  if (ictDirection === 'Bullish' || ictDirection === 'Bearish') {
    return ictDirection
  }

  const bullishTilt =
    Number(ictAnalysis.nearestBullOB !== null) +
    ictAnalysis.fvgs.filter((gap) => gap.type === 'bullish' && !gap.filled).length
  const bearishTilt =
    Number(ictAnalysis.nearestBearOB !== null) +
    ictAnalysis.fvgs.filter((gap) => gap.type === 'bearish' && !gap.filled).length

  return bullishTilt >= bearishTilt ? 'Bullish' : 'Bearish'
}

function collectReportLimitations(ictAnalysis: ICTAnalysis): string[] {
  const limitations: string[] = []

  if (!ictAnalysis.nearestBullOB && !ictAnalysis.nearestBearOB) {
    limitations.push('No nearby order block is available, so the scenario zone is less precise.')
  }

  if (ictAnalysis.fvgs.length === 0) {
    limitations.push('No active FVG is available, so liquidity direction has less confirmation.')
  }

  if (ictAnalysis.liquidityLevels.length < 2) {
    limitations.push('There are too few nearby liquidity levels to define target zones with confidence.')
  }

  return limitations
}

function buildFinalVerdict(params: {
  asset: string
  timeframe: string
  probabilityScore: ProbabilityScore
  primaryScenario: TradeScenario
  eventRisks: EventRisk[]
  dataLimitations: string[]
}): string {
  const { asset, timeframe, probabilityScore, primaryScenario, eventRisks, dataLimitations } = params
  const keyTarget = primaryScenario.targets[0]
  const verdictParts = [
    `${asset} on ${timeframe} currently favors a ${probabilityScore.direction.toLowerCase()} read with a probability score of ${probabilityScore.value}.`,
    primaryScenario.entryZone
      ? `${formatZone(primaryScenario.entryZone)} and ${keyTarget !== undefined ? `the ${formatPrice(keyTarget)} area` : 'nearby liquidity'} are the key zones to monitor.`
      : 'Nearby order-block context is limited, so structure retention itself is the main thing to watch.'
  ]

  const elevatedRiskDescriptions = eventRisks
    .filter((risk) => risk.severity !== 'LOW')
    .map((risk) => risk.description)
  const cautionSources = [...elevatedRiskDescriptions, ...dataLimitations].slice(0, 2)

  if (cautionSources.length > 0) {
    verdictParts.push(`Confidence can shift if ${cautionSources.join(', ')} changes the market context.`)
  }

  return verdictParts.join(' ')
}

export function computeProbabilityScore(
  htfBias: StructureBias,
  ltfBias: StructureBias,
  ictAnalysis: ICTAnalysis,
  indicatorSignal: DirectionSignal
): ProbabilityScore {
  const bullish = toProbabilityScore(
    'Bullish',
    buildDirectionalBreakdown('Bullish', htfBias, ltfBias, ictAnalysis, indicatorSignal)
  )
  const bearish = toProbabilityScore(
    'Bearish',
    buildDirectionalBreakdown('Bearish', htfBias, ltfBias, ictAnalysis, indicatorSignal)
  )
  const neutral = toProbabilityScore(
    'Neutral',
    buildNeutralBreakdown(htfBias, ltfBias, ictAnalysis, indicatorSignal)
  )

  return pickProbabilityScore(bullish, bearish, neutral, indicatorSignal, htfBias, ictAnalysis)
}

export function generateScenarios(
  ictAnalysis: ICTAnalysis,
  probabilityScore: ProbabilityScore,
  asset: string
): { primary: TradeScenario; alternative: TradeScenario } {
  const primary = buildScenario(
    1,
    probabilityScore.direction,
    probabilityScore.value,
    ictAnalysis,
    asset,
    false
  )
  const alternativeProbability = clamp(
    Math.min(100 - probabilityScore.value, probabilityScore.value - PRIMARY_SCENARIO_GAP),
    0,
    100
  )
  const alternative = buildScenario(
    2,
    getAlternativeDirection(probabilityScore.direction, ictAnalysis),
    alternativeProbability,
    ictAnalysis,
    asset,
    true
  )

  return { primary, alternative }
}

export function buildAnalysisReport(params: {
  asset: string
  timeframe: string
  htfBias: StructureBias
  ltfBias: StructureBias
  ictAnalysis: ICTAnalysis
  indicatorSignal: DirectionSignal
  eventRisks?: EventRisk[]
}): AnalysisReport {
  const probabilityScore = computeProbabilityScore(
    params.htfBias,
    params.ltfBias,
    params.ictAnalysis,
    params.indicatorSignal
  )
  const scenarios = generateScenarios(params.ictAnalysis, probabilityScore, params.asset)
  const eventRisks = params.eventRisks ?? []
  const dataLimitations = collectReportLimitations(params.ictAnalysis)

  return {
    asset: params.asset,
    timeframe: params.timeframe,
    direction: probabilityScore.direction,
    probabilityScore,
    primaryScenario: scenarios.primary,
    alternativeScenario: scenarios.alternative,
    eventRisks,
    dataLimitations,
    finalVerdict: buildFinalVerdict({
      asset: params.asset,
      timeframe: params.timeframe,
      probabilityScore,
      primaryScenario: scenarios.primary,
      eventRisks,
      dataLimitations
    }),
    generatedAt: Date.now()
  }
}

export function detectDataLimitations(params: {
  htfBarsCount: number
  ltfBarsCount: number
  hasEMA: boolean
  hasVWAP: boolean
}): string[] {
  const limitations: string[] = []

  if (params.htfBarsCount < MIN_HTF_BARS) {
    limitations.push(`Higher-timeframe bar count is below ${MIN_HTF_BARS}, so structural confidence is reduced.`)
  }

  if (params.ltfBarsCount < MIN_LTF_BARS) {
    limitations.push(`Lower-timeframe bar count is below ${MIN_LTF_BARS}, so liquidity and order-block context are narrower.`)
  }

  if (!params.hasEMA) {
    limitations.push('EMA alignment data is unavailable, so trend filtering is limited.')
  }

  if (!params.hasVWAP) {
    limitations.push('VWAP data is unavailable, so intraday average-price positioning is limited.')
  }

  return limitations
}
