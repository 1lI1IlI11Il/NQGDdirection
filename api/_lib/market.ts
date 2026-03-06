import { Hono } from 'hono'

interface OHLCVBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface YahooChartResult {
  chart: {
    result: Array<{
      timestamp: number[]
      indicators: {
        quote: Array<{
          open: (number | null)[]
          high: (number | null)[]
          low: (number | null)[]
          close: (number | null)[]
          volume: (number | null)[]
        }>
      }
    }> | null
    error: { code: string; description: string } | null
  }
}

const marketRoutes = new Hono()

async function fetchSymbolBars(
  symbol: string,
  interval: string,
  range: string
): Promise<{ bars: OHLCVBar[]; lastUpdated: number } | { error: string; bars: [] }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      return { error: `Yahoo Finance returned ${res.status}`, bars: [] }
    }

    const json = (await res.json()) as YahooChartResult
    const result = json.chart?.result?.[0]

    if (!result) {
      const errMsg = json.chart?.error?.description ?? 'No data returned'
      return { error: errMsg, bars: [] }
    }

    const timestamps = result.timestamp ?? []
    const quote = result.indicators.quote[0]

    const bars: OHLCVBar[] = timestamps
      .map((ts, i) => {
        const open = quote.open[i]
        const high = quote.high[i]
        const low = quote.low[i]
        const close = quote.close[i]
        if (open == null || high == null || low == null || close == null) return null
        return {
          time: ts,
          open,
          high,
          low,
          close,
          volume: quote.volume[i] ?? 0,
        }
      })
      .filter((b): b is OHLCVBar => b !== null)
      .sort((a, b) => a.time - b.time)

    return { bars, lastUpdated: Date.now() }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Fetch failed'
    return { error: msg, bars: [] }
  }
}

marketRoutes.get('/batch', async (c) => {
  const symbolsParam = c.req.query('symbols') ?? 'NQ=F,GC=F'
  const interval = c.req.query('interval') ?? '15m'
  const range = c.req.query('range') ?? '5d'

  const symbols = symbolsParam.split(',').map((s) => s.trim()).filter(Boolean)

  const responses = await Promise.all(
    symbols.map(async (symbol) => {
      const data = await fetchSymbolBars(symbol, interval, range)
      return [symbol, data] as const
    })
  )

  return c.json(Object.fromEntries(responses), 200)
})

marketRoutes.get('/:symbol', async (c) => {
  const symbol = c.req.param('symbol')
  const interval = c.req.query('interval') ?? '15m'
  const range = c.req.query('range') ?? '5d'

  const data = await fetchSymbolBars(symbol, interval, range)

  if ('error' in data) {
    return c.json(data, 200)
  }

  return c.json({ symbol, bars: data.bars, lastUpdated: data.lastUpdated }, 200)
})

export { marketRoutes }
