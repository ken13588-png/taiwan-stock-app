import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import type { StockHistory } from '../types/stock';

interface KLineChartProps {
  history: StockHistory | null;
  loading: boolean;
}

const TOOLBAR_BTN_STYLE = (active: boolean): React.CSSProperties => ({
  padding: '4px 10px',
  borderRadius: '4px',
  backgroundColor: active ? 'rgba(88,166,255,0.2)' : 'transparent',
  color: active ? 'var(--accent-blue)' : 'var(--text-secondary)',
  border: active ? '1px solid rgba(88,166,255,0.4)' : '1px solid transparent',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s',
});

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

  const [showMA, setShowMA] = useState(true);
  const [showBB, setShowBB] = useState(false);

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1c2128' },
        horzLines: { color: '#1c2128' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#58a6ff',
          style: LineStyle.Dashed,
          width: 1,
          labelBackgroundColor: '#161b22',
        },
        horzLine: {
          color: '#58a6ff',
          style: LineStyle.Dashed,
          width: 1,
          labelBackgroundColor: '#161b22',
        },
      },
      rightPriceScale: {
        borderColor: '#30363d',
      },
      timeScale: {
        borderColor: '#30363d',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10,
        barSpacing: 8,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#3fb950',
      downColor: '#f85149',
      borderUpColor: '#3fb950',
      borderDownColor: '#f85149',
      wickUpColor: '#3fb950',
      wickDownColor: '#f85149',
    });
    candleSeriesRef.current = candleSeries;

    // Volume series
    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volSeries;

    // MA lines
    ma5Ref.current = chart.addLineSeries({
      color: '#d29922',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    ma20Ref.current = chart.addLineSeries({
      color: '#58a6ff',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    ma60Ref.current = chart.addLineSeries({
      color: '#db6d28',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // Bollinger Band lines
    bbUpperRef.current = chart.addLineSeries({
      color: 'rgba(188,140,255,0.6)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    bbMiddleRef.current = chart.addLineSeries({
      color: 'rgba(188,140,255,0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    bbLowerRef.current = chart.addLineSeries({
      color: 'rgba(188,140,255,0.6)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // ResizeObserver
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
    };
  }, []);

  // Update data when history changes
  useEffect(() => {
    if (!history || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const { data, indicators } = history;

    candleSeriesRef.current.setData(
      data.map(d => ({
        time: d.time as any,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    volumeSeriesRef.current.setData(
      data.map(d => ({
        time: d.time as any,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(63,185,80,0.45)' : 'rgba(248,81,73,0.45)',
      }))
    );

    const buildLine = (arr: (number | null)[], times: string[]) =>
      times
        .map((t, i) => ({ time: t as any, value: arr[i] }))
        .filter((p): p is { time: any; value: number } => p.value !== null && p.value !== undefined);

    const times = data.map(d => d.time);
    ma5Ref.current?.setData(buildLine(indicators.ma5, times));
    ma20Ref.current?.setData(buildLine(indicators.ma20, times));
    ma60Ref.current?.setData(buildLine(indicators.ma60, times));
    bbUpperRef.current?.setData(buildLine(indicators.bollinger.upper, times));
    bbMiddleRef.current?.setData(buildLine(indicators.bollinger.middle, times));
    bbLowerRef.current?.setData(buildLine(indicators.bollinger.lower, times));

    chartRef.current?.timeScale().fitContent();
  }, [history]);

  // Toggle MA visibility
  useEffect(() => {
    ma5Ref.current?.applyOptions({ visible: showMA });
    ma20Ref.current?.applyOptions({ visible: showMA });
    ma60Ref.current?.applyOptions({ visible: showMA });
  }, [showMA]);

  // Toggle BB visibility
  useEffect(() => {
    bbUpperRef.current?.applyOptions({ visible: showBB });
    bbMiddleRef.current?.applyOptions({ visible: showBB });
    bbLowerRef.current?.applyOptions({ visible: showBB });
  }, [showBB]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginRight: '4px' }}>
          指標:
        </span>
        <button style={TOOLBAR_BTN_STYLE(showMA)} onClick={() => setShowMA(v => !v)}>
          MA
        </button>
        <button style={TOOLBAR_BTN_STYLE(showBB)} onClick={() => setShowBB(v => !v)}>
          BB
        </button>

        {showMA && (
          <div style={{ display: 'flex', gap: '10px', marginLeft: '10px' }}>
            <span style={{ fontSize: '11px', color: '#d29922' }}>● MA5</span>
            <span style={{ fontSize: '11px', color: '#58a6ff' }}>● MA20</span>
            <span style={{ fontSize: '11px', color: '#db6d28' }}>● MA60</span>
          </div>
        )}
        {showBB && (
          <span style={{ fontSize: '11px', color: 'rgba(188,140,255,0.8)', marginLeft: '10px' }}>
            - - 布林通道
          </span>
        )}
      </div>

      {/* Chart */}
      <div style={{ flex: 1, position: 'relative' }}>
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(13,17,23,0.75)',
              zIndex: 10,
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}
          >
            載入中...
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};
