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
    return 'None'
  }

  return `${formatPrice(zone.low)} - ${formatPrice(zone.high)}`
}

function formatOrderBlock(block: OrderBlock | null): string {
  if (!block) {
    return 'None'
  }

  return `${formatPrice(block.low)} - ${formatPrice(block.high)}`
}

function formatOptionalPrice(value: number | undefined): string {
  return value === undefined ? '-' : formatPrice(value)
}

function getDirectionToneClass(direction: Direction): string {
  if (direction === 'Bullish') {
    return 'text-emerald-400'
  }

  if (direction === 'Bearish') {
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
    return 'Bullish'
  }

  if (bias === 'BEARISH') {
    return 'Bearish'
  }

  return 'Ranging'
}

function getEmaAlignmentText(emaContext: ICTAnalysis['emaContext']): string {
  if (!emaContext) {
    return 'No data'
  }

  const emaValues = `${formatOptionalPrice(emaContext.ema20)} / ${formatOptionalPrice(emaContext.ema50)} / ${formatOptionalPrice(emaContext.ema200)}`

  if (emaContext.alignment === 'BULLISH') {
    return `Bullish alignment (${emaValues})`
  }

  if (emaContext.alignment === 'BEARISH') {
    return `Bearish alignment (${emaValues})`
  }

  return `Mixed alignment (${emaValues})`
}

function getRsiText(signal: DirectionSignal): string {
  if (signal.signals.rsi === 'oversold') {
    return `${signal.rsiValue.toFixed(1)} (oversold)`
  }

  if (signal.signals.rsi === 'overbought') {
    return `${signal.rsiValue.toFixed(1)} (overbought)`
  }

  return `${signal.rsiValue.toFixed(1)} (neutral)`
}

function getMacdText(signal: DirectionSignal): string {
  if (signal.macdHistogramValue === undefined) {
    if (signal.signals.macd === 'bull') {
      return 'Positive'
    }

    if (signal.signals.macd === 'bear') {
      return 'Negative'
    }

    return 'Neutral'
  }

  if (signal.macdHistogramValue > 0) {
    return `${signal.macdHistogramValue.toFixed(3)} (positive)`
  }

  if (signal.macdHistogramValue < 0) {
    return `${signal.macdHistogramValue.toFixed(3)} (negative)`
  }

  return `${signal.macdHistogramValue.toFixed(3)} (neutral)`
}

function getVwapText(signal: DirectionSignal, deltaPercent: number): string {
  if (signal.signals.vwap === 'bull') {
    return `Above VWAP ${formatPrice(signal.vwapValue)} (+${deltaPercent.toFixed(2)}%)`
  }

  if (signal.signals.vwap === 'bear') {
    return `Below VWAP ${formatPrice(signal.vwapValue)} (${deltaPercent.toFixed(2)}%)`
  }

  return `Near VWAP ${formatPrice(signal.vwapValue)}`
}

function formatPremiumDiscount(zone: PremiumDiscountZone | null): string {
  if (!zone) {
    return 'No data'
  }

  if (zone.currentZone === 'PREMIUM') {
    return `Premium (EQ ${formatPrice(zone.equilibrium)})`
  }

  if (zone.currentZone === 'DISCOUNT') {
    return `Discount (EQ ${formatPrice(zone.equilibrium)})`
  }

  return `Equilibrium zone (EQ ${formatPrice(zone.equilibrium)})`
}

function formatLiquiditySummary(levels: ICTAnalysis['liquidityLevels']): string {
  if (levels.length === 0) {
    return 'None'
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
    return 'No summary'
  }

  const match = trimmed.match(/^.*?[.!?](?:\s|$)/)
  return match ? match[0].trim() : trimmed
}

function formatTargets(targets: number[]): string {
  if (targets.length === 0) {
    return 'None'
  }

  return targets.map((target) => formatPrice(target)).join(' / ')
}

function formatStopLoss(direction: Direction, stopLoss: number | null): string {
  if (stopLoss === null) {
    return 'No explicit stop'
  }

  if (direction === 'Bullish') {
    return `Break below ${formatPrice(stopLoss)}`
  }

  if (direction === 'Bearish') {
    return `Break above ${formatPrice(stopLoss)}`
  }

  return formatPrice(stopLoss)
}

function getAlternativeConditionText(scenario: TradeScenario): string {
  if (scenario.entryZone) {
    return `Review the alternative scenario if ${scenario.direction.toLowerCase()} structure confirms around ${formatZone(scenario.entryZone)}. ${scenario.rationale}`
  }

  return scenario.rationale
}

