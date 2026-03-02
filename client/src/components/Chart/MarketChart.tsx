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
        background: { type: ColorType.Solid, color: "#0f0f0f" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#374151" },
      timeScale: { borderColor: "#374151", timeVisible: true },
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
        background: { type: ColorType.Solid, color: "#0f0f0f" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
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
        background: { type: ColorType.Solid, color: "#0f0f0f" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
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

    const nearestBullOB = (ictAnalysis as any).nearestBullOB;
    if (nearestBullOB) {
      add(nearestBullOB.high, "#22c55e", 1, LineStyle.Solid, "Bull OB");
      add(nearestBullOB.low, "#22c55e", 1, LineStyle.Dashed, "");
    }

    const nearestBearOB = (ictAnalysis as any).nearestBearOB;
    if (nearestBearOB) {
      add(nearestBearOB.low, "#ef4444", 1, LineStyle.Solid, "Bear OB");
      add(nearestBearOB.high, "#ef4444", 1, LineStyle.Dashed, "");
    }

    const unfilledFVGs = ((ictAnalysis as any).unfilledFVGs ?? []).slice(0, 4);
    unfilledFVGs.forEach((fvg: any) => {
      const top = fvg.top ?? fvg.high;
      const bottom = fvg.bottom ?? fvg.low;
      const direction = fvg.direction ?? fvg.type;
      const bullish = direction === "bullish";
      const color = bullish ? "#86efac" : "#fca5a5";
      const label = bullish ? "FVG+" : "FVG-";

      if (typeof top === "number") {
        add(top, color, 1, LineStyle.Dotted, label);
      }
      if (typeof bottom === "number") {
        add(bottom, color, 1, LineStyle.Dotted, "");
      }
    });

    const liquidityLevels = ((ictAnalysis as any).liquidityLevels ?? []).slice(0, 4);
    liquidityLevels.forEach((level: any) => {
      const kind = level.kind ?? level.type;
      const color = kind === "BSL" ? "#22d3ee" : "#facc15";
      add(level.price, color, 1, LineStyle.Dashed, level.label ?? "");
    });

    return () => {
      const series = candleSeriesRef.current;
      ictLinesRef.current.forEach((line) => series?.removePriceLine(line));
      ictLinesRef.current = [];
    };
  }, [ictAnalysis]);

  return (
    <div className="flex flex-col gap-0">
      <div className="bg-zinc-900 px-2 py-1 text-xs text-zinc-500 border-b border-zinc-800">
        {symbol} — {timeframe ?? "15m"}
      </div>
      <div ref={containerRef} />
      <div className="bg-zinc-900 px-2 text-xs text-zinc-600 border-t border-zinc-800">
        RSI(14)
      </div>
      <div ref={rsiContainerRef} />
      <div className="bg-zinc-900 px-2 text-xs text-zinc-600 border-t border-zinc-800">
        MACD(12,26,9)
      </div>
      <div ref={macdContainerRef} />
    </div>
  );
}
