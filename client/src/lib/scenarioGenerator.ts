import type { ICTAnalysis, StructureBias } from './ictAnalysis'
import type { DirectionSignal } from '../components/DirectionPanel/directionBias'

export type Direction = '상승' | '하락' | '중립'

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

type DirectionalBias = Exclude<Direction, '중립'>
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
    return '관찰 구간 미확정'
  }

  return `${formatPrice(zone.low)}-${formatPrice(zone.high)}`
}

function toDirection(bias: StructureBias): Direction {
  if (bias === 'BULLISH') {
    return '상승'
  }

  if (bias === 'BEARISH') {
    return '하락'
  }

  return '중립'
}

function toStructureBias(direction: DirectionalBias): StructureBias {
  return direction === '상승' ? 'BULLISH' : 'BEARISH'
}

function getOppositeDirection(direction: DirectionalBias): DirectionalBias {
  return direction === '상승' ? '하락' : '상승'
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
  return direction === '상승' ? ictAnalysis.nearestBullOB : ictAnalysis.nearestBearOB
}

function getOppositeOrderBlock(
  ictAnalysis: ICTAnalysis,
  direction: DirectionalBias
): ICTAnalysis['nearestBullOB'] {
  return direction === '상승' ? ictAnalysis.nearestBearOB : ictAnalysis.nearestBullOB
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
    direction === '상승' ? indicatorSignal.score : -indicatorSignal.score
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

    return toDirection(ictAnalysis.structureBias) === '하락' ? bearish : bullish
  }

  return bullish.value > bearish.value ? bullish : bearish
}

