export interface OHLCVBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type OBType = 'bullish' | 'bearish'

export interface OrderBlock {
  type: OBType
  high: number
  low: number
  time: number
  mitigated: boolean
  label: string
}

export interface FairValueGap {
  type: 'bullish' | 'bearish'
  top: number
  bottom: number
  time: number
  filled: boolean
}

export type SwingType = 'HH' | 'HL' | 'LH' | 'LL'

export interface SwingPoint {
  type: 'high' | 'low'
  price: number
  time: number
  label: SwingType
}

export type StructureBias = 'BULLISH' | 'BEARISH' | 'RANGING'

export interface LiquidityLevel {
  price: number
  type: 'BSL' | 'SSL'
  time: number
  label: string
}

export interface ICTAnalysis {
  structureBias: StructureBias
  swingPoints: SwingPoint[]
  orderBlocks: OrderBlock[]
  fvgs: FairValueGap[]
  liquidityLevels: LiquidityLevel[]
  nearestBullOB: OrderBlock | null
  nearestBearOB: OrderBlock | null
  currentPrice: number
}

interface IndexedSwingPoint {
  point: SwingPoint
  index: number
}

interface IndexedOrderBlock extends OrderBlock {
  index: number
}

interface IndexedFairValueGap extends FairValueGap {
  index: number
}

interface LiquidityGroup {
  points: SwingPoint[]
  avgPrice: number
  latestTime: number
}

function toRunLength(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  const normalized = Math.floor(value)
  return normalized > 0 ? normalized : fallback
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, current) => sum + current, 0) / values.length
}

function equalWithinThreshold(a: number, b: number, ratio: number): boolean {
  const denominator = Math.abs((a + b) / 2)
  if (denominator === 0) {
    return a === b
  }

  return Math.abs(a - b) / denominator <= ratio
}

function findMax(values: number[]): number {
  let max = Number.NEGATIVE_INFINITY
  for (const value of values) {
    if (value > max) {
      max = value
    }
  }
  return max
}

function findMin(values: number[]): number {
  let min = Number.POSITIVE_INFINITY
  for (const value of values) {
    if (value < min) {
      min = value
    }
  }
  return min
}

function formatPrice(price: number): string {
  if (!Number.isFinite(price)) {
    return '0'
  }

  return Number(price.toFixed(6)).toString()
}

export function detectSwingPoints(bars: OHLCVBar[], lookback: number = 3): SwingPoint[] {
  if (bars.length === 0) {
    return []
  }

  const windowSize = toRunLength(lookback, 3)
  if (bars.length < (windowSize * 2) + 1) {
    return []
  }

  const rawPoints: IndexedSwingPoint[] = []

  for (let i = windowSize; i <= bars.length - 1 - windowSize; i += 1) {
    const highs: number[] = []
    const lows: number[] = []

    for (let j = i - windowSize; j <= i + windowSize; j += 1) {
      highs.push(bars[j].high)
      lows.push(bars[j].low)
    }

    const bar = bars[i]
    const maxHigh = findMax(highs)
    const minLow = findMin(lows)

    if (bar.high === maxHigh) {
      rawPoints.push({
        point: {
          type: 'high',
          price: bar.high,
          time: bar.time,
          label: 'HH'
        },
        index: i
      })
    }

    if (bar.low === minLow) {
      rawPoints.push({
        point: {
          type: 'low',
          price: bar.low,
          time: bar.time,
          label: 'HL'
        },
        index: i
      })
    }
  }

  rawPoints.sort((a, b) => {
    if (a.point.time !== b.point.time) {
      return a.point.time - b.point.time
    }
    return a.index - b.index
  })

  let previousHigh: number | null = null
  let previousLow: number | null = null

  for (const item of rawPoints) {
    if (item.point.type === 'high') {
      if (previousHigh === null) {
        item.point.label = 'HH'
      } else {
        item.point.label = item.point.price > previousHigh ? 'HH' : 'LH'
      }
      previousHigh = item.point.price
      continue
    }

    if (previousLow === null) {
      item.point.label = 'HL'
    } else {
      item.point.label = item.point.price > previousLow ? 'HL' : 'LL'
    }
    previousLow = item.point.price
  }

  return rawPoints.slice(-10).map((item) => item.point)
}