function getTransitionText(primaryScenario: TradeScenario, alternativeScenario: TradeScenario): string {
  if (alternativeScenario.entryZone) {
    return `Use a retest of ${formatZone(alternativeScenario.entryZone)} as the transition trigger after: ${primaryScenario.invalidationCondition}`
  }

  return `Consider the transition if opposite-side structure holds after: ${primaryScenario.invalidationCondition}`
}

function getIntermarketCorrelationText(
  correlation: NonNullable<FullDirectionResult['intermarket']>['nqSpCorrelation']
): string {
  if (correlation === 'CONVERGING') {
    return 'Converging'
  }

  if (correlation === 'DIVERGING') {
    return 'Diverging'
  }

  return 'Unconfirmed'
}

function getRelativeStrengthText(
  strength: NonNullable<FullDirectionResult['intermarket']>['goldSilverRelativeStrength']
): string {
  if (strength === 'GOLD_LEADING') {
    return 'Gold leading'
  }

  if (strength === 'SILVER_LEADING') {
    return 'Silver leading'
  }

  return 'Neutral'
}

function getRiskSentimentText(
  sentiment: NonNullable<FullDirectionResult['intermarket']>['oilRiskSentiment']
): string {
  if (sentiment === 'RISK_ON') {
    return 'Risk-on'
  }

  if (sentiment === 'RISK_OFF') {
    return 'Risk-off'
  }

  return 'Neutral'
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
  const { title, children } = props

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">{title}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  )
}

