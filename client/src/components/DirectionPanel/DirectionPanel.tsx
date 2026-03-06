import type { ReactNode } from 'react'
import type { DirectionSignal, FullDirectionResult } from './directionBias'
import type {
  ICTAnalysis,
  OrderBlock,
  PremiumDiscountZone,
  StructureBias,
  StructureShiftEvent
} from '../../lib/ictAnalysis'
import type { Direction, EventRisk, TradeScenario } from '../../lib/scenarioGenerator'

interface DirectionPanelProps {
  symbol: string
  signal: DirectionSignal
  ictAnalysis: ICTAnalysis
  timeframe: string
  fullResult?: FullDirectionResult | null
}

interface SignalRow {
  name: string
  label: string
  dotClass: string
}

interface SectionBlockProps {
  title: string
  children: ReactNode
  first?: boolean
}

interface SectionFieldProps {
  label: string
  children: ReactNode
  valueClassName?: string
  mono?: boolean
}

function getBiasBadgeClass(bias: DirectionSignal['bias']): string {
  if (bias === 'STRONG_BULL') {
    return 'bg-emerald-950 text-emerald-400 border border-emerald-700'
  }

  if (bias === 'BULL') {
    return 'bg-emerald-950/50 text-emerald-500'
  }

  if (bias === 'BEAR') {
    return 'bg-red-950/50 text-red-500'
  }

  if (bias === 'STRONG_BEAR') {
    return 'bg-red-950 text-red-400 border border-red-700'
  }

  return 'bg-zinc-800 text-zinc-400'
}

function getBiasText(bias: DirectionSignal['bias']): string {
  if (bias === 'STRONG_BULL') {
    return '▲ STRONG BULL'
  }

  if (bias === 'BULL') {
    return '▲ BULL'
  }

  if (bias === 'BEAR') {
    return '▼ BEAR'
  }

  if (bias === 'STRONG_BEAR') {
    return '▼ STRONG BEAR'
  }

  return '─ NEUTRAL'
}

function getDirectionLabel(bias: DirectionSignal['bias']): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  if (bias === 'STRONG_BULL' || bias === 'BULL') {
    return 'BULLISH'
  }

  if (bias === 'STRONG_BEAR' || bias === 'BEAR') {
    return 'BEARISH'
  }

  return 'NEUTRAL'
}

function getSignalRows(signal: DirectionSignal): SignalRow[] {
  return [
    {
      name: 'VWAP',
      label:
        signal.signals.vwap === 'bull'
          ? 'Price above VWAP'
          : signal.signals.vwap === 'bear'
            ? 'Price below VWAP'
            : 'At VWAP',
      dotClass:
        signal.signals.vwap === 'bull'
          ? 'bg-emerald-500'
          : signal.signals.vwap === 'bear'
            ? 'bg-red-500'
            : 'bg-zinc-500'
    },
    {
      name: 'RSI',
      label:
        signal.signals.rsi === 'oversold'
          ? `Oversold (${signal.rsiValue.toFixed(0)})`
          : signal.signals.rsi === 'overbought'
            ? `Overbought (${signal.rsiValue.toFixed(0)})`
            : `Neutral (${signal.rsiValue.toFixed(0)})`,
      dotClass:
        signal.signals.rsi === 'oversold'
          ? 'bg-emerald-500'
          : signal.signals.rsi === 'overbought'
            ? 'bg-red-500'
            : 'bg-zinc-500'
    },
    {
      name: 'MACD',
      label:
        signal.signals.macd === 'bull'
          ? 'Histogram positive'
          : signal.signals.macd === 'bear'
            ? 'Histogram negative'
            : 'Flat',
      dotClass:
        signal.signals.macd === 'bull'
          ? 'bg-emerald-500'
          : signal.signals.macd === 'bear'
            ? 'bg-red-500'
            : 'bg-zinc-500'
    },
    {
      name: 'BB',
      label:
        signal.signals.bollinger === 'lower'
          ? 'Below lower band'
          : signal.signals.bollinger === 'upper'
            ? 'Above upper band'
            : 'Inside bands',
      dotClass:
        signal.signals.bollinger === 'lower'
          ? 'bg-emerald-500'
          : signal.signals.bollinger === 'upper'
            ? 'bg-red-500'
            : 'bg-zinc-500'
    }
  ]
}