function getDirectionalTargets(
  ictAnalysis: ICTAnalysis,
  direction: DirectionalBias,
  entryZone: PriceZone
): number[] {
  const directionalLiquidity =
    direction === '상승'
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

  if (direction === '상승' && ictAnalysis.nearestBearOB) {
    return [roundPrice(ictAnalysis.nearestBearOB.low), roundPrice(ictAnalysis.nearestBearOB.high)]
  }

  if (direction === '하락' && ictAnalysis.nearestBullOB) {
    return [roundPrice(ictAnalysis.nearestBullOB.high), roundPrice(ictAnalysis.nearestBullOB.low)]
  }

  const zoneSize = getZoneSize(entryZone)
  if (zoneSize === 0) {
    return []
  }

  return FALLBACK_TARGET_MULTIPLIERS.map((multiplier) =>
    roundPrice(
      direction === '상승'
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
  if (direction === '상승' && ictAnalysis.nearestBullOB) {
    return createZone(ictAnalysis.nearestBullOB.low, ictAnalysis.nearestBullOB.high)
  }

  if (direction === '하락' && ictAnalysis.nearestBearOB) {
    return createZone(ictAnalysis.nearestBearOB.low, ictAnalysis.nearestBearOB.high)
  }

  if (direction === '중립' && ictAnalysis.nearestBullOB && ictAnalysis.nearestBearOB) {
    return createZone(ictAnalysis.nearestBullOB.high, ictAnalysis.nearestBearOB.low)
  }

  return null
}

function getScenarioStopLoss(direction: Direction, entryZone: PriceZone): number | null {
  if (!entryZone || direction === '중립') {
    return null
  }

  const buffer = Math.max(getZoneSize(entryZone) * STOP_BUFFER_RATIO, 0)
  if (direction === '상승') {
    return roundPrice(entryZone.low - buffer)
  }

  return roundPrice(entryZone.high + buffer)
}

function buildInvalidationCondition(
  asset: string,
  direction: Direction,
  entryZone: PriceZone
): string {
  if (direction === '상승') {
    if (!entryZone) {
      return `${asset}가 최근 저점 구조를 회복하지 못하면 상승 해석의 근거가 약화됩니다.`
    }

    return `${asset}가 ${formatPrice(entryZone.low)} 아래에서 종가 기준으로 유지되면 상승 시나리오의 전제가 약화됩니다.`
  }

  if (direction === '하락') {
    if (!entryZone) {
      return `${asset}가 최근 고점 저항을 다시 돌파하면 하락 해석의 근거가 약화됩니다.`
    }

    return `${asset}가 ${formatPrice(entryZone.high)} 위에서 종가 기준으로 유지되면 하락 시나리오의 전제가 약화됩니다.`
  }

  if (entryZone) {
    return `${asset}가 ${formatZone(entryZone)} 균형 구간을 종가 기준으로 이탈하면 중립 해석의 전제가 약화됩니다.`
  }

  return `${asset}의 가격이 한쪽 구조로 명확하게 확장되면 중립 해석의 전제가 약화됩니다.`
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
      ? '상위 구조와 보조 확인이 비교적 잘 정렬된 상태입니다.'
      : probability >= 55
        ? '우세 방향은 존재하지만 확인 신호가 완전히 일치하지는 않습니다.'
        : '우위는 제한적이어서 반대 시나리오와 함께 해석할 필요가 있습니다.'

  if (direction === '상승') {
    const zoneText = entryZone ? `${formatZone(entryZone)} bullish OB` : '근접 bullish OB 부재'
    return `${asset}는 ${zoneText}를 기준으로 하단 지지가 유지될 때 상단 유동성 탐색 가능성이 남아 있습니다. ${isAlternative ? '주 시나리오가 약화될 때 확인할 대안 흐름입니다.' : confidenceText}`
  }

  if (direction === '하락') {
    const zoneText = entryZone ? `${formatZone(entryZone)} bearish OB` : '근접 bearish OB 부재'
    return `${asset}는 ${zoneText}를 기준으로 상단 저항이 유지될 때 하단 유동성 회수 가능성이 남아 있습니다. ${isAlternative ? '주 시나리오가 약화될 때 확인할 대안 흐름입니다.' : confidenceText}`
  }

  const liquidityCount = ictAnalysis.liquidityLevels.length
  return `${asset}는 양방향 오더블록과 유동성 레벨이 공존해 단기 균형 구간 해석이 우세합니다. ${liquidityCount > 0 ? '가까운 유동성 레벨을 기준으로 범위 확장 여부를 관찰하는 시나리오입니다.' : '가까운 유동성 단서가 제한적이어서 구조 변화 확인이 우선입니다.'}`
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
    direction === '중립'
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
  if (primaryDirection === '상승') {
    return '하락'
  }

  if (primaryDirection === '하락') {
    return '상승'
  }

  const ictDirection = toDirection(ictAnalysis.structureBias)
  if (ictDirection === '상승' || ictDirection === '하락') {
    return ictDirection
  }

  const bullishTilt =
    Number(ictAnalysis.nearestBullOB !== null) +
    ictAnalysis.fvgs.filter((gap) => gap.type === 'bullish' && !gap.filled).length
  const bearishTilt =
    Number(ictAnalysis.nearestBearOB !== null) +
    ictAnalysis.fvgs.filter((gap) => gap.type === 'bearish' && !gap.filled).length

  return bullishTilt >= bearishTilt ? '상승' : '하락'
}

function collectReportLimitations(ictAnalysis: ICTAnalysis): string[] {
  const limitations: string[] = []

  if (!ictAnalysis.nearestBullOB && !ictAnalysis.nearestBearOB) {
    limitations.push('근접 오더블록이 없어 시나리오 구간의 정밀도가 낮습니다.')
  }

  if (ictAnalysis.fvgs.length === 0) {
    limitations.push('활성 FVG가 없어 유동성 이동 방향의 추가 확인이 제한됩니다.')
  }

  if (ictAnalysis.liquidityLevels.length < 2) {
    limitations.push('가까운 유동성 레벨이 적어 목표 구간 해석 범위가 좁습니다.')
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
    `${asset} ${timeframe} 기준 우세 해석은 ${probabilityScore.direction}이며, 확률 점수는 ${probabilityScore.value}점입니다.`,
    primaryScenario.entryZone
      ? `${formatZone(primaryScenario.entryZone)} 구간과 ${keyTarget !== undefined ? `${formatPrice(keyTarget)} 부근` : '가까운 유동성'}이 핵심 관찰 영역입니다.`
      : '근접 오더블록이 제한적이어서 구조 유지 여부 자체가 핵심 관찰 포인트입니다.'
  ]

  const elevatedRiskDescriptions = eventRisks
    .filter((risk) => risk.severity !== 'LOW')
    .map((risk) => risk.description)
  const cautionSources = [...elevatedRiskDescriptions, ...dataLimitations].slice(0, 2)

  if (cautionSources.length > 0) {
    verdictParts.push(`다만 ${cautionSources.join(', ')} 변수로 해석 신뢰도가 달라질 수 있습니다.`)
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
    '상승',
    buildDirectionalBreakdown('상승', htfBias, ltfBias, ictAnalysis, indicatorSignal)
  )
  const bearish = toProbabilityScore(
    '하락',
    buildDirectionalBreakdown('하락', htfBias, ltfBias, ictAnalysis, indicatorSignal)
  )
  const neutral = toProbabilityScore(
    '중립',
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
    limitations.push(`상위 타임프레임 봉 수가 ${MIN_HTF_BARS}개 미만이라 구조 해석 신뢰도가 낮습니다.`)
  }

  if (params.ltfBarsCount < MIN_LTF_BARS) {
    limitations.push(`하위 타임프레임 봉 수가 ${MIN_LTF_BARS}개 미만이라 유동성/오더블록 해석 범위가 좁습니다.`)
  }

  if (!params.hasEMA) {
    limitations.push('EMA 정렬 데이터가 없어 추세 필터 확인이 제한됩니다.')
  }

  if (!params.hasVWAP) {
    limitations.push('VWAP 데이터가 없어 당일 평균가 대비 위치 판단이 제한됩니다.')
  }

  return limitations
}
