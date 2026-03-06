import { useMemo, useState, type ComponentProps } from 'react'
import { SUPPORTED_SYMBOLS, useMarketData, type SupportedSymbol } from './hooks/useMarketData'
import { MarketChart } from './components/Chart/MarketChart'
import { DirectionPanel } from './components/DirectionPanel/DirectionPanel'
import { calculateAll, type OHLCVBar, type IndicatorResults } from './lib/indicators'
import { getICTAnalysis, type ICTAnalysis } from './lib/ictAnalysis'
import {
  computeFullAnalysis,
  type DirectionSignal,
  type FullDirectionResult,
} from './components/DirectionPanel/directionBias'
import { analyzeIntermarket, type IntermarketAnalysis } from './lib/intermarket'

type Timeframe = '15m' | '4H'

interface TimeframeData {
  bars: OHLCVBar[]
  indicators: IndicatorResults
  ictAnalysis: ICTAnalysis
  signal: DirectionSignal
  fullResult: FullDirectionResult | null
}

interface PreparedTimeframeData {
  bars: OHLCVBar[]
  indicators: IndicatorResults
  ictAnalysis: ICTAnalysis
}

type AssetTimeframes = Record<Timeframe, TimeframeData | null>
type PreparedAssetTimeframes = Record<Timeframe, PreparedTimeframeData | null>

const ASSET_TABS: Array<{ symbol: SupportedSymbol; label: string; shortLabel: string; tag: string }> = [
  { symbol: 'NQ=F', label: 'Nasdaq 100 Futures', shortLabel: 'NQ', tag: 'NQ=F' },
  { symbol: 'ES=F', label: 'S&P 500 Futures',    shortLabel: 'ES', tag: 'ES=F' },
  { symbol: 'GC=F', label: 'Gold Futures',        shortLabel: 'GC', tag: 'GC=F' },
  { symbol: 'SI=F', label: 'Silver Futures',      shortLabel: 'SI', tag: 'SI=F' },
  { symbol: 'CL=F', label: 'Crude Oil Futures',   shortLabel: 'CL', tag: 'CL=F' },
]

const DirectionPanelWithAnalysis = DirectionPanel as unknown as (
  props: ComponentProps<typeof DirectionPanel> & {
    fullResult?: FullDirectionResult | null
    intermarket?: IntermarketAnalysis | null
  }
) => ReturnType<typeof DirectionPanel>

function prepareTimeframeData(bars: OHLCVBar[]): PreparedTimeframeData {
  const indicators = calculateAll(bars)
  return { bars, indicators, ictAnalysis: getICTAnalysis(bars) }
}

function deriveData(params: {
  asset: SupportedSymbol
  timeframe: Timeframe
  prepared: PreparedTimeframeData
  htfBias: ICTAnalysis['structureBias']
  intermarket: IntermarketAnalysis | null
}): TimeframeData {
  const fullResult = computeFullAnalysis({
    asset: params.asset,
    timeframe: params.timeframe,
    bars: params.prepared.bars,
    indicators: params.prepared.indicators,
    ictAnalysis: params.prepared.ictAnalysis,
    htfBias: params.htfBias,
    intermarket: params.intermarket ?? undefined,
  })
  return {
    bars: params.prepared.bars,
    indicators: params.prepared.indicators,
    ictAnalysis: params.prepared.ictAnalysis,
    signal: fullResult.signal,
    fullResult,
  }
}

function getBiasDot(bias: ICTAnalysis['structureBias'] | undefined): string {
  if (bias === 'BULLISH') return 'bg-emerald-400'
  if (bias === 'BEARISH') return 'bg-red-400'
  return 'bg-zinc-600'
}

function getBiasColor(bias: ICTAnalysis['structureBias'] | undefined): string {
  if (bias === 'BULLISH') return 'text-emerald-400'
  if (bias === 'BEARISH') return 'text-red-400'
  return 'text-zinc-500'
}

interface TimeframePanelProps {
  symbol: string
  timeframe: string
  data: TimeframeData
}

function TimeframePanel({ symbol, timeframe, data }: TimeframePanelProps) {
  return (
    <div className="grid grid-cols-[1fr_300px] gap-3">
      <MarketChart
        symbol={symbol}
        bars={data.bars}
        indicators={data.indicators}
        ictAnalysis={data.ictAnalysis}
        timeframe={timeframe}
        height={360}
      />
      <DirectionPanelWithAnalysis
        symbol={symbol}
        signal={data.signal}
        ictAnalysis={data.ictAnalysis}
        timeframe={timeframe}
        fullResult={data.fullResult}
        intermarket={data.fullResult?.intermarket ?? null}
      />
    </div>
  )
}

interface AssetViewProps {
  symbol: SupportedSymbol
  label: string
  data15m: TimeframeData | null
  data4H: TimeframeData | null
  lastFetch: Date | null
}

