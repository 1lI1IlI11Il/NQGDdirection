import { describe, expect, it } from 'vitest'

import { analyzeIntermarket } from '../lib/intermarket'
import type { OHLCVBar } from '../lib/indicators'

function createMockBars(closes: number[], startTime: number = 1_700_000_000): OHLCVBar[] {
  return closes.map((close, index) => ({
    time: startTime + (index * 86_400),
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1_000 + index
  }))
}

function createAsset(closes: number[], structureBias: 'BULLISH' | 'BEARISH' | 'RANGING') {
  return {
    bars: createMockBars(closes),
    structureBias
  }
}

describe('intermarket', () => {
  it('NQ-SP500 동조: both bullish assets are marked CONVERGING', () => {
    const result = analyzeIntermarket({
      'NQ=F': createAsset([100, 104], 'BULLISH'),
      'ES=F': createAsset([100, 103], 'BULLISH'),
      'GC=F': createAsset([100, 101], 'RANGING'),
      'SI=F': createAsset([100, 101], 'RANGING'),
      'CL=F': createAsset([100, 100], 'RANGING')
    })

    expect(result.nqSpCorrelation).toBe('CONVERGING')
  })

  it('NQ-SP500 비동조: bullish NQ and bearish ES are marked DIVERGING', () => {
    const result = analyzeIntermarket({
      'NQ=F': createAsset([100, 104], 'BULLISH'),
      'ES=F': createAsset([100, 96], 'BEARISH'),
      'GC=F': createAsset([100, 101], 'RANGING'),
      'SI=F': createAsset([100, 101], 'RANGING'),
      'CL=F': createAsset([100, 100], 'RANGING')
    })

    expect(result.nqSpCorrelation).toBe('DIVERGING')
  })

  it('missing data: omitted ES asset is reported in missingAssets', () => {
    const result = analyzeIntermarket({
      'NQ=F': createAsset([100, 104], 'BULLISH'),
      'GC=F': createAsset([100, 101], 'RANGING'),
      'SI=F': createAsset([100, 102], 'RANGING'),
      'CL=F': createAsset([100, 101], 'BULLISH')
    })

    expect(result.missingAssets).toContain('ES=F')
  })

  it('intermarket conclusion: majority bullish signals confirm BULLISH bias', () => {
    const result = analyzeIntermarket({
      'NQ=F': createAsset([100, 104], 'BULLISH'),
      'ES=F': createAsset([100, 103], 'BULLISH'),
      'GC=F': createAsset([100, 101], 'RANGING'),
      'SI=F': createAsset([100, 104], 'RANGING'),
      'CL=F': createAsset([100, 106], 'BULLISH')
    })

    expect(result.confirmsBias).toBe('BULLISH')
  })
})