function formatPrice(value: number): string {
  return value.toFixed(2)
}

function formatZone(zone: { low: number; high: number } | null): string {
  if (!zone) {
    return '없음'
  }

  return `${formatPrice(zone.low)} - ${formatPrice(zone.high)}`
}

function formatOrderBlock(block: OrderBlock | null): string {
  if (!block) {
    return '없음'
  }

  return `${formatPrice(block.low)} - ${formatPrice(block.high)}`
}

function formatOptionalPrice(value: number | undefined): string {
  return value === undefined ? '-' : formatPrice(value)
}

function getDirectionToneClass(direction: Direction): string {
  if (direction === '상승') {
    return 'text-emerald-400'
  }

  if (direction === '하락') {
    return 'text-red-400'
  }

  return 'text-zinc-300'
}

function getStructureToneClass(bias: StructureBias): string {
  if (bias === 'BULLISH') {
    return 'text-emerald-400'
  }

  if (bias === 'BEARISH') {
    return 'text-red-400'
  }

  return 'text-zinc-300'
}

function formatStructureBias(bias: StructureBias): string {
  if (bias === 'BULLISH') {
    return '상승'
  }

  if (bias === 'BEARISH') {
    return '하락'
  }

  return '중립'
}

function getEmaAlignmentText(emaContext: ICTAnalysis['emaContext']): string {
  if (!emaContext) {
    return '데이터 없음'
  }

  const emaValues = `${formatOptionalPrice(emaContext.ema20)} / ${formatOptionalPrice(emaContext.ema50)} / ${formatOptionalPrice(emaContext.ema200)}`

  if (emaContext.alignment === 'BULLISH') {
    return `상승 정렬 (${emaValues})`
  }

  if (emaContext.alignment === 'BEARISH') {
    return `하락 정렬 (${emaValues})`
  }

  return `혼조 (${emaValues})`
}

function getRsiText(signal: DirectionSignal): string {
  if (signal.signals.rsi === 'oversold') {
    return `${signal.rsiValue.toFixed(1)} (과매도)`
  }

  if (signal.signals.rsi === 'overbought') {
    return `${signal.rsiValue.toFixed(1)} (과매수)`
  }

  return `${signal.rsiValue.toFixed(1)} (중립)`
}

function getMacdText(signal: DirectionSignal): string {
  if (signal.macdHistogramValue === undefined) {
    if (signal.signals.macd === 'bull') {
      return '양수'
    }

    if (signal.signals.macd === 'bear') {
      return '음수'
    }

    return '중립'
  }

  if (signal.macdHistogramValue > 0) {
    return `${signal.macdHistogramValue.toFixed(3)} (양수)`
  }

  if (signal.macdHistogramValue < 0) {
    return `${signal.macdHistogramValue.toFixed(3)} (음수)`
  }

  return `${signal.macdHistogramValue.toFixed(3)} (중립)`
}

function getVwapText(signal: DirectionSignal, deltaPercent: number): string {
  if (signal.signals.vwap === 'bull') {
    return `VWAP ${formatPrice(signal.vwapValue)} 상단 (+${deltaPercent.toFixed(2)}%)`
  }

  if (signal.signals.vwap === 'bear') {
    return `VWAP ${formatPrice(signal.vwapValue)} 하단 (${deltaPercent.toFixed(2)}%)`
  }

  return `VWAP ${formatPrice(signal.vwapValue)} 부근`
}

function formatPremiumDiscount(zone: PremiumDiscountZone | null): string {
  if (!zone) {
    return '데이터 없음'
  }

  if (zone.currentZone === 'PREMIUM') {
    return `프리미엄 (EQ ${formatPrice(zone.equilibrium)})`
  }

  if (zone.currentZone === 'DISCOUNT') {
    return `디스카운트 (EQ ${formatPrice(zone.equilibrium)})`
  }

  return `균형 구간 (EQ ${formatPrice(zone.equilibrium)})`
}

