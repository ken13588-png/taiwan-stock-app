import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type Time,
} from 'lightweight-charts';
import type { StockHistory, OHLCVData } from '../types/stock';

// lightweight-charts v4 returns BusinessDay objects for string-date inputs
function timeToDateStr(t: Time | undefined): string | null {
  if (!t) return null;
  if (typeof t === 'string') return t;
  if (typeof t === 'number') return new Date(t * 1000).toISOString().slice(0, 10);
  const bd = t as { year: number; month: number; day: number };
  return `${bd.year}-${String(bd.month).padStart(2, '0')}-${String(bd.day).padStart(2, '0')}`;
}

function formatVolume(shares: number): string {
  const lots = Math.floor(shares / 1000);
  if (lots >= 10000) return `${(lots / 10000).toFixed(1)}萬張`;
  return `${lots.toLocaleString()}張`;
}

interface KLineChartProps {
  history: StockHistory | null;
  loading: boolean;
}

type Timeframe = '1D' | '1W' | '1M';
type DrawTool = 'none' | 'hline' | 'trend';

interface TrendPoint { time: string; value: number }

// ── Data aggregation ──────────────────────────────────────────────────────────

function aggregateWeekly(data: OHLCVData[]): OHLCVData[] {
  const map = new Map<string, OHLCVData[]>();
  data.forEach(d => {
    const date = new Date(d.time);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(date);
    mon.setDate(date.getDate() + diff);
    const key = mon.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  });
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([time, bars]) => ({
    time,
    open: bars[0].open,
    high: Math.max(...bars.map(b => b.high)),
    low: Math.min(...bars.map(b => b.low)),
    close: bars[bars.length - 1].close,
    volume: bars.reduce((s, b) => s + b.volume, 0),
  }));
}

function aggregateMonthly(data: OHLCVData[]): OHLCVData[] {
  const map = new Map<string, OHLCVData[]>();
  data.forEach(d => {
    const key = d.time.slice(0, 7) + '-01';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  });
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([time, bars]) => ({
    time,
    open: bars[0].open,
    high: Math.max(...bars.map(b => b.high)),
    low: Math.min(...bars.map(b => b.low)),
    close: bars[bars.length - 1].close,
    volume: bars.reduce((s, b) => s + b.volume, 0),
  }));
}

function getDisplayData(data: OHLCVData[], tf: Timeframe): OHLCVData[] {
  if (tf === '1W') return aggregateWeekly(data);
  if (tf === '1M') return aggregateMonthly(data);
  return data;
}

// ── Series data builders ──────────────────────────────────────────────────────

function buildLine(arr: (number | null)[], times: string[]) {
  return times
    .map((t, i) => ({ time: t as any, value: arr[i] }))
    .filter((p): p is { time: any; value: number } => p.value !== null && p.value !== undefined);
}

function calcVolMA(volumes: number[], period: number): (number | null)[] {
  return volumes.map((_, i) =>
    i < period - 1 ? null : volumes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  );
}

function buildHist(arr: (number | null)[], times: string[]) {
  return times
    .map((t, i) => ({
      time: t as any,
      value: arr[i] as number,
      color: (arr[i] ?? 0) >= 0 ? 'rgba(26,127,55,0.7)' : 'rgba(207,34,46,0.7)',
    }))
    .filter((_, i) => arr[i] !== null && arr[i] !== undefined);
}

// ── Sub-chart factory options ─────────────────────────────────────────────────

function subChartOptions(container: HTMLElement) {
  return {
    layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#6b7585', fontSize: 10 },
    grid: { vertLines: { color: '#eef1f6' }, horzLines: { color: '#eef1f6' } },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: '#0969da', style: LineStyle.Dashed, width: 1 as const, labelBackgroundColor: '#1a1f2e' },
      horzLine: { color: '#0969da', style: LineStyle.Dashed, width: 1 as const, labelBackgroundColor: '#1a1f2e' },
    },
    rightPriceScale: { borderColor: '#dde1e9' },
    timeScale: { borderColor: '#dde1e9', visible: false },
    width: container.clientWidth,
    height: container.clientHeight,
  };
}

