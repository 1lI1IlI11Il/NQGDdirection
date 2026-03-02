import { useState, useEffect, useCallback, useRef } from 'react'
import type { OHLCVBar } from '../lib/indicators'

export interface SymbolData {
  bars: OHLCVBar[]
  lastUpdated: number
  error?: string
}

interface MarketDataState {
  '15m': {
    'NQ=F': SymbolData | null
    'GC=F': SymbolData | null
  }
  '4H': {
    'NQ=F': SymbolData | null
    'GC=F': SymbolData | null
  }
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

const REFRESH_INTERVAL_MS = 60_000

const EMPTY_STATE: MarketDataState = {
  '15m': {
    'NQ=F': null,
    'GC=F': null,
  },
  '4H': {
    'NQ=F': null,
    'GC=F': null,
  },
}

function to4HData(symbolData: SymbolData | undefined): SymbolData | null {
  if (!symbolData) return null
  return {
    ...symbolData,
    bars: aggregate1hTo4H(symbolData.bars),
  }
}

export function useMarketData() {
  const [data, setData] = useState<MarketDataState>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const [res15m, res1h] = await Promise.all([
        fetch('/api/market/batch?symbols=NQ%3DF%2CGC%3DF&interval=15m&range=5d'),
        fetch('/api/market/batch?symbols=NQ%3DF%2CGC%3DF&interval=1h&range=60d'),
      ])

      if (!res15m.ok) throw new Error(`15m HTTP ${res15m.status}`)
      if (!res1h.ok) throw new Error(`1h HTTP ${res1h.status}`)

      const [json15m, json1h] = await Promise.all([
        res15m.json() as Promise<Record<string, SymbolData>>,
        res1h.json() as Promise<Record<string, SymbolData>>,
      ])

      setData({
        '15m': {
          'NQ=F': json15m['NQ=F'] ?? null,
          'GC=F': json15m['GC=F'] ?? null,
        },
        '4H': {
          'NQ=F': to4HData(json1h['NQ=F']),
          'GC=F': to4HData(json1h['GC=F']),
        },
      })

      setLastFetch(new Date())
    } catch (err) {
      console.error('Failed to fetch market data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const refresh = useCallback(() => fetchData(true), [fetchData])

  useEffect(() => {
    void fetchData()
    intervalRef.current = setInterval(() => {
      void fetchData()
    }, REFRESH_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData])

  return {
    data,
    loading,
    refreshing,
    lastFetch,
    refresh,
  }
}