function formatLiquiditySummary(levels: ICTAnalysis['liquidityLevels']): string {
  if (levels.length === 0) {
    return '없음'
  }

  return levels
    .slice(0, 3)
    .map((level) => `${level.type} ${formatPrice(level.price)} (${level.label})`)
    .join(' / ')
}

function getRecentStructureShifts(events: StructureShiftEvent[]): StructureShiftEvent[] {
  return events.filter((event) => event.type !== 'NONE').slice(-3).reverse()
}

function getFirstSentence(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return '요약 없음'
  }

  const match = trimmed.match(/^.*?[.!?](?:\s|$)/)
  return match ? match[0].trim() : trimmed
}

function formatTargets(targets: number[]): string {
  if (targets.length === 0) {
    return '없음'
  }

  return targets.map((target) => formatPrice(target)).join(' / ')
}

function formatStopLoss(direction: Direction, stopLoss: number | null): string {
  if (stopLoss === null) {
    return '별도 기준 없음'
  }

  if (direction === '상승') {
    return `${formatPrice(stopLoss)} 하향 이탈`
  }

  if (direction === '하락') {
    return `${formatPrice(stopLoss)} 상향 돌파`
  }

  return formatPrice(stopLoss)
}

function getAlternativeConditionText(scenario: TradeScenario): string {
  if (scenario.entryZone) {
    return `${formatZone(scenario.entryZone)} 구간에서 ${scenario.direction} 구조 확인 시 대체 시나리오를 검토합니다. ${scenario.rationale}`
  }

  return scenario.rationale
}

function getTransitionText(primaryScenario: TradeScenario, alternativeScenario: TradeScenario): string {
  if (alternativeScenario.entryZone) {
    return `${primaryScenario.invalidationCondition} 이후 ${formatZone(alternativeScenario.entryZone)} 구간 재확인이 전환 기준입니다.`
  }

  return `${primaryScenario.invalidationCondition} 이후 반대 방향 구조가 유지되면 전환을 검토합니다.`
}

function getIntermarketCorrelationText(
  correlation: NonNullable<FullDirectionResult['intermarket']>['nqSpCorrelation']
): string {
  if (correlation === 'CONVERGING') {
    return '동조'
  }

  if (correlation === 'DIVERGING') {
    return '비동조'
  }

  return '미확인'
}

function getRelativeStrengthText(
  strength: NonNullable<FullDirectionResult['intermarket']>['goldSilverRelativeStrength']
): string {
  if (strength === 'GOLD_LEADING') {
    return '금 우위'
  }

  if (strength === 'SILVER_LEADING') {
    return '은 우위'
  }

  return '중립'
}

function getRiskSentimentText(
  sentiment: NonNullable<FullDirectionResult['intermarket']>['oilRiskSentiment']
): string {
  if (sentiment === 'RISK_ON') {
    return '위험선호'
  }

  if (sentiment === 'RISK_OFF') {
    return '위험회피'
  }

  return '중립'
}

function getRiskToneClass(severity: EventRisk['severity']): string {
  if (severity === 'HIGH') {
    return 'text-red-400'
  }

  if (severity === 'MEDIUM') {
    return 'text-red-300'
  }

  return 'text-zinc-300'
}

function SectionBlock(props: SectionBlockProps) {
  const { title, children, first = false } = props

  return (
    <div className={first ? '' : 'border-t border-zinc-800 pt-4'}>
      <p className="text-xs font-medium tracking-wide text-zinc-500">{title}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  )
}

function SectionField(props: SectionFieldProps) {
  const { label, children, valueClassName = 'text-zinc-200', mono = false } = props

  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <div className={`mt-1 text-sm leading-5 ${mono ? 'font-mono' : ''} ${valueClassName}`}>
        {children}
      </div>
    </div>
  )
}