function SectionField(props: SectionFieldProps) {
  const { label, children, valueClassName = 'text-zinc-200', mono = false } = props

  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <div className={`mt-1.5 text-sm leading-6 ${mono ? 'font-mono' : ''} ${valueClassName}`}>
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
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(39,39,42,0.72),rgba(24,24,27,0.94))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{symbol}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-zinc-100">Direction</h3>
          <p className="mt-1 text-sm text-zinc-500">Condensed bias read for fast market scanning.</p>
        </div>
        <div className={`rounded-2xl px-3 py-2 text-right ${badgeClass}`}>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em]">{directionLabel}</p>
          <p className="text-sm font-semibold">{biasText}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        {rows.map((row) => (
          <div
            key={row.name}
            className="grid grid-cols-[72px_1fr_12px] items-center gap-2 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5 text-sm"
          >
            <span className="text-zinc-400">{row.name}</span>
            <span className="text-zinc-200">{row.label}</span>
            <span className={`h-2.5 w-2.5 rounded-full ${row.dotClass}`} />
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-500">
          ICT Analysis
        </p>

        <div className="mb-3 flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
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
          <div className="overflow-hidden rounded-xl border border-white/8">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.04] text-zinc-400">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Level</th>
                  <th className="px-2 py-1.5 text-right font-medium">Price</th>
                  <th className="px-2 py-1.5 text-right font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {ictAnalysis.liquidityLevels.slice(0, 6).map((lvl, index) => (
                  <tr key={`${lvl.label}-${lvl.price}-${index}`} className="border-t border-white/6">
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

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
        <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">Last: {signal.lastClose.toFixed(2)}</span>
        <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">VWAP: {signal.vwapValue.toFixed(2)}</span>
        <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">Δ: {deltaPercent.toFixed(2)}%</span>
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
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(39,39,42,0.72),rgba(24,24,27,0.94))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
            {symbol} · {timeframe}
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-zinc-100">Direction Analysis</h3>
          <p className="mt-1 text-sm text-zinc-500">Structured market readout with scenario depth and risk context.</p>
        </div>
        <div className={`rounded-2xl px-3 py-2 text-right ${badgeClass}`}>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em]">{directionLabel}</p>
          <p className="text-sm font-semibold">{biasText}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Executive summary</p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">{getFirstSentence(report.finalVerdict)}</p>
            </div>
            <div className="min-w-[160px] rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Probability</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-100">{report.probabilityScore.value}<span className="ml-1 text-sm text-zinc-500">/100</span></p>
                </div>
                <span className={`text-sm font-semibold ${getDirectionToneClass(report.direction)}`}>{report.direction}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-zinc-100" style={{ width: `${report.probabilityScore.value}%` }} />
              </div>
            </div>
          </div>
        </div>

        <SectionBlock title="1. Summary">
          <SectionField label="Asset">{report.asset}</SectionField>
          <SectionField label="Current Direction" valueClassName={getDirectionToneClass(report.direction)}>
            <span className="font-semibold">{report.direction}</span>
          </SectionField>
          <SectionField label="Probability Score" valueClassName="text-zinc-100">
            <span className="font-semibold">{report.probabilityScore.value} pts</span>
          </SectionField>
        </SectionBlock>

        <div className="grid gap-4 xl:grid-cols-2">
        <SectionBlock title="2. Market Structure">
          <SectionField label="HTF Bias" valueClassName={getStructureToneClass(htfBias)}>
            <span className="font-semibold">{formatStructureBias(htfBias)}</span>
          </SectionField>
          <SectionField label="LTF Structure" valueClassName={getStructureToneClass(ictAnalysis.structureBias)}>
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
              'No recent structure-shift events'
            )}
          </SectionField>
          <SectionField label="Liquidity Position">{formatLiquiditySummary(ictAnalysis.liquidityLevels)}</SectionField>
        </SectionBlock>

        <SectionBlock title="3. ICT Checks">
          <SectionField label="Liquidity (BSL / SSL)">
            BSL {bslCount} / SSL {sslCount}
          </SectionField>
          <SectionField label="FVG Count">
            Bullish {bullishFvgs} / Bearish {bearishFvgs}
          </SectionField>
          <SectionField label="Order Block Range">
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
          <SectionField label="Premium / Discount Zone">{formatPremiumDiscount(ictAnalysis.premiumDiscount)}</SectionField>
        </SectionBlock>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
        <SectionBlock title="4. Indicator Readings">
          <SectionField label="EMA(20 / 50 / 200) Alignment">{getEmaAlignmentText(ictAnalysis.emaContext)}</SectionField>
          <SectionField label="RSI Reading">{getRsiText(signal)}</SectionField>
          <SectionField label="MACD Histogram">{getMacdText(signal)}</SectionField>
          <SectionField label="VWAP Position">{getVwapText(signal, deltaPercent)}</SectionField>
        </SectionBlock>

        <SectionBlock title="5. Intermarket">
          {intermarket ? (
            <>
              <SectionField label="NQ-S&P 500 Correlation">
                {getIntermarketCorrelationText(intermarket.nqSpCorrelation)}
              </SectionField>
              <SectionField label="Gold-Silver Relative Strength">
                {getRelativeStrengthText(intermarket.goldSilverRelativeStrength)}
              </SectionField>
              <SectionField label="Oil Risk Sentiment">
                {getRiskSentimentText(intermarket.oilRiskSentiment)}
              </SectionField>
            </>
          ) : (
            <SectionField label="Intermarket Data">No data</SectionField>
          )}
        </SectionBlock>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
        <SectionBlock title="6. Primary Trade Scenario">
          <SectionField label="Direction" valueClassName={getDirectionToneClass(report.primaryScenario.direction)}>
            <span className="font-semibold">{report.primaryScenario.direction}</span>
          </SectionField>
          <SectionField label="Entry Zone" mono>
            {formatZone(report.primaryScenario.entryZone)}
          </SectionField>
          <SectionField label="Stop Condition" mono>
            {formatStopLoss(report.primaryScenario.direction, report.primaryScenario.stopLoss)}
          </SectionField>
          <SectionField label="Target Zone" mono>
            {formatTargets(report.primaryScenario.targets)}
          </SectionField>
          <SectionField label="Invalidation">{report.primaryScenario.invalidationCondition}</SectionField>
        </SectionBlock>

        <SectionBlock title="7. Alternative Scenario">
          <SectionField label="Opposite-Side Trigger">{getAlternativeConditionText(report.alternativeScenario)}</SectionField>
          <SectionField label="Transition Condition">
            {getTransitionText(report.primaryScenario, report.alternativeScenario)}
          </SectionField>
        </SectionBlock>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionBlock title="8. Risk Alerts">
          <SectionField label="Data Limitations">
            {report.dataLimitations.length > 0 ? (
              <div className="space-y-1">
                {report.dataLimitations.map((limitation) => (
                  <p key={limitation} className="text-zinc-300">
                    {limitation}
                  </p>
                ))}
              </div>
            ) : (
              'No additional data limitations'
            )}
          </SectionField>
          <SectionField label="Event Risk">
            {report.eventRisks.length > 0 ? (
              <div className="space-y-1">
                {report.eventRisks.map((risk) => (
                  <p key={`${risk.type}-${risk.description}`} className={getRiskToneClass(risk.severity)}>
                    [{risk.severity}] {risk.description}
                  </p>
                ))}
              </div>
            ) : (
              'No notable event risk'
            )}
          </SectionField>
        </SectionBlock>

        <SectionBlock title="9. Final Verdict">
          <p className="text-sm leading-5 text-zinc-200">{report.finalVerdict}</p>
        </SectionBlock>
        </div>
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