function AssetView({ symbol, label, data15m, data4H, lastFetch }: AssetViewProps) {
  const [activeTimeframe, setActiveTimeframe] = useState<'15m' | '4H'>('15m')

  if (!data15m && !data4H) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
        No data for {label}
      </div>
    )
  }

  const activeData = activeTimeframe === '15m' ? data15m : data4H
  const bias15m = data15m?.ictAnalysis.structureBias
  const bias4H  = data4H?.ictAnalysis.structureBias

  return (
    <div className="flex flex-col gap-4">
      {/* Timeframe sub-tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {(['15m', '4H'] as const).map((tf) => {
            const isActive = activeTimeframe === tf
            const available = tf === '15m' ? !!data15m : !!data4H
            const bias = tf === '15m' ? bias15m : bias4H
            return (
              <button
                key={tf}
                onClick={() => available && setActiveTimeframe(tf)}
                disabled={!available}
                className={`
                  flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${isActive
                    ? 'bg-zinc-700 text-zinc-100'
                    : available
                      ? 'text-zinc-400 hover:text-zinc-200 cursor-pointer'
                      : 'text-zinc-700 cursor-not-allowed'
                  }
                `}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${getBiasDot(bias)}`} />
                {tf}
                <span className={`text-[10px] ${getBiasColor(bias)}`}>
                  {bias === 'BULLISH' ? '▲' : bias === 'BEARISH' ? '▼' : '─'}
                </span>
              </button>
            )
          })}
        </div>
        {lastFetch && (
          <span className="text-xs text-zinc-600">Updated {lastFetch.toLocaleTimeString()}</span>
        )}
      </div>

      {activeData
        ? <TimeframePanel symbol={symbol} timeframe={activeTimeframe} data={activeData} />
        : (
          <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">
            No {activeTimeframe} data available
          </div>
        )
      }
    </div>
  )
}

export default function App() {
  const { data, loading, refreshing, lastFetch, refresh } = useMarketData()
  const [activeTab, setActiveTab] = useState<SupportedSymbol>('NQ=F')

  const assetData = useMemo(() => {
    const prepared = Object.fromEntries(
      SUPPORTED_SYMBOLS.map((symbol) => {
        const bars15m = data['15m'][symbol]?.bars ?? []
        const bars4H  = data['4H'][symbol]?.bars ?? []
        return [
          symbol,
          {
            '15m': bars15m.length ? prepareTimeframeData(bars15m) : null,
            '4H':  bars4H.length  ? prepareTimeframeData(bars4H)  : null,
          },
        ]
      }),
    ) as Record<SupportedSymbol, PreparedAssetTimeframes>

    const intermarket = analyzeIntermarket(
      Object.fromEntries(
        SUPPORTED_SYMBOLS.flatMap((symbol) => {
          const source = prepared[symbol]['4H'] ?? prepared[symbol]['15m']
          return source
            ? [[symbol, { bars: source.bars, structureBias: source.ictAnalysis.structureBias }]]
            : []
        }),
      ),
    )

    return Object.fromEntries(
      SUPPORTED_SYMBOLS.map((symbol) => {
        const d15m    = prepared[symbol]['15m']
        const d4H     = prepared[symbol]['4H']
        const htfBias = d4H?.ictAnalysis.structureBias ?? 'RANGING'
        return [
          symbol,
          {
            '15m': d15m ? deriveData({ asset: symbol, timeframe: '15m', prepared: d15m, htfBias, intermarket }) : null,
            '4H':  d4H  ? deriveData({ asset: symbol, timeframe: '4H',  prepared: d4H,  htfBias, intermarket }) : null,
          },
        ]
      }),
    ) as Record<SupportedSymbol, AssetTimeframes>
  }, [data])

  const hasAny      = SUPPORTED_SYMBOLS.some((s) => assetData[s]['15m'])
  const activeAsset = ASSET_TABS.find((t) => t.symbol === activeTab)!

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Top header ── */}
      <header className="border-b border-zinc-800 px-5 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-zinc-100 tracking-tight">Market Compass</h1>
          <p className="text-[11px] text-zinc-500">
            Intraday Analysis · ICT Method · Murphy Intermarket
          </p>
        </div>
        <button
          onClick={() => { void refresh() }}
          disabled={refreshing}
          className={`text-xs border rounded px-3 py-1.5 flex items-center gap-1.5 transition-colors
            ${refreshing
              ? 'text-zinc-600 border-zinc-800 cursor-not-allowed'
              : 'text-zinc-400 hover:text-zinc-200 border-zinc-700 cursor-pointer'
            }`}
        >
          <span className={refreshing ? 'animate-spin inline-block' : ''}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {/* ── Asset tab bar ── */}
      <div className="border-b border-zinc-800 px-5 bg-zinc-950">
        <div className="flex items-end gap-0 -mb-px overflow-x-auto">
          {ASSET_TABS.map(({ symbol, label, shortLabel, tag }) => {
            const isActive = activeTab === symbol
            const d        = assetData[symbol]
            const bias     = d?.['4H']?.ictAnalysis.structureBias ?? d?.['15m']?.ictAnalysis.structureBias
            const hasData  = !loading && (!!d?.['15m'] || !!d?.['4H'])

            return (
              <button
                key={symbol}
                onClick={() => setActiveTab(symbol)}
                className={`
                  group flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2
                  transition-colors whitespace-nowrap flex-shrink-0 cursor-pointer
                  ${isActive
                    ? 'border-zinc-300 text-zinc-100'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }
                `}
              >
                {hasData && (
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${getBiasDot(bias)}`} />
                )}
                <span className="hidden md:inline">{label}</span>
                <span className="md:hidden font-mono">{shortLabel}</span>
                <span className={`
                  text-[10px] font-mono px-1.5 py-0.5 rounded hidden sm:inline
                  ${isActive ? 'bg-zinc-800 text-zinc-400' : 'text-zinc-700 group-hover:text-zinc-600'}
                `}>
                  {tag}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="max-w-[1600px] mx-auto px-5 py-5">
        {loading && (
          <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
            Fetching market data…
          </div>
        )}

        {!loading && hasAny && (
          <AssetView
            key={activeTab}
            symbol={activeTab}
            label={activeAsset.label}
            data15m={assetData[activeTab]['15m']}
            data4H={assetData[activeTab]['4H']}
            lastFetch={lastFetch}
          />
        )}

        {!loading && !hasAny && (
          <div className="flex items-center justify-center h-48 text-red-500 text-sm">
            Failed to load market data. Is the server running on port 3001?
          </div>
        )}
      </main>
    </div>
  )
}
