import { useMemo, useState, useEffect } from 'react'
import {
  SUPPORTED_SYMBOLS,
  REFRESH_INTERVAL_FAST_MS,
  REFRESH_INTERVAL_SLOW_MS,
  useMarketData,
  type SupportedSymbol,
} from './hooks/useMarketData'
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
  { symbol: 'ES=F', label: 'S&P 500 Futures', shortLabel: 'ES', tag: 'ES=F' },
  { symbol: 'GC=F', label: 'Gold Futures', shortLabel: 'GC', tag: 'GC=F' },
  { symbol: 'SI=F', label: 'Silver Futures', shortLabel: 'SI', tag: 'SI=F' },
  { symbol: 'CL=F', label: 'Crude Oil Futures', shortLabel: 'CL', tag: 'CL=F' },
  { symbol: '^KS11', label: 'KOSPI', shortLabel: 'KOSPI', tag: '^KS11' },
  { symbol: '^KQ11', label: 'KOSDAQ', shortLabel: 'KOSDAQ', tag: '^KQ11' },
]

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

function getBiasText(bias: ICTAnalysis['structureBias'] | undefined): string {
  if (bias === 'BULLISH') return 'Bullish'
  if (bias === 'BEARISH') return 'Bearish'
  return 'Ranging'
}

function getBiasColor(bias: ICTAnalysis['structureBias'] | undefined): string {
  if (bias === 'BULLISH') return 'text-emerald-300'
  if (bias === 'BEARISH') return 'text-red-300'
  return 'text-zinc-400'
}

function getAssetCardClass(isActive: boolean, hasData: boolean): string {
  if (isActive) {
    return 'border-zinc-700 bg-white/[0.07] text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
  }

  if (hasData) {
    return 'border-white/8 bg-white/[0.03] text-zinc-300 hover:border-white/14 hover:bg-white/[0.05]'
  }

  return 'border-white/6 bg-white/[0.02] text-zinc-500 hover:text-zinc-300'
}

function getTimeframeButtonClass(isActive: boolean, available: boolean): string {
  if (isActive) {
    return 'border-zinc-700 bg-zinc-100 text-zinc-950 shadow-sm'
  }

  if (available) {
    return 'border-white/8 bg-white/[0.03] text-zinc-300 hover:border-white/14 hover:bg-white/[0.06]'
  }

  return 'border-white/6 bg-white/[0.02] text-zinc-600 cursor-not-allowed'
}

interface TimeframePanelProps {
  symbol: string
  timeframe: string
  data: TimeframeData
}

