import { useState, useEffect, useCallback, useRef } from 'react'
import type { OHLCVBar } from '../lib/indicators'

export const SUPPORTED_SYMBOLS = ['NQ=F', 'GC=F', 'SI=F', 'CL=F', 'ES=F'] as const
export type SupportedSymbol = typeof SUPPORTED_SYMBOLS[number]

export interface SymbolData {
  bars: OHLCVBar[]
  lastUpdated: number
  error?: string
}

type SymbolDataMap = Partial<Record<SupportedSymbol, SymbolData | null>>
type MarketDataResponse = Partial<Record<SupportedSymbol, SymbolData>>

interface MarketDataState {
  '15m': SymbolDataMap
  '4H': SymbolDataMap
}

function aggregate1hTo4H(bars: OHLCVBar[]): OHLCVBar[] {
  const result: OHLCVBar[] = []
  for (let i = 0; i + 3 < bars.length; i += 4) {
    const group = bars.slice(i, i + 4)
    result.push({
      time: group[0].time,
      open: group[0].open,
      high: Math.max(...group.map(b => b.high)),
      low: Math.min(...group.map(b => b.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, b) => sum + b.volume, 0),
    })
  }
  return result
}

export const REFRESH_INTERVAL_FAST_MS = 60_000   // Live ON  — 1분
export const REFRESH_INTERVAL_SLOW_MS = 180_000  // Live OFF — 3분
const FETCH_SYMBOLS_PARAM = 'NQ%3DF%2CGC%3DF%2CSI%3DF%2CCL%3DF%2CES%3DF'

function mapSupportedSymbols<T>(mapper: (symbol: SupportedSymbol) => T): Record<SupportedSymbol, T> {
  return Object.fromEntries(
    SUPPORTED_SYMBOLS.map(symbol => [symbol, mapper(symbol)]),
  ) as Record<SupportedSymbol, T>
}

const EMPTY_STATE: MarketDataState = {
  '15m': mapSupportedSymbols(() => null),
  '4H': mapSupportedSymbols(() => null),
}

function to4HData(symbolData: SymbolData | undefined): SymbolData | null {
  if (!symbolData) return null
  return {
    ...symbolData,
    bars: aggregate1hTo4H(symbolData.bars),
  }
}

export function useMarketData(intervalMs: number = REFRESH_INTERVAL_FAST_MS) {
  const [data, setData] = useState<MarketDataState>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const [nextFetchAt, setNextFetchAt] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const [res15m, res1h] = await Promise.all([
        fetch(`/api/market/batch?symbols=${FETCH_SYMBOLS_PARAM}&interval=15m&range=5d`),
        fetch(`/api/market/batch?symbols=${FETCH_SYMBOLS_PARAM}&interval=1h&range=60d`),
      ])

      if (!res15m.ok) throw new Error(`15m HTTP ${res15m.status}`)
      if (!res1h.ok) throw new Error(`1h HTTP ${res1h.status}`)

      const [json15m, json1h] = await Promise.all([
        res15m.json() as Promise<MarketDataResponse>,
        res1h.json() as Promise<MarketDataResponse>,
      ])

      setData({
        '15m': mapSupportedSymbols(symbol => json15m[symbol] ?? null),
        '4H': mapSupportedSymbols(symbol => to4HData(json1h[symbol])),
      })

      const now = new Date()
      setLastFetch(now)
      setNextFetchAt(new Date(now.getTime() + intervalMs))
    } catch (err) {
      console.error('Failed to fetch market data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [intervalMs])

  const refresh = useCallback(() => fetchData(true), [fetchData])

  // intervalMs가 바뀌면 타이머 재설정
  useEffect(() => {
    void fetchData()
    intervalRef.current = setInterval(() => {
      void fetchData()
    }, intervalMs)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData, intervalMs])

  return {
    data,
    loading,
    refreshing,
    lastFetch,
    nextFetchAt,
    refresh,
  }
}
