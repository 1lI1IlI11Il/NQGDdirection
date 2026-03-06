import { describe, expect, it } from 'vitest'

import {
  computePremiumDiscountZone,
  detectStructureShifts,
  type OHLCVBar,
  type SwingPoint
} from '../lib/ictAnalysis'

function createMockBars(closes: number[], startTime: number = 1_700_000_000): OHLCVBar[] {
  return closes.map((close, index) => ({
    time: startTime + (index * 60),
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1_000 + index
  }))
}

function createSwingPoint(
  type: SwingPoint['type'],
  price: number,
  time: number,
  label: SwingPoint['label']
): SwingPoint {
  return {
    type,
    price,
    time,
    label
  }
}

describe('ictAnalysis', () => {
  it('BOS detection: bullish swing progression includes a BOS event', () => {
    const swingPoints = [
      createSwingPoint('high', 100, 1, 'HH'),
      createSwingPoint('low', 90, 2, 'HL'),
      createSwingPoint('high', 110, 3, 'HH'),
      createSwingPoint('low', 95, 4, 'HL'),
      createSwingPoint('high', 115, 5, 'HH')
    ]

    const events = detectStructureShifts(swingPoints)

    expect(events.some((event) => event.type === 'BOS')).toBe(true)
  })

  it('CHoCH detection: HH to LH transition includes a CHoCH event', () => {
    const swingPoints = [
      createSwingPoint('high', 100, 1, 'HH'),
      createSwingPoint('low', 90, 2, 'HL'),
      createSwingPoint('high', 110, 3, 'HH'),
      createSwingPoint('low', 95, 4, 'HL'),
      createSwingPoint('high', 105, 5, 'LH'),
      createSwingPoint('low', 85, 6, 'LL')
    ]

    const events = detectStructureShifts(swingPoints)

    expect(events.some((event) => event.type === 'CHoCH')).toBe(true)
  })

  it('premium zone: current price in the upper quartile is PREMIUM', () => {
    const bars = createMockBars([
      100, 102, 104, 106, 108,
      110, 112, 114, 116, 118,
      120, 122, 124, 126, 128,
      130, 132, 134, 136, 138
    ])

    const zone = computePremiumDiscountZone(bars, 138)

    expect(zone).not.toBeNull()
    expect(zone?.currentZone).toBe('PREMIUM')
  })

  it('discount zone: current price in the lower quartile is DISCOUNT', () => {
    const bars = createMockBars([
      100, 102, 104, 106, 108,
      110, 112, 114, 116, 118,
      120, 122, 124, 126, 128,
      130, 132, 134, 136, 138
    ])

    const zone = computePremiumDiscountZone(bars, 102)

    expect(zone).not.toBeNull()
    expect(zone?.currentZone).toBe('DISCOUNT')
  })
})