function TimeframePanel({ symbol, timeframe, data }: TimeframePanelProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
      <div className="min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-[var(--panel)] shadow-[var(--shadow-lg)] backdrop-blur">
        <MarketChart
          symbol={symbol}
          bars={data.bars}
          indicators={data.indicators}
          ictAnalysis={data.ictAnalysis}
          timeframe={timeframe}
          height={360}
        />
      </div>
      <div className="min-w-0">
        <DirectionPanel
          symbol={symbol}
          signal={data.signal}
          ictAnalysis={data.ictAnalysis}
          timeframe={timeframe}
          fullResult={data.fullResult}
        />
      </div>
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
      <div className="rounded-[28px] border border-white/10 bg-[var(--panel)] px-6 py-12 text-center shadow-[var(--shadow-lg)] backdrop-blur">
        <p className="text-sm font-medium text-zinc-200">No data for {label}</p>
        <p className="mt-2 text-sm text-zinc-500">Try another symbol or wait for the next market refresh.</p>
      </div>
    )
  }

  const activeData = activeTimeframe === '15m' ? data15m : data4H
  const bias15m = data15m?.ictAnalysis.structureBias
  const bias4H = data4H?.ictAnalysis.structureBias

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[28px] border border-white/10 bg-[var(--panel)] p-4 shadow-[var(--shadow-lg)] backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">Active Market</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">{label}</h2>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-400">
                <span className={`h-2 w-2 rounded-full ${getBiasDot(activeData?.ictAnalysis.structureBias)}`} />
                <span className={getBiasColor(activeData?.ictAnalysis.structureBias)}>
                  {getBiasText(activeData?.ictAnalysis.structureBias)}
                </span>
                <span className="text-zinc-600">/</span>
                <span>{symbol}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-1.5">
            {(['15m', '4H'] as const).map((tf) => {
              const isActive = activeTimeframe === tf
              const available = tf === '15m' ? !!data15m : !!data4H
              const bias = tf === '15m' ? bias15m : bias4H

              return (
                <button
                  key={tf}
                  onClick={() => available && setActiveTimeframe(tf)}
                  disabled={!available}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${getTimeframeButtonClass(isActive, available)}`}
                >
                  <span className={`h-2 w-2 rounded-full ${getBiasDot(bias)}`} />
                  <span>{tf}</span>
                  <span className={`text-[11px] ${getBiasColor(bias)}`}>
                    {bias === 'BULLISH' ? '▲' : bias === 'BEARISH' ? '▼' : '─'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/8 pt-4 text-xs text-zinc-500">
          <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1">Two-timeframe bias review</span>
          {lastFetch && (
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-zinc-400">
              Updated {formatLastFetch(lastFetch)}
            </span>
          )}
        </div>
      </div>

      {activeData ? (
        <TimeframePanel symbol={symbol} timeframe={activeTimeframe} data={activeData} />
      ) : (
        <div className="rounded-[28px] border border-white/10 bg-[var(--panel)] px-6 py-12 text-center shadow-[var(--shadow-lg)] backdrop-blur">
          <p className="text-sm font-medium text-zinc-200">No {activeTimeframe} data available</p>
        </div>
      )}
    </div>
  )
}

function useCountdown(nextFetchAt: Date | null): number {
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (!nextFetchAt) return

    const tick = () => {
      setSecondsLeft(Math.max(0, Math.round((nextFetchAt.getTime() - Date.now()) / 1000)))
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [nextFetchAt])

  return secondsLeft
}

function formatLastFetch(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date)
}

export default function App() {
  const [liveMode, setLiveMode] = useState(true)
  const intervalMs = liveMode ? REFRESH_INTERVAL_FAST_MS : REFRESH_INTERVAL_SLOW_MS
  const { data, loading, refreshing, lastFetch, nextFetchAt, refresh } = useMarketData(intervalMs)
  const [activeTab, setActiveTab] = useState<SupportedSymbol>('NQ=F')
  const countdown = useCountdown(nextFetchAt)

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
        const d15m = prepared[symbol]['15m']
        const d4H = prepared[symbol]['4H']
        const htfBias = d4H?.ictAnalysis.structureBias ?? 'RANGING'

        return [
          symbol,
          {
            '15m': d15m ? deriveData({ asset: symbol, timeframe: '15m', prepared: d15m, htfBias, intermarket }) : null,
            '4H': d4H ? deriveData({ asset: symbol, timeframe: '4H', prepared: d4H, htfBias, intermarket }) : null,
          },
        ]
      }),
    ) as Record<SupportedSymbol, AssetTimeframes>
  }, [data])

  const hasAny = SUPPORTED_SYMBOLS.some((symbol) => assetData[symbol]['15m'] || assetData[symbol]['4H'])
  const activeAsset = ASSET_TABS.find((tab) => tab.symbol === activeTab)

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(39,39,42,0.72),rgba(24,24,27,0.92))] p-5 shadow-[var(--shadow-lg)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-zinc-500">Market Compass</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
                Intraday futures direction, structured like a live trading desk.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                ICT structure, intermarket context, and short-term trade scenarios in one focused dashboard.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[540px]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Refresh cadence</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">{liveMode ? '1 minute' : '3 minutes'}</p>
                <p className="mt-1 text-xs text-zinc-500">{liveMode ? 'Live monitoring enabled' : 'Eco mode to reduce fetch load'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Coverage</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">{ASSET_TABS.length} assets</p>
                <p className="mt-1 text-xs text-zinc-500">15m execution with 4H structure context</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Next sync</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">{loading || !nextFetchAt ? 'Waiting' : `${countdown}s`}</p>
                <p className="mt-1 text-xs text-zinc-500">{refreshing ? 'Fetching new data now' : 'Automatic countdown in progress'}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-white/8 pt-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">Murphy intermarket context</span>
              <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1">Weighted rule-based bias scoring</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  void refresh()
                }}
                disabled={refreshing}
                title="Refresh market data now"
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${refreshing ? 'cursor-not-allowed border-white/8 bg-white/[0.03] text-zinc-600' : 'border-white/10 bg-white/[0.05] text-zinc-200 hover:bg-white/[0.08]'}`}
              >
                <span className={refreshing ? 'inline-block animate-spin' : ''}>↻</span>
                Refresh
              </button>
              <button
                onClick={() => setLiveMode((value) => !value)}
                title={liveMode ? 'Live ON - switch to 3 minute eco mode' : 'Eco ON - switch to 1 minute live mode'}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${liveMode ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/[0.05] text-zinc-300 hover:bg-white/[0.08]'}`}
              >
                <span className={`h-2 w-2 rounded-full ${liveMode ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                {liveMode ? 'Live · 1m' : 'Eco · 3m'}
              </button>
            </div>
          </div>
        </header>

        <section className="mt-4 rounded-[28px] border border-white/10 bg-[var(--panel)] p-3 shadow-[var(--shadow-lg)] backdrop-blur sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">Tracked markets</p>
              <p className="mt-1 text-sm text-zinc-400">Switch symbols without leaving the current dashboard context.</p>
            </div>
            {activeAsset && (
              <div className="hidden rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-xs text-zinc-400 sm:block">
                Active: <span className="text-zinc-100">{activeAsset.shortLabel}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {ASSET_TABS.map(({ symbol, label, shortLabel, tag }) => {
              const isActive = activeTab === symbol
              const timeframes = assetData[symbol]
              const bias = timeframes?.['4H']?.ictAnalysis.structureBias ?? timeframes?.['15m']?.ictAnalysis.structureBias
              const hasData = !loading && (!!timeframes?.['15m'] || !!timeframes?.['4H'])

              return (
                <button
                  key={symbol}
                  onClick={() => setActiveTab(symbol)}
                  className={`flex min-w-[164px] flex-col items-start gap-3 rounded-2xl border px-4 py-3 text-left transition sm:min-w-[188px] ${getAssetCardClass(isActive, hasData)}`}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${hasData ? getBiasDot(bias) : 'bg-zinc-700'}`} />
                      <span className="text-sm font-semibold tracking-tight text-current">{shortLabel}</span>
                    </div>
                    <span className="rounded-full border border-white/8 bg-black/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                      {tag}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm leading-5 text-zinc-200">{label}</p>
                    <p className={`mt-1 text-xs ${getBiasColor(bias)}`}>{hasData ? getBiasText(bias) : 'Awaiting feed'}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <main className="mt-4 flex-1">
          {loading && (
            <div className="rounded-[28px] border border-white/10 bg-[var(--panel)] px-6 py-14 text-center shadow-[var(--shadow-lg)] backdrop-blur">
              <p className="text-sm font-medium text-zinc-100">Fetching market data</p>
              <p className="mt-2 text-sm text-zinc-500">Building the latest 15m execution view and 4H structure context.</p>
            </div>
          )}

          {!loading && hasAny && activeAsset && (
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
            <div className="rounded-[28px] border border-red-500/20 bg-red-500/8 px-6 py-14 text-center shadow-[var(--shadow-lg)] backdrop-blur">
              <p className="text-sm font-semibold text-red-200">Failed to load market data</p>
              <p className="mt-2 text-sm text-red-200/80">Confirm the API server is running on port 3001, then try a manual refresh.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
