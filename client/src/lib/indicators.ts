export interface OHLCVBar {
  time: number; // Unix timestamp seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface VWAPResult {
  time: number;
  value: number;
  upperBand1: number;
  lowerBand1: number;
  upperBand2: number;
  lowerBand2: number;
}

export interface RSIResult {
  time: number;
  value: number;
}

export interface MACDResult {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerResult {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface EMAResult {
  time: number;
  ema20: number | undefined;
  ema50: number | undefined;
  ema200: number | undefined;
}

export interface ATRResult {
  time: number;
  value: number;
}

export interface EMAAlignment {
  bullish: boolean;
  bearish: boolean;
  mixed: boolean;
  ema20: number | undefined;
  ema50: number | undefined;
  ema200: number | undefined;
}

export interface IndicatorResults {
  vwap: VWAPResult[];
  rsi: RSIResult[];
  macd: MACDResult[];
  bollinger: BollingerResult[];
  ema: EMAResult[];
  atr: ATRResult[];
}

function utcDayKey(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculateEMA(values: number[], period: number): Array<number | undefined> {
  const result: Array<number | undefined> = new Array(values.length).fill(undefined);
  if (period <= 0 || values.length < period) {
    return result;
  }

  const multiplier = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i += 1) {
    sum += values[i];
  }

  let ema = sum / period;
  result[period - 1] = ema;

  for (let i = period; i < values.length; i += 1) {
    ema = (values[i] - ema) * multiplier + ema;
    result[i] = ema;
  }

  return result;
}

export function calculateEMAValues(bars: OHLCVBar[]): EMAResult[] {
  if (bars.length === 0) {
    return [];
  }

  const closes = bars.map((bar) => bar.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);

  return bars.map((bar, index) => ({
    time: bar.time,
    ema20: ema20[index],
    ema50: ema50[index],
    ema200: ema200[index],
  }));
}

export function calculateATR(bars: OHLCVBar[], period: number = 14): ATRResult[] {
  if (period <= 0 || bars.length < period) {
    return [];
  }

  const results: ATRResult[] = [];
  let trueRangeSum = 0;
  let atr = 0;

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i];
    const trueRange =
      i === 0
        ? bar.high - bar.low
        : Math.max(
            bar.high - bar.low,
            Math.abs(bar.high - bars[i - 1].close),
            Math.abs(bar.low - bars[i - 1].close),
          );

    if (i < period) {
      trueRangeSum += trueRange;
      if (i < period - 1) {
        continue;
      }

      atr = trueRangeSum / period;
      results.push({ time: bar.time, value: atr });
      continue;
    }

    atr = ((atr * (period - 1)) + trueRange) / period;
    results.push({ time: bar.time, value: atr });
  }

  return results;
}

export function getEMAAlignment(bars: OHLCVBar[]): EMAAlignment {
  const lastEMA = calculateEMAValues(bars)[bars.length - 1];
  const ema20 = lastEMA?.ema20;
  const ema50 = lastEMA?.ema50;
  const ema200 = lastEMA?.ema200;

  const bullish =
    ema20 !== undefined &&
    ema50 !== undefined &&
    ema200 !== undefined &&
    ema20 > ema50 &&
    ema50 > ema200;
  const bearish =
    ema20 !== undefined &&
    ema50 !== undefined &&
    ema200 !== undefined &&
    ema20 < ema50 &&
    ema50 < ema200;

  return {
    bullish,
    bearish,
    mixed: !bullish && !bearish,
    ema20,
    ema50,
    ema200,
  };
}

