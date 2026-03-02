import { useMemo } from 'react'
import { useMarketData } from './hooks/useMarketData'
import { MarketChart } from './components/Chart/MarketChart'
import { DirectionPanel } from './components/DirectionPanel/DirectionPanel'
import { calculateAll, type OHLCVBar, type IndicatorResults } from './lib/indicators'
import { getICTAnalysis, type ICTAnalysis } from './lib/ictAnalysis'
import { computeDirectionBias, type DirectionSignal } from './components/DirectionPanel/directionBias'

interface TimeframeData {
  bars: OHLCVBar[]
  indicators: IndicatorResults
  ictAnalysis: ICTAnalysis
  signal: DirectionSignal
}

function deriveData(bars: OHLCVBar[]): TimeframeData {
  const indicators = calculateAll(bars)
  return {
    bars,
    indicators,
    ictAnalysis: getICTAnalysis(bars),
    signal: computeDirectionBias(bars, indicators),
  }
}

interface TimeframePanelProps {
  symbol: string
  timeframe: string
  data: TimeframeData
  lastFetch: Date | null
}

function TimeframePanel({ symbol, timeframe, data }: TimeframePanelProps) {
  return (
    <div className="flex flex-col gap-0">
      <div className="grid grid-cols-[1fr_280px] gap-2">
        <MarketChart
          symbol={symbol}
          bars={data.bars}
          indicators={data.indicators}
          ictAnalysis={data.ictAnalysis}
          timeframe={timeframe}
          height={340}
        />
        <DirectionPanel
          symbol={symbol}
          signal={data.signal}
          ictAnalysis={data.ictAnalysis}
          timeframe={timeframe}
        />
      </div>
    </div>
  )
}

interface AssetSectionProps {
  symbol: 'NQ=F' | 'GC=F'
  label: string
  data15m: TimeframeData | null
  data4H: TimeframeData | null
  lastFetch: Date | null
}

function AssetSection({ symbol, label, data15m, data4H, lastFetch }: AssetSectionProps) {
  if (!data15m && !data4H) {
    return (
      <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">
        No data for {label}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-zinc-200">{label}</h2>
        {lastFetch && (
          <span className="text-xs text-zinc-600">
            Updated {lastFetch.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {data15m && (
          <TimeframePanel
            symbol={symbol}
            timeframe="15m"
            data={data15m}
            lastFetch={lastFetch}
          />
        )}
        {data4H && (
          <>
            <div className="border-t border-zinc-800/60" />
            <TimeframePanel
              symbol={symbol}
              timeframe="4H"
              data={data4H}
              lastFetch={lastFetch}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const { data, loading, refreshing, lastFetch, refresh } = useMarketData()

  const nq15m = useMemo(() => {
    const bars = data['15m']['NQ=F']?.bars ?? []
    return bars.length ? deriveData(bars) : null
  }, [data])

  const nq4H = useMemo(() => {
    const bars = data['4H']['NQ=F']?.bars ?? []
    return bars.length ? deriveData(bars) : null
  }, [data])

  const gc15m = useMemo(() => {
    const bars = data['15m']['GC=F']?.bars ?? []
    return bars.length ? deriveData(bars) : null
  }, [data])

  const gc4H = useMemo(() => {
    const bars = data['4H']['GC=F']?.bars ?? []
    return bars.length ? deriveData(bars) : null
  }, [data])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4">
      <div className="max-w-[1600px] mx-auto flex flex-col gap-6">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <h1 className="text-lg font-bold text-zinc-100">Market Compass</h1>
            <p className="text-xs text-zinc-500">Intraday Analysis — 15m + 4H · ICT Method</p>
          </div>
          <button
            onClick={() => { void refresh() }}
            disabled={refreshing}
            className={`text-xs border rounded px-3 py-1.5 transition-colors flex items-center gap-1.5
              ${refreshing
                ? 'text-zinc-500 border-zinc-800 cursor-not-allowed'
                : 'text-zinc-400 hover:text-zinc-200 border-zinc-700 cursor-pointer'
              }`}
          >
            <span className={refreshing ? 'animate-spin inline-block' : ''}>↻</span>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </header>

        {loading && (
          <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
            Fetching market data...
          </div>
        )}

        {!loading && (
          <>
            <AssetSection
              symbol="NQ=F"
              label="Nasdaq 100 Futures (NQ=F)"
              data15m={nq15m}
              data4H={nq4H}
              lastFetch={lastFetch}
            />
            <div className="border-t border-zinc-700" />
            <AssetSection
              symbol="GC=F"
              label="Gold Futures (GC=F)"
              data15m={gc15m}
              data4H={gc4H}
              lastFetch={lastFetch}
            />
          </>
        )}

        {!loading && !nq15m && !gc15m && (
          <div className="flex items-center justify-center h-32 text-red-500 text-sm">
            Failed to load market data. Is the server running on port 3001?
          </div>
        )}
      </div>
    </div>
  )
}
