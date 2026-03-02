import type { DirectionSignal } from './directionBias'
import type { ICTAnalysis } from '../../lib/ictAnalysis'

interface DirectionPanelProps {
  symbol: string
  signal: DirectionSignal
  ictAnalysis: ICTAnalysis
  timeframe: string
}

interface SignalRow {
  name: string
  label: string
  dotClass: string
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

export function DirectionPanel(props: DirectionPanelProps) {
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
              ? `${ictAnalysis.nearestBullOB.low.toFixed(0)}–${ictAnalysis.nearestBullOB.high.toFixed(0)}`
              : '—'}
          </span>
        </div>

        <div className="mb-3 grid grid-cols-[1fr_auto] gap-2 text-xs">
          <span className="text-zinc-500">Bear OB (resistance)</span>
          <span className="text-red-400 font-mono">
            {ictAnalysis.nearestBearOB
              ? `${ictAnalysis.nearestBearOB.low.toFixed(0)}–${ictAnalysis.nearestBearOB.high.toFixed(0)}`
              : '—'}
          </span>
        </div>

        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="text-zinc-500">Active FVGs</span>
          <span className="text-zinc-300">
            <span className="text-emerald-400">
              {ictAnalysis.fvgs.filter((f: { type: string }) => f.type === 'bullish').length}
            </span>
            {' bull / '}
            <span className="text-red-400">
              {ictAnalysis.fvgs.filter((f: { type: string }) => f.type === 'bearish').length}
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
                {ictAnalysis.liquidityLevels.slice(0, 6).map(
                  (lvl: { label: string; price: number; type: string }, i: number) => (
                  <tr key={i} className="border-t border-zinc-800">
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
                  )
                )}
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