export function detectMarketStructure(swingPoints: SwingPoint[]): StructureBias {
  if (swingPoints.length < 4) {
    return 'RANGING'
  }

  const recent = swingPoints.slice(-4)
  const highs = recent.filter((point) => point.type === 'high')
  const lows = recent.filter((point) => point.type === 'low')

  if (highs.length < 2 || lows.length < 2) {
    return 'RANGING'
  }

  const lastHigh = highs[highs.length - 1]
  const secondLastHigh = highs[highs.length - 2]
  const lastLow = lows[lows.length - 1]
  const secondLastLow = lows[lows.length - 2]

  if (lastLow.price > secondLastLow.price && lastHigh.price > secondLastHigh.price) {
    return 'BULLISH'
  }

  if (lastLow.price < secondLastLow.price && lastHigh.price < secondLastHigh.price) {
    return 'BEARISH'
  }

  return 'RANGING'
}

function dedupeOrderBlocks(blocks: IndexedOrderBlock[]): IndexedOrderBlock[] {
  const seen = new Set<string>()
  const result: IndexedOrderBlock[] = []

  for (const block of blocks) {
    const key = `${block.type}:${block.time}:${block.high}:${block.low}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(block)
  }

  return result
}

export function detectOrderBlocks(bars: OHLCVBar[], lookback: number = 3): OrderBlock[] {
  if (bars.length < 4) {
    return []
  }

  const minSequence = Math.max(3, toRunLength(lookback, 3))
  const blocks: IndexedOrderBlock[] = []

  let i = 1
  while (i < bars.length) {
    if (bars[i].close > bars[i - 1].close) {
      const start = i
      let end = i

      while (end + 1 < bars.length && bars[end + 1].close > bars[end].close) {
        end += 1
      }

      const runLength = end - start + 1
      if (runLength >= minSequence) {
        let obIndex = -1
        for (let j = start - 1; j >= 0; j -= 1) {
          if (bars[j].close < bars[j].open) {
            obIndex = j
            break
          }
        }

        if (obIndex >= 0) {
          const obBar = bars[obIndex]
          const mitigated = bars.slice(obIndex + 1).some((bar) => bar.close < obBar.low)
          blocks.push({
            type: 'bullish',
            high: obBar.high,
            low: obBar.low,
            time: obBar.time,
            mitigated,
            label: 'Bull OB',
            index: obIndex
          })
        }
      }

      i = end + 1
      continue
    }

    if (bars[i].close < bars[i - 1].close) {
      const start = i
      let end = i

      while (end + 1 < bars.length && bars[end + 1].close < bars[end].close) {
        end += 1
      }

      const runLength = end - start + 1
      if (runLength >= minSequence) {
        let obIndex = -1
        for (let j = start - 1; j >= 0; j -= 1) {
          if (bars[j].close > bars[j].open) {
            obIndex = j
            break
          }
        }

        if (obIndex >= 0) {
          const obBar = bars[obIndex]
          const mitigated = bars.slice(obIndex + 1).some((bar) => bar.close > obBar.high)
          blocks.push({
            type: 'bearish',
            high: obBar.high,
            low: obBar.low,
            time: obBar.time,
            mitigated,
            label: 'Bear OB',
            index: obIndex
          })
        }
      }

      i = end + 1
      continue
    }

    i += 1
  }

  const uniqueBlocks = dedupeOrderBlocks(blocks)
  const bullish = uniqueBlocks
    .filter((block) => block.type === 'bullish' && !block.mitigated)
    .sort((a, b) => b.time - a.time || b.index - a.index)
    .slice(0, 3)
  const bearish = uniqueBlocks
    .filter((block) => block.type === 'bearish' && !block.mitigated)
    .sort((a, b) => b.time - a.time || b.index - a.index)
    .slice(0, 3)

  return [...bullish, ...bearish]
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(({ index: _index, ...block }) => block)
}

export function detectFairValueGaps(bars: OHLCVBar[]): FairValueGap[] {
  if (bars.length < 3) {
    return []
  }

  const gaps: IndexedFairValueGap[] = []

  for (let i = 1; i <= bars.length - 2; i += 1) {
    const previous = bars[i - 1]
    const next = bars[i + 1]
    const middle = bars[i]

    if (previous.high < next.low) {
      const bottom = previous.high
      const top = next.low
      const filled = bars.slice(i + 2).some((bar) => bar.low <= bottom)

      gaps.push({
        type: 'bullish',
        top,
        bottom,
        time: middle.time,
        filled,
        index: i
      })
    }

    if (previous.low > next.high) {
      const top = previous.low
      const bottom = next.high
      const filled = bars.slice(i + 2).some((bar) => bar.high >= top)

      gaps.push({
        type: 'bearish',
        top,
        bottom,
        time: middle.time,
        filled,
        index: i
      })
    }
  }

  const bullish = gaps
    .filter((gap) => gap.type === 'bullish' && !gap.filled)
    .sort((a, b) => b.time - a.time || b.index - a.index)
    .slice(0, 4)
  const bearish = gaps
    .filter((gap) => gap.type === 'bearish' && !gap.filled)
    .sort((a, b) => b.time - a.time || b.index - a.index)
    .slice(0, 4)

  return [...bullish, ...bearish]
    .sort((a, b) => a.time - b.time || a.index - b.index)
    .map(({ index: _index, ...gap }) => gap)
}

function buildLiquidityGroups(points: SwingPoint[]): LiquidityGroup[] {
  if (points.length === 0) {
    return []
  }

  const sorted = points.slice().sort((a, b) => a.price - b.price)
  const groups: SwingPoint[][] = []

  for (const point of sorted) {
    const lastGroup = groups[groups.length - 1]
    if (!lastGroup) {
      groups.push([point])
      continue
    }

    const representative = average(lastGroup.map((item) => item.price))
    if (equalWithinThreshold(representative, point.price, 0.001)) {
      lastGroup.push(point)
    } else {
      groups.push([point])
    }
  }

  return groups.map((group) => ({
    points: group,
    avgPrice: average(group.map((item) => item.price)),
    latestTime: group.reduce((latest, item) => (item.time > latest ? item.time : latest), group[0].time)
  }))
}

export function detectLiquidityLevels(
  swingPoints: SwingPoint[],
  currentPrice: number
): LiquidityLevel[] {
  if (swingPoints.length === 0 || !Number.isFinite(currentPrice)) {
    return []
  }

  const swingHighsAbove = swingPoints.filter((point) => point.type === 'high' && point.price > currentPrice)
  const swingLowsBelow = swingPoints.filter((point) => point.type === 'low' && point.price < currentPrice)

  const bslLevels = buildLiquidityGroups(swingHighsAbove)
    .map((group) => ({
      price: group.avgPrice,
      type: 'BSL' as const,
      time: group.latestTime,
      label:
        group.points.length > 1
          ? `EQH ${formatPrice(group.avgPrice)}`
          : `BSL @ ${formatPrice(group.avgPrice)}`
    }))
    .sort((a, b) => (a.price - currentPrice) - (b.price - currentPrice))
    .slice(0, 3)

  const sslLevels = buildLiquidityGroups(swingLowsBelow)
    .map((group) => ({
      price: group.avgPrice,
      type: 'SSL' as const,
      time: group.latestTime,
      label:
        group.points.length > 1
          ? `EQL ${formatPrice(group.avgPrice)}`
          : `SSL @ ${formatPrice(group.avgPrice)}`
    }))
    .sort((a, b) => (currentPrice - a.price) - (currentPrice - b.price))
    .slice(0, 3)

  return [...bslLevels, ...sslLevels].sort((a, b) => {
    const distanceA = Math.abs(a.price - currentPrice)
    const distanceB = Math.abs(b.price - currentPrice)
    if (distanceA !== distanceB) {
      return distanceA - distanceB
    }
    return a.time - b.time
  })
}

export function getICTAnalysis(bars: OHLCVBar[]): ICTAnalysis {
  if (bars.length === 0) {
    return {
      structureBias: 'RANGING',
      swingPoints: [],
      orderBlocks: [],
      fvgs: [],
      liquidityLevels: [],
      nearestBullOB: null,
      nearestBearOB: null,
      currentPrice: 0
    }
  }

  const currentPrice = bars[bars.length - 1].close
  const allSwingPoints = detectSwingPoints(bars)
  const structureBias = detectMarketStructure(allSwingPoints)
  const orderBlocks = detectOrderBlocks(bars)
  const fvgs = detectFairValueGaps(bars)
  const liquidityLevels = detectLiquidityLevels(allSwingPoints, currentPrice).slice(0, 6)

  const nearestBullOB =
    orderBlocks
      .filter((block) => block.type === 'bullish' && !block.mitigated && block.high < currentPrice)
      .sort((a, b) => b.high - a.high)[0] ?? null

  const nearestBearOB =
    orderBlocks
      .filter((block) => block.type === 'bearish' && !block.mitigated && block.low > currentPrice)
      .sort((a, b) => a.low - b.low)[0] ?? null

  return {
    structureBias,
    swingPoints: allSwingPoints.slice(-8),
    orderBlocks,
    fvgs,
    liquidityLevels,
    nearestBullOB,
    nearestBearOB,
    currentPrice
  }
}
