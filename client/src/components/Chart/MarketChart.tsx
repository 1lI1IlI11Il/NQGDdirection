import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type CandlestickData,
  type Time,
} from "lightweight-charts";
import type { OHLCVBar, IndicatorResults } from "../../lib/indicators";
import type { ICTAnalysis } from "../../lib/ictAnalysis";

interface MarketChartProps {
  symbol: string;
  bars: OHLCVBar[];
  indicators: IndicatorResults;
  ictAnalysis?: ICTAnalysis;
  timeframe?: string;
  height?: number;
}

export function MarketChart({
  symbol,
  bars,
  indicators,
  ictAnalysis,
  timeframe = "15m",
  height = 400,
}: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rsiContainerRef = useRef<HTMLDivElement | null>(null);
  const macdContainerRef = useRef<HTMLDivElement | null>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);

  const candleSeriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const vwapUpper1Ref = useRef<ISeriesApi<"Line", Time> | null>(null);
  const vwapLower1Ref = useRef<ISeriesApi<"Line", Time> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const macdLineSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const signalSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const histSeriesRef = useRef<ISeriesApi<"Histogram", Time> | null>(null);
  const ictLinesRef = useRef<IPriceLine[]>([]);

  useEffect(() => {
    if (!containerRef.current || !rsiContainerRef.current || !macdContainerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#18181b" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#27272a" },
        horzLines: { color: "#27272a" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#3f3f46" },
      timeScale: { borderColor: "#3f3f46", timeVisible: true },
      width: containerRef.current.clientWidth,
      height,
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeriesRef.current = candleSeries;

    const vwapSeries = chart.addSeries(LineSeries, {
      color: "#f97316",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: "VWAP",
    });
    vwapSeriesRef.current = vwapSeries;

    const vwapUpper1 = chart.addSeries(LineSeries, {
      color: "#fb923c",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      title: "VWAP+1σ",
    });
    vwapUpper1Ref.current = vwapUpper1;

    const vwapLower1 = chart.addSeries(LineSeries, {
      color: "#fb923c",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      title: "VWAP-1σ",
    });
    vwapLower1Ref.current = vwapLower1;

    const bbUpper = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: "BB Upper",
    });
    bbUpperRef.current = bbUpper;

    const bbMiddle = chart.addSeries(LineSeries, {
      color: "#6366f1",
      lineWidth: 1,
      title: "BB Mid",
    });
    bbMiddleRef.current = bbMiddle;

    const bbLower = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: "BB Lower",
    });
    bbLowerRef.current = bbLower;

    const rsiChart = createChart(rsiContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#18181b" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#27272a" },
        horzLines: { color: "#27272a" },
      },
      width: containerRef.current.clientWidth,
      height: 120,
      rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { visible: false },
    });
    rsiChartRef.current = rsiChart;

    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 2,
      title: "RSI",
    });
    rsiSeriesRef.current = rsiSeries;

    rsiSeries.createPriceLine({
      price: 70,
      color: "#6b7280",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "70",
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: "#6b7280",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "30",
    });

    const macdChart = createChart(macdContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#18181b" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#27272a" },
        horzLines: { color: "#27272a" },
      },
      width: containerRef.current.clientWidth,
      height: 100,
      timeScale: { visible: true, timeVisible: true },
    });
    macdChartRef.current = macdChart;

    const macdLineSeries = macdChart.addSeries(LineSeries, {
      color: "#06b6d4",
      lineWidth: 2,
      title: "MACD",
    });
    macdLineSeriesRef.current = macdLineSeries;

    const signalSeries = macdChart.addSeries(LineSeries, {
      color: "#eab308",
      lineWidth: 1,
      title: "Signal",
    });
    signalSeriesRef.current = signalSeries;

    const histSeries = macdChart.addSeries(HistogramSeries, {
      color: "#22c55e",
      title: "Hist",
      priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
    });
    histSeriesRef.current = histSeries;

    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) {
        rsiChart.timeScale().setVisibleLogicalRange(range);
        macdChart.timeScale().setVisibleLogicalRange(range);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      const w = containerRef.current?.clientWidth ?? 0;
      chart.applyOptions({ width: w });
      rsiChart.applyOptions({ width: w });
      macdChart.applyOptions({ width: w });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();

      chart.remove();
      rsiChart.remove();
      macdChart.remove();

      chartRef.current = null;
      rsiChartRef.current = null;
      macdChartRef.current = null;
      ictLinesRef.current = [];

      candleSeriesRef.current = null;
      vwapSeriesRef.current = null;
      vwapUpper1Ref.current = null;
      vwapLower1Ref.current = null;
      bbUpperRef.current = null;
      bbMiddleRef.current = null;
      bbLowerRef.current = null;
      rsiSeriesRef.current = null;
      macdLineSeriesRef.current = null;
      signalSeriesRef.current = null;
      histSeriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    const candleData: CandlestickData<Time>[] = bars.map((b) => ({
      time: b.time as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));

    candleSeriesRef.current?.setData(candleData);

    vwapSeriesRef.current?.setData(
      indicators.vwap.map((v) => ({ time: v.time as Time, value: v.value })),
    );
    vwapUpper1Ref.current?.setData(
      indicators.vwap.map((v) => ({ time: v.time as Time, value: v.upperBand1 })),
    );
    vwapLower1Ref.current?.setData(
      indicators.vwap.map((v) => ({ time: v.time as Time, value: v.lowerBand1 })),
    );

    bbUpperRef.current?.setData(
      indicators.bollinger.map((v) => ({ time: v.time as Time, value: v.upper })),
    );
    bbMiddleRef.current?.setData(
      indicators.bollinger.map((v) => ({ time: v.time as Time, value: v.middle })),
    );
    bbLowerRef.current?.setData(
      indicators.bollinger.map((v) => ({ time: v.time as Time, value: v.lower })),
    );

    rsiSeriesRef.current?.setData(
      indicators.rsi.map((v) => ({ time: v.time as Time, value: v.value })),
    );

    macdLineSeriesRef.current?.setData(
      indicators.macd.map((v) => ({ time: v.time as Time, value: v.macd })),
    );
    signalSeriesRef.current?.setData(
      indicators.macd.map((v) => ({ time: v.time as Time, value: v.signal })),
    );
    histSeriesRef.current?.setData(
      indicators.macd.map((v) => ({
        time: v.time as Time,
        value: v.histogram,
        color: v.histogram >= 0 ? "#22c55e" : "#ef4444",
      })),
    );
  }, [bars, indicators]);

  useEffect(() => {
    if (!ictAnalysis || !candleSeriesRef.current) {
      return;
    }

    const lines = ictLinesRef.current;
    lines.forEach((line) => candleSeriesRef.current?.removePriceLine(line));
    ictLinesRef.current = [];

    const add = (
      price: number,
      color: string,
      lineWidth: 1 | 2 | 3 | 4,
      lineStyle: LineStyle,
      title: string,
    ) => {
      const line = candleSeriesRef.current!.createPriceLine({
        price,
        color,
        lineWidth,
        lineStyle,
        axisLabelVisible: !!title,
        title,
      });
      ictLinesRef.current.push(line);
    };

    const nearestBullOB = ictAnalysis.nearestBullOB;
    if (nearestBullOB) {
      add(nearestBullOB.high, "#22c55e", 1, LineStyle.Solid, "Bull OB");
      add(nearestBullOB.low, "#22c55e", 1, LineStyle.Dashed, "");
    }

    const nearestBearOB = ictAnalysis.nearestBearOB;
    if (nearestBearOB) {
      add(nearestBearOB.low, "#ef4444", 1, LineStyle.Solid, "Bear OB");
      add(nearestBearOB.high, "#ef4444", 1, LineStyle.Dashed, "");
    }

    const unfilledFVGs = ictAnalysis.fvgs.filter((fvg) => !fvg.filled).slice(0, 4);
    unfilledFVGs.forEach((fvg) => {
      const bullish = fvg.type === "bullish";
      const color = bullish ? "#86efac" : "#fca5a5";
      const label = bullish ? "FVG+" : "FVG-";

      add(fvg.top, color, 1, LineStyle.Dotted, label);
      add(fvg.bottom, color, 1, LineStyle.Dotted, "");
    });

    const liquidityLevels = ictAnalysis.liquidityLevels.slice(0, 4);
    liquidityLevels.forEach((level) => {
      const color = level.type === "BSL" ? "#22d3ee" : "#facc15";
      add(level.price, color, 1, LineStyle.Dashed, level.label ?? "");
    });

    return () => {
      const series = candleSeriesRef.current;
      ictLinesRef.current.forEach((line) => series?.removePriceLine(line));
      ictLinesRef.current = [];
    };
  }, [ictAnalysis]);

  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-[28px] bg-transparent">
      <div className="border-b border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Chart workspace</p>
            <p className="mt-1 text-sm font-medium text-zinc-100">{symbol} — {timeframe ?? "15m"}</p>
          </div>
          <p className="text-xs text-zinc-500">Candles, VWAP, Bollinger, RSI, and MACD in one view.</p>
        </div>
      </div>
      <div ref={containerRef} />
      <div className="border-t border-white/8 bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        RSI(14)
      </div>
      <div ref={rsiContainerRef} />
      <div className="border-t border-white/8 bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        MACD(12,26,9)
      </div>
      <div ref={macdContainerRef} />
    </div>
  );
}