export function calculateVWAP(bars: OHLCVBar[]): VWAPResult[] {
  const results: VWAPResult[] = [];

  let currentDay: string | null = null;
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  let deviationCount = 0;
  let deviationMean = 0;
  let deviationM2 = 0;

  for (const bar of bars) {
    const day = utcDayKey(bar.time);
    if (day !== currentDay) {
      currentDay = day;
      cumulativeTPV = 0;
      cumulativeVolume = 0;
      deviationCount = 0;
      deviationMean = 0;
      deviationM2 = 0;
    }

    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativeTPV += typicalPrice * bar.volume;
    cumulativeVolume += bar.volume;

    const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice;
    const deviation = typicalPrice - vwap;

    deviationCount += 1;
    const delta = deviation - deviationMean;
    deviationMean += delta / deviationCount;
    deviationM2 += delta * (deviation - deviationMean);

    const variance = deviationCount > 0 ? deviationM2 / deviationCount : 0;
    const stdDev = Math.sqrt(Math.max(variance, 0));

    results.push({
      time: bar.time,
      value: vwap,
      upperBand1: vwap + stdDev,
      lowerBand1: vwap - stdDev,
      upperBand2: vwap + stdDev * 2,
      lowerBand2: vwap - stdDev * 2,
    });
  }

  return results;
}

export function calculateRSI(bars: OHLCVBar[], period: number = 14): RSIResult[] {
  if (period <= 0 || bars.length <= period) {
    return [];
  }

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i += 1) {
    const change = bars[i].close - bars[i - 1].close;
    if (change > 0) {
      gainSum += change;
    } else {
      lossSum += -change;
    }
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const results: RSIResult[] = [];
  {
    const rs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    results.push({ time: bars[period].time, value: rsi });
  }

  for (let i = period + 1; i < bars.length; i += 1) {
    const change = bars[i].close - bars[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;

    const rs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    results.push({ time: bars[i].time, value: rsi });
  }

  return results;
}

export function calculateMACD(
  bars: OHLCVBar[],
  fast = 12,
  slow = 26,
  signal = 9,
): MACDResult[] {
  if (fast <= 0 || slow <= 0 || signal <= 0 || bars.length === 0) {
    return [];
  }

  const closes = bars.map((bar) => bar.close);
  const fastEMA = calculateEMA(closes, fast);
  const slowEMA = calculateEMA(closes, slow);

  const macdSeries: Array<number | undefined> = closes.map((_, index) => {
    const fastValue = fastEMA[index];
    const slowValue = slowEMA[index];
    if (fastValue === undefined || slowValue === undefined) {
      return undefined;
    }

    return fastValue - slowValue;
  });

  const macdValues = macdSeries.filter((value): value is number => value !== undefined);
  const signalOnMacd = calculateEMA(macdValues, signal);

  const results: MACDResult[] = [];
  let macdIndex = 0;

  for (let i = 0; i < bars.length; i += 1) {
    const macdValue = macdSeries[i];
    if (macdValue === undefined) {
      continue;
    }

    const signalValue = signalOnMacd[macdIndex];
    macdIndex += 1;

    if (signalValue === undefined) {
      continue;
    }

    results.push({
      time: bars[i].time,
      macd: macdValue,
      signal: signalValue,
      histogram: macdValue - signalValue,
    });
  }

  return results;
}

export function calculateBollinger(
  bars: OHLCVBar[],
  period: number = 20,
  stdMult: number = 2,
): BollingerResult[] {
  if (period <= 0 || bars.length < period) {
    return [];
  }

  const results: BollingerResult[] = [];
  const closes = bars.map((bar) => bar.close);

  let sum = 0;
  let sumSquares = 0;

  for (let i = 0; i < closes.length; i += 1) {
    const value = closes[i];
    sum += value;
    sumSquares += value * value;

    if (i >= period) {
      const removed = closes[i - period];
      sum -= removed;
      sumSquares -= removed * removed;
    }

    if (i < period - 1) {
      continue;
    }

    const middle = sum / period;
    const variance = Math.max(sumSquares / period - middle * middle, 0);
    const stdDev = Math.sqrt(variance);

    results.push({
      time: bars[i].time,
      upper: middle + stdMult * stdDev,
      middle,
      lower: middle - stdMult * stdDev,
    });
  }

  return results;
}

export function calculateAll(bars: OHLCVBar[]): IndicatorResults {
  return {
    vwap: calculateVWAP(bars),
    rsi: calculateRSI(bars),
    macd: calculateMACD(bars),
    bollinger: calculateBollinger(bars),
    ema: calculateEMAValues(bars),
    atr: calculateATR(bars),
  };
}