function CompactDirectionPanel(props: Omit<DirectionPanelProps, 'fullResult'>) {
  const { symbol, signal, ictAnalysis } = props
  const badgeClass = getBiasBadgeClass(signal.bias)
  const biasText = getBiasText(signal.bias)
  const directionLabel = getDirectionLabel(signal.bias)
  const rows = getSignalRows(signal)
  const deltaPercent =
    signal.vwapValue === 0 ? 0 : ((signal.lastClose - signal.vwapValue) / signal.vwapValue) * 100

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-zinc-500">{symbol}</p>
          <h3 className="text-lg font-semibold text-zinc-100">Direction</h3>
        </div>
        <div className={`rounded-md px-3 py-2 text-right ${badgeClass}`}>
          <p className="text-xs font-medium tracking-wide">{directionLabel}</p>
          <p className="text-sm font-semibold">{biasText}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div
            key={row.name}
            className="grid grid-cols-[72px_1fr_12px] items-center gap-2 text-sm"
          >
            <span className="text-zinc-400">{row.name}</span>
            <span className="text-zinc-200">{row.label}</span>
            <span className={`h-2.5 w-2.5 rounded-full ${row.dotClass}`} />
          </div>
        ))}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          ICT Analysis
        </p>

        <div className="mb-3 flex items-center justify-between rounded-md bg-zinc-800/50 px-3 py-2">
          <span className="text-xs text-zinc-400">Structure</span>
          <span
            className={`text-xs font-semibold ${
              ictAnalysis.structureBias === 'BULLISH'
                ? 'text-emerald-400'
                : ictAnalysis.structureBias === 'BEARISH'
                  ? 'text-red-400'
                  : 'text-zinc-400'
            }`}
          >
            {ictAnalysis.structureBias}
          </span>
        </div>

        <div className="mb-1 grid grid-cols-[1fr_auto] gap-2 text-xs">
          <span className="text-zinc-500">Bull OB (support)</span>
          <span className="text-emerald-400 font-mono">
            {ictAnalysis.nearestBullOB
              ? `${ictAnalysis.nearestBullOB.low.toFixed(0)}-${ictAnalysis.nearestBullOB.high.toFixed(0)}`
              : '—'}
          </span>
        </div>

        <div className="mb-3 grid grid-cols-[1fr_auto] gap-2 text-xs">
          <span className="text-zinc-500">Bear OB (resistance)</span>
          <span className="text-red-400 font-mono">
            {ictAnalysis.nearestBearOB
              ? `${ictAnalysis.nearestBearOB.low.toFixed(0)}-${ictAnalysis.nearestBearOB.high.toFixed(0)}`
              : '—'}
          </span>
        </div>

        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="text-zinc-500">Active FVGs</span>
          <span className="text-zinc-300">
            <span className="text-emerald-400">
              {ictAnalysis.fvgs.filter((f) => f.type === 'bullish').length}
            </span>
            {' bull / '}
            <span className="text-red-400">
              {ictAnalysis.fvgs.filter((f) => f.type === 'bearish').length}
            </span>
            {' bear'}
          </span>
        </div>

        {ictAnalysis.liquidityLevels.length > 0 && (
          <div className="overflow-hidden rounded-md border border-zinc-800">
            <table className="w-full text-xs">
              <thead className="bg-zinc-800/70 text-zinc-400">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Level</th>
                  <th className="px-2 py-1.5 text-right font-medium">Price</th>
                  <th className="px-2 py-1.5 text-right font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {ictAnalysis.liquidityLevels.slice(0, 6).map((lvl, index) => (
                  <tr key={`${lvl.label}-${lvl.price}-${index}`} className="border-t border-zinc-800">
                    <td className="px-2 py-1.5 text-zinc-300">{lvl.label}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-zinc-200">
                      {lvl.price.toFixed(0)}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right ${
                        lvl.type === 'BSL' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {lvl.type}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-300">
        <span>Last: {signal.lastClose.toFixed(2)}</span>
        <span>VWAP: {signal.vwapValue.toFixed(2)}</span>
        <span>Δ: {deltaPercent.toFixed(2)}%</span>
      </div>
    </section>
  )
}

function FullDirectionPanel(props: DirectionPanelProps & { fullResult: FullDirectionResult }) {
  const { symbol, timeframe, ictAnalysis, fullResult } = props
  const signal = fullResult.signal
  const report = fullResult.report
  const intermarket = fullResult.intermarket
  const htfBias = fullResult.htfBias ?? ictAnalysis.structureBias
  const badgeClass = getBiasBadgeClass(signal.bias)
  const biasText = getBiasText(signal.bias)
  const directionLabel = getDirectionLabel(signal.bias)
  const deltaPercent =
    signal.vwapValue === 0 ? 0 : ((signal.lastClose - signal.vwapValue) / signal.vwapValue) * 100
  const structureShifts = getRecentStructureShifts(ictAnalysis.structureShifts)
  const bullishFvgs = ictAnalysis.fvgs.filter((gap) => gap.type === 'bullish' && !gap.filled).length
  const bearishFvgs = ictAnalysis.fvgs.filter((gap) => gap.type === 'bearish' && !gap.filled).length
  const bslCount = ictAnalysis.liquidityLevels.filter((level) => level.type === 'BSL').length
  const sslCount = ictAnalysis.liquidityLevels.filter((level) => level.type === 'SSL').length

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-zinc-500">
            {symbol} · {timeframe}
          </p>
          <h3 className="text-lg font-semibold text-zinc-100">Direction Analysis</h3>
        </div>
        <div className={`rounded-md px-3 py-2 text-right ${badgeClass}`}>
          <p className="text-xs font-medium tracking-wide">{directionLabel}</p>
          <p className="text-sm font-semibold">{biasText}</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <SectionBlock title="1. 요약" first>
          <SectionField label="자산명">{report.asset}</SectionField>
          <SectionField label="현재 단기 방향" valueClassName={getDirectionToneClass(report.direction)}>
            <span className="font-semibold">{report.direction}</span>
          </SectionField>
          <SectionField label="확률 점수" valueClassName="text-zinc-100">
            <span className="font-semibold">{report.probabilityScore.value}점</span>
          </SectionField>
          <SectionField label="핵심 결론">{getFirstSentence(report.finalVerdict)}</SectionField>
        </SectionBlock>

        <SectionBlock title="2. 시장 구조">
          <SectionField label="HTF 추세" valueClassName={getStructureToneClass(htfBias)}>
            <span className="font-semibold">{formatStructureBias(htfBias)}</span>
          </SectionField>
          <SectionField label="LTF 구조" valueClassName={getStructureToneClass(ictAnalysis.structureBias)}>
            <span className="font-semibold">{formatStructureBias(ictAnalysis.structureBias)}</span>
          </SectionField>
          <SectionField label="BOS / CHoCH / MSS">
            {structureShifts.length > 0 ? (
              <div className="space-y-1">
                {structureShifts.map((event) => (
                  <p key={`${event.type}-${event.time}-${event.price}`}>
                    <span className="font-medium text-zinc-100">{event.type}</span>
                    {' '}
                    <span className="font-mono text-zinc-300">{formatPrice(event.price)}</span>
                    {' '}
                    <span className="text-zinc-400">{event.description}</span>
                  </p>
                ))}
              </div>
            ) : (
              '최근 구조 전환 이벤트 없음'
            )}
          </SectionField>
          <SectionField label="유동성 위치">{formatLiquiditySummary(ictAnalysis.liquidityLevels)}</SectionField>
        </SectionBlock>

        <SectionBlock title="3. ICT 체크">
          <SectionField label="Liquidity (BSL / SSL)">
            BSL {bslCount}개 / SSL {sslCount}개
          </SectionField>
          <SectionField label="FVG 수량">
            Bullish {bullishFvgs}개 / Bearish {bearishFvgs}개
          </SectionField>
          <SectionField label="Order Block 레인지">
            <div className="space-y-1">
              <p>
                <span className="text-zinc-400">Bull OB</span>
                {' '}
                <span className="font-mono text-emerald-400">
                  {formatOrderBlock(ictAnalysis.nearestBullOB)}
                </span>
              </p>
              <p>
                <span className="text-zinc-400">Bear OB</span>
                {' '}
                <span className="font-mono text-red-400">
                  {formatOrderBlock(ictAnalysis.nearestBearOB)}
                </span>
              </p>
            </div>
          </SectionField>
          <SectionField label="Premium / Discount 위치">{formatPremiumDiscount(ictAnalysis.premiumDiscount)}</SectionField>
        </SectionBlock>

        <SectionBlock title="4. 보조지표">
          <SectionField label="EMA(20 / 50 / 200) 정렬">{getEmaAlignmentText(ictAnalysis.emaContext)}</SectionField>
          <SectionField label="RSI 값">{getRsiText(signal)}</SectionField>
          <SectionField label="MACD 히스토그램">{getMacdText(signal)}</SectionField>
          <SectionField label="VWAP 위치">{getVwapText(signal, deltaPercent)}</SectionField>
        </SectionBlock>

        <SectionBlock title="5. 인터마켓">
          {intermarket ? (
            <>
              <SectionField label="NQ-SP500 동조 / 비동조">
                {getIntermarketCorrelationText(intermarket.nqSpCorrelation)}
              </SectionField>
              <SectionField label="금-은 상대강도">
                {getRelativeStrengthText(intermarket.goldSilverRelativeStrength)}
              </SectionField>
              <SectionField label="원유 위험선호">
                {getRiskSentimentText(intermarket.oilRiskSentiment)}
              </SectionField>
            </>
          ) : (
            <SectionField label="인터마켓 데이터">데이터 없음</SectionField>
          )}
        </SectionBlock>

        <SectionBlock title="6. 트레이드 시나리오 (1순위)">
          <SectionField label="방향" valueClassName={getDirectionToneClass(report.primaryScenario.direction)}>
            <span className="font-semibold">{report.primaryScenario.direction}</span>
          </SectionField>
          <SectionField label="진입 구간" mono>
            {formatZone(report.primaryScenario.entryZone)}
          </SectionField>
          <SectionField label="손절 기준" mono>
            {formatStopLoss(report.primaryScenario.direction, report.primaryScenario.stopLoss)}
          </SectionField>
          <SectionField label="목표 구간" mono>
            {formatTargets(report.primaryScenario.targets)}
          </SectionField>
          <SectionField label="무효화 조건">{report.primaryScenario.invalidationCondition}</SectionField>
        </SectionBlock>

        <SectionBlock title="7. 대체 시나리오 (2순위)">
          <SectionField label="반대 방향 조건">{getAlternativeConditionText(report.alternativeScenario)}</SectionField>
          <SectionField label="전환 조건">
            {getTransitionText(report.primaryScenario, report.alternativeScenario)}
          </SectionField>
        </SectionBlock>

        <SectionBlock title="8. 리스크 경고">
          <SectionField label="데이터 한계">
            {report.dataLimitations.length > 0 ? (
              <div className="space-y-1">
                {report.dataLimitations.map((limitation) => (
                  <p key={limitation} className="text-zinc-300">
                    {limitation}
                  </p>
                ))}
              </div>
            ) : (
              '추가 데이터 한계 없음'
            )}
          </SectionField>
          <SectionField label="이벤트 리스크">
            {report.eventRisks.length > 0 ? (
              <div className="space-y-1">
                {report.eventRisks.map((risk) => (
                  <p key={`${risk.type}-${risk.description}`} className={getRiskToneClass(risk.severity)}>
                    [{risk.severity}] {risk.description}
                  </p>
                ))}
              </div>
            ) : (
              '특이 이벤트 리스크 없음'
            )}
          </SectionField>
        </SectionBlock>

        <SectionBlock title="9. 최종 판정">
          <p className="text-sm leading-5 text-zinc-200">{report.finalVerdict}</p>
        </SectionBlock>
      </div>
    </section>
  )
}

export function DirectionPanel(props: DirectionPanelProps) {
  if (props.fullResult) {
    return <FullDirectionPanel {...props} fullResult={props.fullResult} />
  }

  return <CompactDirectionPanel {...props} />
}
