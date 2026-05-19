import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
} from 'lightweight-charts';
import type { StockHistory, OHLCVData } from '../types/stock';

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

  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [showMA, setShowMA] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>('none');

  // Drawing state
  const hLinesRef = useRef<IPriceLine[]>([]);
  const trendSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const trendFirstPointRef = useRef<TrendPoint | null>(null);
  const previewSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const drawToolRef = useRef<DrawTool>('none');
  drawToolRef.current = drawTool;

  // Keep ref to display data for click handler
  const displayDataRef = useRef<OHLCVData[]>([]);

  // ── Init chart ──────────────────────────────────────────────────────────────
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

    const vol = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'volume' });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volumeSeriesRef.current = vol;

    ma5Ref.current = chart.addLineSeries({ color: '#d97706', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    ma20Ref.current = chart.addLineSeries({ color: '#2563eb', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    ma60Ref.current = chart.addLineSeries({ color: '#dc2626', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    bbUpperRef.current = chart.addLineSeries({ color: 'rgba(124,58,237,0.7)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    bbMiddleRef.current = chart.addLineSeries({ color: 'rgba(124,58,237,0.4)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    bbLowerRef.current = chart.addLineSeries({ color: 'rgba(124,58,237,0.7)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });

    // ── Drawing: click handler ────────────────────────────────────────────────
    chart.subscribeClick(param => {
      const tool = drawToolRef.current;
      if (tool === 'none' || !param.point || !candleSeriesRef.current) return;

      const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      const time = param.time as string | undefined;
      if (price === null) return;

      if (tool === 'hline') {
        const pl = candleSeriesRef.current.createPriceLine({
          price,
          color: '#58a6ff',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: price.toFixed(2),
        });
        hLinesRef.current.push(pl);
      }

      if (tool === 'trend' && time) {
        if (!trendFirstPointRef.current) {
          trendFirstPointRef.current = { time, value: price };
          // Create preview series
          const preview = chart.addLineSeries({ color: '#d29922', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
          preview.setData([{ time: time as any, value: price }]);
          previewSeriesRef.current = preview;
        } else {
          const p1 = trendFirstPointRef.current;
          // Remove preview
          if (previewSeriesRef.current) {
            chart.removeSeries(previewSeriesRef.current);
            previewSeriesRef.current = null;
          }
          // Add permanent trend line
          const sorted = [p1, { time, value: price }].sort((a, b) => a.time.localeCompare(b.time));
          const trendLine = chart.addLineSeries({ color: '#f0a500', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          trendLine.setData(sorted.map(p => ({ time: p.time as any, value: p.value })));
          trendSeriesRef.current.push(trendLine);
          trendFirstPointRef.current = null;
        }
      }
    });

    // ── Crosshair move: update preview trend line ─────────────────────────────
    chart.subscribeCrosshairMove(param => {
      if (drawToolRef.current !== 'trend' || !trendFirstPointRef.current || !param.point || !previewSeriesRef.current || !candleSeriesRef.current) return;
      const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      const time = param.time as string | undefined;
      if (price === null || !time) return;
      const p1 = trendFirstPointRef.current;
      const sorted = [p1, { time, value: price }].sort((a, b) => a.time.localeCompare(b.time));
      try {
        previewSeriesRef.current.setData(sorted.map(p => ({ time: p.time as any, value: p.value })));
      } catch { /* ignore if times are equal */ }
    });

    const ro = new ResizeObserver(entries => {
      if (entries[0] && chartRef.current) {
        const { width, height } = entries[0].contentRect;
        chartRef.current.applyOptions({ width, height });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      hLinesRef.current = [];
      trendSeriesRef.current = [];
      trendFirstPointRef.current = null;
      previewSeriesRef.current = null;
    };
  }, []);

  // ── Update data when history or timeframe changes ─────────────────────────
  useEffect(() => {
    if (!history || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const display = getDisplayData(history.data, timeframe);
    displayDataRef.current = display;
    const { indicators } = history;

    candleSeriesRef.current.setData(display.map(d => ({ time: d.time as any, open: d.open, high: d.high, low: d.low, close: d.close })));
    volumeSeriesRef.current.setData(display.map(d => ({ time: d.time as any, value: d.volume, color: d.close >= d.open ? 'rgba(26,127,55,0.4)' : 'rgba(207,34,46,0.4)' })));

    const buildLine = (arr: (number | null)[], times: string[]) =>
      times.map((t, i) => ({ time: t as any, value: arr[i] })).filter((p): p is { time: any; value: number } => p.value !== null && p.value !== undefined);

    // MA & BB are calculated on daily data; only show on 1D
    if (timeframe === '1D') {
      const times = history.data.map(d => d.time);
      ma5Ref.current?.setData(buildLine(indicators.ma5, times));
      ma20Ref.current?.setData(buildLine(indicators.ma20, times));
      ma60Ref.current?.setData(buildLine(indicators.ma60, times));
      bbUpperRef.current?.setData(buildLine(indicators.bollinger.upper, times));
      bbMiddleRef.current?.setData(buildLine(indicators.bollinger.middle, times));
      bbLowerRef.current?.setData(buildLine(indicators.bollinger.lower, times));
    } else {
      ma5Ref.current?.setData([]);
      ma20Ref.current?.setData([]);
      ma60Ref.current?.setData([]);
      bbUpperRef.current?.setData([]);
      bbMiddleRef.current?.setData([]);
      bbLowerRef.current?.setData([]);
    }

    chartRef.current?.timeScale().fitContent();
  }, [history, timeframe]);

  // ── Toggle MA/BB ──────────────────────────────────────────────────────────
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

  // ── Cursor style based on tool ────────────────────────────────────────────
  const chartCursor = drawTool !== 'none' ? 'crosshair' : 'default';

  // ── Clear all drawings ────────────────────────────────────────────────────
  const clearDrawings = () => {
    if (!candleSeriesRef.current || !chartRef.current) return;
    hLinesRef.current.forEach(pl => { try { candleSeriesRef.current!.removePriceLine(pl); } catch { } });
    hLinesRef.current = [];
    trendSeriesRef.current.forEach(s => { try { chartRef.current!.removeSeries(s); } catch { } });
    trendSeriesRef.current = [];
    if (previewSeriesRef.current) { try { chartRef.current.removeSeries(previewSeriesRef.current); } catch { } previewSeriesRef.current = null; }
    trendFirstPointRef.current = null;
  };

  const selectTool = (tool: DrawTool) => {
    // Cancel any in-progress trend
    if (trendFirstPointRef.current && chartRef.current && previewSeriesRef.current) {
      try { chartRef.current.removeSeries(previewSeriesRef.current); } catch { }
      previewSeriesRef.current = null;
      trendFirstPointRef.current = null;
    }
    setDrawTool(prev => prev === tool ? 'none' : tool);
  };

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

        {/* Indicators */}
        <button style={btnStyle(showMA)} onClick={() => setShowMA(v => !v)}>MA</button>
        <button style={btnStyle(showBB)} onClick={() => setShowBB(v => !v)}>BB</button>

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

        <div style={{ flex: 1 }} />

        {/* Drawing tools */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginRight: '2px' }}>劃線:</span>
          <button style={btnStyle(drawTool === 'hline', 'tool')} onClick={() => selectTool('hline')} title="水平線">─ 水平線</button>
          <button style={btnStyle(drawTool === 'trend', 'tool')} onClick={() => selectTool('trend')} title="趨勢線">
            {trendFirstPointRef.current ? '📍 點第2點' : '╱ 趨勢線'}
          </button>
          <button style={btnStyle(false, 'danger')} onClick={clearDrawings} title="清除畫線">✕ 清除</button>
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, position: 'relative', cursor: chartCursor }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,246,249,0.88)', zIndex: 10, fontSize: '13px', color: 'var(--text-secondary)' }}>
            載入中...
          </div>
        )}
        {drawTool !== 'none' && (
          <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', zIndex: 5, backgroundColor: 'rgba(210,153,34,0.15)', color: 'var(--accent-yellow)', border: '1px solid rgba(210,153,34,0.4)', borderRadius: '4px', padding: '3px 10px', fontSize: '11px', pointerEvents: 'none' }}>
            {drawTool === 'hline' ? '點擊圖表設定水平線' : trendFirstPointRef.current ? '點擊第2個點完成趨勢線' : '點擊第1個點開始趨勢線'}
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};
