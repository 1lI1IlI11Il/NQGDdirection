import { Fragment, useMemo, type ComponentProps } from 'react'
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

const ASSET_SECTIONS: Array<{ symbol: SupportedSymbol; label: string }> = [
  { symbol: 'NQ=F', label: 'Nasdaq 100 Futures (NQ=F)' },
  { symbol: 'GC=F', label: 'Gold Futures (GC=F)' },
  { symbol: 'SI=F', label: 'Silver Futures (SI=F)' },
  { symbol: 'CL=F', label: 'Crude Oil Futures (CL=F)' },
  { symbol: 'ES=F', label: 'S&P 500 Futures (ES=F)' },
]

const DirectionPanelWithAnalysis = DirectionPanel as unknown as (
  props: ComponentProps<typeof DirectionPanel> & {
    fullResult?: FullDirectionResult | null
    intermarket?: IntermarketAnalysis | null
  }
) => ReturnType<typeof DirectionPanel>

function prepareTimeframeData(bars: OHLCVBar[]): PreparedTimeframeData {
  const indicators = calculateAll(bars)
  return {
    bars,
    indicators,
    ictAnalysis: getICTAnalysis(bars),
  }
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
        <DirectionPanelWithAnalysis
          symbol={symbol}
          signal={data.signal}
          ictAnalysis={data.ictAnalysis}
          timeframe={timeframe}
          fullResult={data.fullResult}
          intermarket={data.fullResult?.intermarket ?? null}
        />
      </div>
    </div>
  )
}

interface AssetSectionProps {
  symbol: SupportedSymbol
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

  const assetData = useMemo(() => {
    const prepared = Object.fromEntries(
      SUPPORTED_SYMBOLS.map((symbol) => {
        const bars15m = data['15m'][symbol]?.bars ?? []
        const bars4H = data['4H'][symbol]?.bars ?? []

        return [
          symbol,
          {
            '15m': bars15m.length ? prepareTimeframeData(bars15m) : null,
            '4H': bars4H.length ? prepareTimeframeData(bars4H) : null,
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
        const data15m = prepared[symbol]['15m']
        const data4H = prepared[symbol]['4H']
        const htfBias = data4H?.ictAnalysis.structureBias ?? 'RANGING'

        return [
          symbol,
          {
            '15m': data15m
              ? deriveData({
                  asset: symbol,
                  timeframe: '15m',
                  prepared: data15m,
                  htfBias,
                  intermarket,
                })
              : null,
            '4H': data4H
              ? deriveData({
                  asset: symbol,
                  timeframe: '4H',
                  prepared: data4H,
                  htfBias,
                  intermarket,
                })
              : null,
          },
        ]
      }),
    ) as Record<SupportedSymbol, AssetTimeframes>
  }, [data])

  const hasAny15mData = useMemo(
    () => SUPPORTED_SYMBOLS.some((symbol) => assetData[symbol]['15m']),
    [assetData],
  )

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
            {ASSET_SECTIONS.map(({ symbol, label }, index) => (
              <Fragment key={symbol}>
                {index > 0 && <div className="border-t border-zinc-700" />}
                <AssetSection
                  symbol={symbol}
                  label={label}
                  data15m={assetData[symbol]['15m']}
                  data4H={assetData[symbol]['4H']}
                  lastFetch={lastFetch}
                />
              </Fragment>
            ))}
          </>
        )}

        {!loading && !hasAny15mData && (
          <div className="flex items-center justify-center h-32 text-red-500 text-sm">
            Failed to load market data. Is the server running on port 3001?
          </div>
        )}
      </div>
    </div>
  )
}
