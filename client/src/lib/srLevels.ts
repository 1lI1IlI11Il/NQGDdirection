export interface OHLCVBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface SRLevel {
  price: number
  type: 'support' | 'resistance'
  strength: number
  label: string
}

export interface PivotPoints {
  pp: number
  r1: number
  r2: number
  r3: number
  s1: number
  s2: number
  s3: number
}

export function calculatePivotPoints(
  prevDayHigh: number,
  prevDayLow: number,
  prevDayClose: number
): PivotPoints {
  const pp = (prevDayHigh + prevDayLow + prevDayClose) / 3
  const r1 = 2 * pp - prevDayLow
  const s1 = 2 * pp - prevDayHigh
  const r2 = pp + (prevDayHigh - prevDayLow)
  const s2 = pp - (prevDayHigh - prevDayLow)
  const r3 = prevDayHigh + 2 * (pp - prevDayLow)
  const s3 = prevDayLow - 2 * (prevDayHigh - pp)

  return { pp, r1, r2, r3, s1, s2, s3 }
}

function computeTouchStrength(bars: OHLCVBar[], levelPrice: number): number {
  const tolerance = Math.abs(levelPrice) * 0.0005
  const touches = bars.reduce((count, bar) => {
    const crossesLevel = bar.low <= levelPrice && bar.high >= levelPrice
    const nearExtremes =
      Math.abs(bar.high - levelPrice) <= tolerance ||
      Math.abs(bar.low - levelPrice) <= tolerance
    return crossesLevel || nearExtremes ? count + 1 : count
  }, 0)

  return Math.max(1, Math.min(3, touches))
}

function clusterLevels(levels: SRLevel[], threshold: number): SRLevel[] {
  if (levels.length === 0) {
    return []
  }

  const sorted = [...levels].sort((a, b) => a.price - b.price)
  const clustered: SRLevel[] = []
  let currentCluster: SRLevel[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]
    const candidate = sorted[i]

    if (Math.abs(candidate.price - previous.price) <= threshold) {
      currentCluster.push(candidate)
      continue
    }

    const averagePrice =
      currentCluster.reduce((sum, item) => sum + item.price, 0) / currentCluster.length

    clustered.push({
      price: averagePrice,
      type: currentCluster[0].type,
      strength: Math.max(...currentCluster.map((item) => item.strength)),
      label: ''
    })

    currentCluster = [candidate]
  }

  const averagePrice =
    currentCluster.reduce((sum, item) => sum + item.price, 0) / currentCluster.length

  clustered.push({
    price: averagePrice,
    type: currentCluster[0].type,
    strength: Math.max(...currentCluster.map((item) => item.strength)),
    label: ''
  })

  return clustered
}

export function detectSwingLevels(bars: OHLCVBar[], lookback = 5): SRLevel[] {
  if (bars.length === 0 || lookback < 1 || bars.length < lookback * 2 + 1) {
    return []
  }

  const highs = bars.map((bar) => bar.high)
  const lows = bars.map((bar) => bar.low)
  const priceRange = Math.max(...highs) - Math.min(...lows)
  const clusterThreshold = priceRange * 0.001

  const rawLevels: SRLevel[] = []

  for (let i = lookback; i < bars.length - lookback; i += 1) {
    const bar = bars[i]
    const leftHighs = highs.slice(i - lookback, i)
    const rightHighs = highs.slice(i + 1, i + lookback + 1)
    const leftLows = lows.slice(i - lookback, i)
    const rightLows = lows.slice(i + 1, i + lookback + 1)

    const maxLeftHigh = Math.max(...leftHighs)
    const maxRightHigh = Math.max(...rightHighs)
    const minLeftLow = Math.min(...leftLows)
    const minRightLow = Math.min(...rightLows)

    if (bar.high > maxLeftHigh && bar.high > maxRightHigh) {
      rawLevels.push({
        price: bar.high,
        type: 'resistance',
        strength: computeTouchStrength(bars, bar.high),
        label: ''
      })
    }

    if (bar.low < minLeftLow && bar.low < minRightLow) {
      rawLevels.push({
        price: bar.low,
        type: 'support',
        strength: computeTouchStrength(bars, bar.low),
        label: ''
      })
    }
  }

  const resistances = clusterLevels(
    rawLevels.filter((level) => level.type === 'resistance'),
    clusterThreshold
  )
  const supports = clusterLevels(
    rawLevels.filter((level) => level.type === 'support'),
    clusterThreshold
  )

  const currentPrice = bars[bars.length - 1].close

  const topResistances = resistances
    .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
    .slice(0, 4)
    .map((level, index) => ({ ...level, label: `R${index + 1}` }))

  const topSupports = supports
    .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
    .slice(0, 4)
    .map((level, index) => ({ ...level, label: `S${index + 1}` }))

  return [...topResistances, ...topSupports].slice(0, 8)
}

export function detectRoundNumbers(currentPrice: number, range = 5): SRLevel[] {
  if (currentPrice <= 0 || range < 0) {
    return []
  }

  let step = 1
  if (currentPrice > 10000) {
    step = 50
  } else if (currentPrice > 1000) {
    step = 10
  }

  const minPrice = currentPrice * (1 - range / 100)
  const maxPrice = currentPrice * (1 + range / 100)

  const start = Math.ceil(minPrice / step) * step
  const levels: SRLevel[] = []

  for (let price = start; price <= maxPrice; price += step) {
    if (price === currentPrice) {
      continue
    }

    const type: SRLevel['type'] = price > currentPrice ? 'resistance' : 'support'
    levels.push({
      price,
      type,
      strength: 1,
      label: type === 'resistance' ? 'Round R' : 'Round S'
    })
  }

  return levels
}

export function getSRLevels(bars: OHLCVBar[]): SRLevel[] {
  if (bars.length === 0) {
    return []
  }

  const currentPrice = bars[bars.length - 1].close
  const combined = [...detectSwingLevels(bars), ...detectRoundNumbers(currentPrice)]

  const prioritized = [...combined].sort((a, b) => b.strength - a.strength)
  const deduped: SRLevel[] = []

  for (const level of prioritized) {
    const duplicate = deduped.some(
      (existing) => Math.abs(existing.price - level.price) / Math.max(Math.abs(existing.price), 1e-12) <= 0.001
    )

    if (!duplicate) {
      deduped.push(level)
    }
  }

  const resistances = deduped
    .filter((level) => level.type === 'resistance')
    .sort((a, b) => b.price - a.price)
  const supports = deduped
    .filter((level) => level.type === 'support')
    .sort((a, b) => a.price - b.price)

  return [...resistances, ...supports].slice(0, 10)
}