// ── Toolbar button style ──────────────────────────────────────────────────────

const btnStyle = (active: boolean, variant: 'default' | 'tool' | 'danger' = 'default'): React.CSSProperties => {
  const colors = {
    default: { active: 'rgba(88,166,255,0.2)', border: 'rgba(88,166,255,0.4)', color: 'var(--accent-blue)' },
    tool: { active: 'rgba(210,153,34,0.2)', border: 'rgba(210,153,34,0.4)', color: 'var(--accent-yellow)' },
    danger: { active: 'rgba(248,81,73,0.2)', border: 'rgba(248,81,73,0.4)', color: 'var(--accent-red)' },
  };
  const c = colors[variant];
  return {
    padding: '4px 10px',
    borderRadius: '4px',
    backgroundColor: active ? c.active : 'transparent',
    color: active ? c.color : 'var(--text-secondary)',
    border: active ? `1px solid ${c.border}` : '1px solid transparent',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  };
};

// ── Sub-chart label style ─────────────────────────────────────────────────────

const subLabelStyle: React.CSSProperties = {
  position: 'absolute', top: 4, left: 8, zIndex: 4,
  fontSize: '10px', color: '#6b7585', pointerEvents: 'none',
  backgroundColor: 'rgba(255,255,255,0.75)',
  borderRadius: '3px', padding: '1px 5px',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const KLineChart: React.FC<KLineChartProps> = ({ history, loading }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma5Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ma60Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volMa5Ref = useRef<ISeriesApi<'Line'> | null>(null);

  // Sub-chart refs
  const macdContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const isSyncingTimeRef = useRef(false);

  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [showMA, setShowMA] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [showVolMA, setShowVolMA] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>('none');
  const [trendStarted, setTrendStarted] = useState(false);

  // Drawing state
  const hLinesRef = useRef<IPriceLine[]>([]);
  const trendSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const trendFirstPointRef = useRef<TrendPoint | null>(null);
  const previewSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const drawToolRef = useRef<DrawTool>('none');
  drawToolRef.current = drawTool;

  const displayDataRef = useRef<OHLCVData[]>([]);
  const rafRef = useRef<number | null>(null);
  const isUpdatingPreviewRef = useRef(false);
  const legendRef = useRef<HTMLDivElement>(null);

  // ── Init main chart ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#6b7585', fontSize: 11 },
      grid: { vertLines: { color: '#eef1f6' }, horzLines: { color: '#eef1f6' } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#0969da', style: LineStyle.Dashed, width: 1, labelBackgroundColor: '#1a1f2e' },
        horzLine: { color: '#0969da', style: LineStyle.Dashed, width: 1, labelBackgroundColor: '#1a1f2e' },
      },
      rightPriceScale: { borderColor: '#dde1e9' },
      timeScale: { borderColor: '#dde1e9', timeVisible: true, secondsVisible: false, rightOffset: 10, barSpacing: 8 },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });
    chartRef.current = chart;

    const candle = chart.addCandlestickSeries({
      upColor: '#1a7f37', downColor: '#cf222e',
      borderUpColor: '#1a7f37', borderDownColor: '#cf222e',
      wickUpColor: '#1a7f37', wickDownColor: '#cf222e',
    });
    candleSeriesRef.current = candle;

    const vol = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeriesRef.current = vol;

    volMa5Ref.current = chart.addLineSeries({
      color: '#0ea5e9', lineWidth: 1, priceScaleId: '',
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      visible: false,
    });

    ma5Ref.current = chart.addLineSeries({ color: '#d97706', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    ma20Ref.current = chart.addLineSeries({ color: '#2563eb', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    ma60Ref.current = chart.addLineSeries({ color: '#dc2626', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    bbUpperRef.current = chart.addLineSeries({ color: 'rgba(124,58,237,0.7)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    bbMiddleRef.current = chart.addLineSeries({ color: 'rgba(124,58,237,0.4)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    bbLowerRef.current = chart.addLineSeries({ color: 'rgba(124,58,237,0.7)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    // ── Drawing: click ────────────────────────────────────────────────────────
    chart.subscribeClick(param => {
      const tool = drawToolRef.current;
      if (tool === 'none' || !param.point || !candleSeriesRef.current) return;

      const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      const time = timeToDateStr(param.time);
      if (price === null) return;

      if (tool === 'hline') {
        const pl = candleSeriesRef.current.createPriceLine({
          price, color: '#58a6ff', lineWidth: 1, lineStyle: LineStyle.Dashed,
          axisLabelVisible: true, title: price.toFixed(2),
        });
        hLinesRef.current.push(pl);
      }

      if (tool === 'trend' && time) {
        if (!trendFirstPointRef.current) {
          trendFirstPointRef.current = { time, value: price };
          setTrendStarted(true);
          const preview = chart.addLineSeries({ color: '#d29922', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
          preview.setData([{ time: time as any, value: price }]);
          previewSeriesRef.current = preview;
        } else {
          const p1 = trendFirstPointRef.current;
          if (previewSeriesRef.current) {
            chart.removeSeries(previewSeriesRef.current);
            previewSeriesRef.current = null;
          }
          if (p1.time !== time) {
            const sorted = [p1, { time, value: price }].sort((a, b) => a.time.localeCompare(b.time));
            const trendLine = chart.addLineSeries({ color: '#f0a500', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
            trendLine.setData(sorted.map(p => ({ time: p.time as any, value: p.value })));
            trendSeriesRef.current.push(trendLine);
          }
          trendFirstPointRef.current = null;
          setTrendStarted(false);
        }
      }
    });

    // ── Crosshair move: OHLCV legend + trend preview ──────────────────────────
    chart.subscribeCrosshairMove(param => {
      if (legendRef.current) {
        const time = timeToDateStr(param.time);
        if (time) {
          const bar = displayDataRef.current.find(d => d.time === time);
          if (bar) {
            const up = bar.close >= bar.open;
            const c = up ? '#1a7f37' : '#cf222e';
            legendRef.current.innerHTML =
              `<span style="color:#6b7585;margin-right:6px">${bar.time}</span>` +
              `<span style="margin-right:5px">開&nbsp;<b style="color:${c}">${bar.open.toFixed(2)}</b></span>` +
              `<span style="margin-right:5px">高&nbsp;<b style="color:#1a7f37">${bar.high.toFixed(2)}</b></span>` +
              `<span style="margin-right:5px">低&nbsp;<b style="color:#cf222e">${bar.low.toFixed(2)}</b></span>` +
              `<span style="margin-right:5px">收&nbsp;<b style="color:${c}">${bar.close.toFixed(2)}</b></span>` +
              `<span>量&nbsp;<b style="color:#0969da">${formatVolume(bar.volume)}</b></span>`;
          }
        }
      }

      if (drawToolRef.current !== 'trend' || !trendFirstPointRef.current || !param.point || !previewSeriesRef.current || !candleSeriesRef.current) return;
      if (isUpdatingPreviewRef.current) return;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (!previewSeriesRef.current || !candleSeriesRef.current || !trendFirstPointRef.current || !param.point) return;
        isUpdatingPreviewRef.current = true;
        try {
          const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
          const time = timeToDateStr(param.time);
          if (price === null || !time) return;
          const p1 = trendFirstPointRef.current;
          const sorted = [p1, { time, value: price }].sort((a, b) => a.time.localeCompare(b.time));
          previewSeriesRef.current.setData(sorted.map(p => ({ time: p.time as any, value: p.value })));
        } catch { /* ignore */ } finally {
          isUpdatingPreviewRef.current = false;
        }
      });
    });

    // ── Time scale sync: main → sub-charts (use date range, not logical index) ─
    chart.timeScale().subscribeVisibleTimeRangeChange(range => {
      if (isSyncingTimeRef.current || !range) return;
      isSyncingTimeRef.current = true;
      macdChartRef.current?.timeScale().setVisibleRange(range as any);
      rsiChartRef.current?.timeScale().setVisibleRange(range as any);
      isSyncingTimeRef.current = false;
    });

    const ro = new ResizeObserver(entries => {
      if (entries[0] && chartRef.current) {
        const { width, height } = entries[0].contentRect;
        chartRef.current.applyOptions({ width, height });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      hLinesRef.current = [];
      trendSeriesRef.current = [];
      trendFirstPointRef.current = null;
      previewSeriesRef.current = null;
    };
  }, []);

  // ── MACD sub-chart lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    if (!showMACD || !macdContainerRef.current || !chartRef.current) return;

    const container = macdContainerRef.current;
    const chart = createChart(container, subChartOptions(container));
    macdChartRef.current = chart;

    macdHistRef.current = chart.addHistogramSeries({
      priceLineVisible: false, lastValueVisible: false,
    });
    macdLineRef.current = chart.addLineSeries({
      color: '#2563eb', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    macdSignalRef.current = chart.addLineSeries({
      color: '#d97706', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });

    // Bidirectional sync: MACD → main + RSI
    const syncOut = (r: any) => {
      if (isSyncingTimeRef.current || !r) return;
      isSyncingTimeRef.current = true;
      chartRef.current?.timeScale().setVisibleRange(r);
      rsiChartRef.current?.timeScale().setVisibleRange(r);
      isSyncingTimeRef.current = false;
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(syncOut);

    const ro = new ResizeObserver(entries => {
      if (entries[0] && macdChartRef.current) {
        const { width, height } = entries[0].contentRect;
        macdChartRef.current.applyOptions({ width, height });
      }
    });
    ro.observe(container);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(syncOut);
      ro.disconnect();
      chart.remove();
      macdChartRef.current = null;
      macdHistRef.current = null;
      macdLineRef.current = null;
      macdSignalRef.current = null;
    };
  }, [showMACD]);

  // ── RSI sub-chart lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!showRSI || !rsiContainerRef.current || !chartRef.current) return;

    const container = rsiContainerRef.current;
    const chart = createChart(container, subChartOptions(container));
    rsiChartRef.current = chart;

    rsiLineRef.current = chart.addLineSeries({
      color: '#7c3aed', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    // Reference lines at 30 / 50 / 70
    rsiLineRef.current.createPriceLine({ price: 70, color: 'rgba(207,34,46,0.55)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '' });
    rsiLineRef.current.createPriceLine({ price: 50, color: 'rgba(139,148,158,0.35)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
    rsiLineRef.current.createPriceLine({ price: 30, color: 'rgba(26,127,55,0.55)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '' });

    // Bidirectional sync: RSI → main + MACD
    const syncOut = (r: any) => {
      if (isSyncingTimeRef.current || !r) return;
      isSyncingTimeRef.current = true;
      chartRef.current?.timeScale().setVisibleRange(r);
      macdChartRef.current?.timeScale().setVisibleRange(r);
      isSyncingTimeRef.current = false;
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(syncOut);

    const ro = new ResizeObserver(entries => {
      if (entries[0] && rsiChartRef.current) {
        const { width, height } = entries[0].contentRect;
        rsiChartRef.current.applyOptions({ width, height });
      }
    });
    ro.observe(container);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(syncOut);
      ro.disconnect();
      chart.remove();
      rsiChartRef.current = null;
      rsiLineRef.current = null;
    };
  }, [showRSI]);

  // ── Update main chart data ──────────────────────────────────────────────────
  useEffect(() => {
    if (!history || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const display = getDisplayData(history.data, timeframe);
    displayDataRef.current = display;
    const { indicators } = history;

    // Suppress sub-chart sync while main chart data loads — fitContent fires
    // subscribeVisibleTimeRangeChange before sub-chart data effect has run
    isSyncingTimeRef.current = true;

    candleSeriesRef.current.setData(display.map(d => ({ time: d.time as any, open: d.open, high: d.high, low: d.low, close: d.close })));
    volumeSeriesRef.current.setData(display.map(d => ({ time: d.time as any, value: d.volume, color: d.close >= d.open ? 'rgba(26,127,55,0.7)' : 'rgba(207,34,46,0.7)' })));

    if (timeframe === '1D') {
      const times = history.data.map(d => d.time);
      ma5Ref.current?.setData(buildLine(indicators.ma5, times));
      ma20Ref.current?.setData(buildLine(indicators.ma20, times));
      ma60Ref.current?.setData(buildLine(indicators.ma60, times));
      bbUpperRef.current?.setData(buildLine(indicators.bollinger.upper, times));
      bbMiddleRef.current?.setData(buildLine(indicators.bollinger.middle, times));
      bbLowerRef.current?.setData(buildLine(indicators.bollinger.lower, times));
      const volMA5 = calcVolMA(history.data.map(d => d.volume), 5);
      volMa5Ref.current?.setData(buildLine(volMA5, times));
    } else {
      ma5Ref.current?.setData([]);
      ma20Ref.current?.setData([]);
      ma60Ref.current?.setData([]);
      bbUpperRef.current?.setData([]);
      bbMiddleRef.current?.setData([]);
      bbLowerRef.current?.setData([]);
      volMa5Ref.current?.setData([]);
    }

    chartRef.current?.timeScale().fitContent();
    isSyncingTimeRef.current = false;

    const last = display[display.length - 1];
    if (last && legendRef.current) {
      const up = last.close >= last.open;
      const c = up ? '#1a7f37' : '#cf222e';
      legendRef.current.innerHTML =
        `<span style="color:#6b7585;margin-right:6px">${last.time}</span>` +
        `<span style="margin-right:5px">開&nbsp;<b style="color:${c}">${last.open.toFixed(2)}</b></span>` +
        `<span style="margin-right:5px">高&nbsp;<b style="color:#1a7f37">${last.high.toFixed(2)}</b></span>` +
        `<span style="margin-right:5px">低&nbsp;<b style="color:#cf222e">${last.low.toFixed(2)}</b></span>` +
        `<span style="margin-right:5px">收&nbsp;<b style="color:${c}">${last.close.toFixed(2)}</b></span>` +
        `<span>量&nbsp;<b style="color:#0969da">${formatVolume(last.volume)}</b></span>`;
    }
  }, [history, timeframe]);

  // ── Update sub-chart data ───────────────────────────────────────────────────
  useEffect(() => {
    if (!history) return;
    const times = history.data.map(d => d.time);
    const { indicators } = history;
    const is1D = timeframe === '1D';

    // Suppress sync callbacks while loading data — setData may trigger
    // subscribeVisibleTimeRangeChange, and peer charts may be empty at that moment
    isSyncingTimeRef.current = true;

    if (macdHistRef.current && macdLineRef.current && macdSignalRef.current) {
      if (is1D) {
        macdHistRef.current.setData(buildHist(indicators.macd.histogram, times));
        macdLineRef.current.setData(buildLine(indicators.macd.macd, times));
        macdSignalRef.current.setData(buildLine(indicators.macd.signal, times));
      } else {
        macdHistRef.current.setData([]);
        macdLineRef.current.setData([]);
        macdSignalRef.current.setData([]);
      }
    }

    if (rsiLineRef.current) {
      rsiLineRef.current.setData(is1D ? buildLine(indicators.rsi, times) : []);
    }

    isSyncingTimeRef.current = false;

    // Explicit range sync after all charts have data
    if (is1D) {
      const currentRange = chartRef.current?.timeScale().getVisibleRange();
      if (currentRange) {
        macdChartRef.current?.timeScale().setVisibleRange(currentRange as any);
        rsiChartRef.current?.timeScale().setVisibleRange(currentRange as any);
      }
    }
  }, [history, timeframe, showMACD, showRSI]);

  // ── Toggle MA/BB visibility ─────────────────────────────────────────────────
  useEffect(() => {
    ma5Ref.current?.applyOptions({ visible: showMA && timeframe === '1D' });
    ma20Ref.current?.applyOptions({ visible: showMA && timeframe === '1D' });
    ma60Ref.current?.applyOptions({ visible: showMA && timeframe === '1D' });
  }, [showMA, timeframe]);

  useEffect(() => {
    bbUpperRef.current?.applyOptions({ visible: showBB && timeframe === '1D' });
    bbMiddleRef.current?.applyOptions({ visible: showBB && timeframe === '1D' });
    bbLowerRef.current?.applyOptions({ visible: showBB && timeframe === '1D' });
  }, [showBB, timeframe]);

  useEffect(() => {
    volMa5Ref.current?.applyOptions({ visible: showVolMA && timeframe === '1D' });
  }, [showVolMA, timeframe]);

  // ── Drawing tools ───────────────────────────────────────────────────────────
  const clearDrawings = () => {
    if (!candleSeriesRef.current || !chartRef.current) return;
    hLinesRef.current.forEach(pl => { try { candleSeriesRef.current!.removePriceLine(pl); } catch { } });
    hLinesRef.current = [];
    trendSeriesRef.current.forEach(s => { try { chartRef.current!.removeSeries(s); } catch { } });
    trendSeriesRef.current = [];
    if (previewSeriesRef.current) { try { chartRef.current.removeSeries(previewSeriesRef.current); } catch { } previewSeriesRef.current = null; }
    trendFirstPointRef.current = null;
    setTrendStarted(false);
  };

  const selectTool = (tool: DrawTool) => {
    if (trendFirstPointRef.current && chartRef.current && previewSeriesRef.current) {
      try { chartRef.current.removeSeries(previewSeriesRef.current); } catch { }
      previewSeriesRef.current = null;
      trendFirstPointRef.current = null;
      setTrendStarted(false);
    }
    setDrawTool(prev => prev === tool ? 'none' : tool);
  };

  const chartCursor = drawTool !== 'none' ? 'crosshair' : 'default';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', flexShrink: 0, flexWrap: 'wrap' }}>

        {/* Timeframe */}
        <div style={{ display: 'flex', gap: '2px', marginRight: '6px' }}>
          {(['1D', '1W', '1M'] as Timeframe[]).map(tf => (
            <button key={tf} style={btnStyle(timeframe === tf)} onClick={() => setTimeframe(tf)}>{tf}</button>
          ))}
        </div>

        <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border)' }} />

        {/* Overlay indicators */}
        <button style={btnStyle(showMA)} onClick={() => setShowMA(v => !v)}>MA</button>
        <button style={btnStyle(showBB)} onClick={() => setShowBB(v => !v)}>BB</button>
        <button style={btnStyle(showVolMA)} onClick={() => setShowVolMA(v => !v)}>均量</button>

        {showMA && timeframe === '1D' && (
          <div style={{ display: 'flex', gap: '10px', marginLeft: '4px' }}>
            <span style={{ fontSize: '11px', color: '#d97706' }}>● MA5</span>
            <span style={{ fontSize: '11px', color: '#2563eb' }}>● MA20</span>
            <span style={{ fontSize: '11px', color: '#dc2626' }}>● MA60</span>
          </div>
        )}
        {showBB && timeframe === '1D' && (
          <span style={{ fontSize: '11px', color: 'rgba(188,140,255,0.8)', marginLeft: '6px' }}>- - 布林通道</span>
        )}
        {showVolMA && timeframe === '1D' && (
          <span style={{ fontSize: '11px', color: '#0ea5e9', marginLeft: '6px' }}>— 均量MA5</span>
        )}

        <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border)' }} />

        {/* Sub-chart indicators */}
        <button style={btnStyle(showMACD)} onClick={() => setShowMACD(v => !v)}>MACD</button>
        <button style={btnStyle(showRSI)} onClick={() => setShowRSI(v => !v)}>RSI</button>

        {showMACD && (
          <div style={{ display: 'flex', gap: '8px', marginLeft: '4px' }}>
            <span style={{ fontSize: '11px', color: '#2563eb' }}>■ MACD</span>
            <span style={{ fontSize: '11px', color: '#d97706' }}>— Signal</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Drawing tools */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginRight: '2px' }}>劃線:</span>
          <button style={btnStyle(drawTool === 'hline', 'tool')} onClick={() => selectTool('hline')} title="水平線">─ 水平線</button>
          <button style={btnStyle(drawTool === 'trend', 'tool')} onClick={() => selectTool('trend')} title="趨勢線">
            {trendStarted ? '📍 點第2點' : '╱ 趨勢線'}
          </button>
          <button style={btnStyle(false, 'danger')} onClick={clearDrawings} title="清除畫線">✕ 清除</button>
        </div>
      </div>

      {/* Chart stack */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Main K-line chart */}
        <div style={{ flex: 1, position: 'relative', cursor: chartCursor, minHeight: 0 }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,246,249,0.88)', zIndex: 10, fontSize: '13px', color: 'var(--text-secondary)' }}>
              載入中...
            </div>
          )}
          <div
            ref={legendRef}
            style={{
              position: 'absolute', top: '6px', left: '8px', zIndex: 4,
              display: 'flex', flexWrap: 'wrap', gap: '0px',
              alignItems: 'center', fontSize: '11px', fontVariantNumeric: 'tabular-nums',
              pointerEvents: 'none',
              backgroundColor: 'rgba(255,255,255,0.82)',
              borderRadius: '4px', padding: '2px 7px',
              color: 'var(--text-primary)',
            }}
          />
          {drawTool !== 'none' && (
            <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', zIndex: 5, backgroundColor: 'rgba(210,153,34,0.15)', color: 'var(--accent-yellow)', border: '1px solid rgba(210,153,34,0.4)', borderRadius: '4px', padding: '3px 10px', fontSize: '11px', pointerEvents: 'none' }}>
              {drawTool === 'hline' ? '點擊圖表設定水平線' : trendStarted ? '點擊第2個點完成趨勢線' : '點擊第1個點開始趨勢線'}
            </div>
          )}
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* MACD sub-chart */}
        {showMACD && (
          <div style={{ height: '100px', flexShrink: 0, borderTop: '1px solid var(--border)', position: 'relative' }}>
            <span style={subLabelStyle}>
              MACD (12,26,9)&nbsp;&nbsp;
              {timeframe !== '1D' && <span style={{ color: 'var(--accent-yellow)' }}>僅日線</span>}
            </span>
            <div ref={macdContainerRef} style={{ width: '100%', height: '100%' }} />
          </div>
        )}

        {/* RSI sub-chart */}
        {showRSI && (
          <div style={{ height: '80px', flexShrink: 0, borderTop: '1px solid var(--border)', position: 'relative' }}>
            <span style={subLabelStyle}>
              RSI (14)&nbsp;&nbsp;
              {timeframe !== '1D' && <span style={{ color: 'var(--accent-yellow)' }}>僅日線</span>}
            </span>
            <div ref={rsiContainerRef} style={{ width: '100%', height: '100%' }} />
          </div>
        )}

      </div>
    </div>
  );
};
