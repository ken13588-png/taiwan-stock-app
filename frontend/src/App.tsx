import React, { useState, useEffect, useCallback } from 'react';
import { Dashboard } from './components/Dashboard';
import { StockCard } from './components/StockCard';
import { useStockData, fetchBatchQuotes } from './hooks/useStockData';
import type { Quote, StockHistory } from './types/stock';

const DEFAULT_WATCHLIST = ['2330', '2317', '2454', '2382', '2881'];
const DEFAULT_SYMBOL = '2330';

const STOCK_NAMES: Record<string, string> = {
  '2330': '台積電',
  '2317': '鴻海',
  '2454': '聯發科',
  '2382': '廣達',
  '2881': '富邦金',
};

function formatPrice(price: number): string {
  return price > 0 ? price.toFixed(2) : '--';
}

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(DEFAULT_SYMBOL);
  const [watchlist] = useState<string[]>(DEFAULT_WATCHLIST);
  const [watchlistQuotes, setWatchlistQuotes] = useState<Record<string, Quote>>({});
  const [watchlistLoading, setWatchlistLoading] = useState(true);

  const { history, quote, analysis, loading, error, refetch } = useStockData(selectedSymbol);

  // Fetch batch quotes for watchlist
  const loadWatchlistQuotes = useCallback(async () => {
    setWatchlistLoading(true);
    try {
      const quotes = await fetchBatchQuotes(watchlist);
      const map: Record<string, Quote> = {};
      quotes.forEach(q => { map[q.symbol] = q; });
      setWatchlistQuotes(map);
    } catch {
      // Fallback: use placeholder quotes
    } finally {
      setWatchlistLoading(false);
    }
  }, [watchlist]);

  useEffect(() => {
    loadWatchlistQuotes();
    // Refresh watchlist every 60s
    const interval = setInterval(loadWatchlistQuotes, 60_000);
    return () => clearInterval(interval);
  }, [loadWatchlistQuotes]);

  const selectedName =
    quote?.name || STOCK_NAMES[selectedSymbol] || selectedSymbol;

  return (
    <div
      className="app-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* ── Navbar ── */}
      <header
        className="navbar"
        style={{
          height: '44px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          flexShrink: 0,
          gap: '16px',
        }}
      >
        {/* Logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '4px',
              backgroundColor: 'var(--accent-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 800,
              color: '#0d1117',
            }}
          >
            台
          </div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            台股分析
          </span>
        </div>

        <div
          style={{
            width: '1px',
            height: '20px',
            backgroundColor: 'var(--border)',
          }}
        />

        {/* Selected stock display */}
        {quote && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedName}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                {selectedSymbol}
              </span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
              {formatPrice(quote.price)}
            </div>
            <div
              className={quote.change > 0 ? 'positive' : quote.change < 0 ? 'negative' : 'neutral'}
              style={{ fontSize: '13px', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}
            >
              {quote.change > 0 ? '+' : ''}{formatPrice(quote.change)}
              <span style={{ marginLeft: '4px', opacity: 0.8 }}>
                ({quote.change > 0 ? '+' : ''}{quote.change_pct.toFixed(2)}%)
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              H {formatPrice(quote.high)} &nbsp; L {formatPrice(quote.low)}
            </div>
          </div>
        )}

        {loading && !quote && (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>載入中...</div>
        )}

        <div style={{ flex: 1 }} />

        {/* Refresh button */}
        <button
          onClick={refetch}
          style={{
            padding: '4px 12px',
            borderRadius: '4px',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            fontSize: '12px',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-blue)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          重新整理
        </button>
      </header>

      {/* ── Body ── */}
      <div className="app-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left Sidebar: Watchlist ── */}
        <aside
          className="sidebar-left"
          style={{
            width: '220px',
            flexShrink: 0,
            backgroundColor: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            自選股
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {watchlist.map(sym => {
              const q = watchlistQuotes[sym] || {
                symbol: sym,
                name: STOCK_NAMES[sym] || sym,
                price: 0,
                change: 0,
                change_pct: 0,
                volume: 0,
                high: 0,
                low: 0,
                open: 0,
              };
              return (
                <StockCard
                  key={sym}
                  quote={q}
                  isSelected={sym === selectedSymbol}
                  onClick={() => setSelectedSymbol(sym)}
                />
              );
            })}
          </div>
          {/* Market status indicator */}
          <div
            style={{
              padding: '8px 12px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-green)',
              }}
            />
            台灣證券交易所
          </div>
        </aside>

        {/* ── Main Chart Area ── */}
        <main className="main-content" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {error && (
            <div
              style={{
                padding: '8px 16px',
                backgroundColor: 'rgba(248,81,73,0.1)',
                borderBottom: '1px solid rgba(248,81,73,0.3)',
                fontSize: '12px',
                color: 'var(--accent-red)',
                flexShrink: 0,
              }}
            >
              {error}
            </div>
          )}
          <div className="chart-container" style={{ flex: 1, overflow: 'hidden' }}>
            <Dashboard history={history} analysis={analysis} loading={loading} />
          </div>
        </main>

        {/* ── Right Sidebar: Technical Indicators ── */}
        <aside
          className="sidebar-right"
          style={{
            width: '260px',
            flexShrink: 0,
            backgroundColor: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
            }}
          >
            技術指標
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            <IndicatorPanel history={history} loading={loading} />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Inline IndicatorPanel component ──
interface IndicatorPanelProps {
  history: StockHistory | null;
  loading: boolean;
}

function IndicatorPanel({ history, loading }: IndicatorPanelProps) {
  if (loading) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>計算中...</div>;
  }
  if (!history) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>暫無數據</div>;
  }

  const { data, indicators } = history;
  const n = data.length;
  if (n === 0) return null;

  const lastClose = data[n - 1].close;

  // Latest non-null values
  const getLastVal = (arr: (number | null)[]): number | null =>
    [...arr].reverse().find(v => v !== null) ?? null;

  const ma5 = getLastVal(indicators.ma5);
  const ma20 = getLastVal(indicators.ma20);
  const ma60 = getLastVal(indicators.ma60);
  const rsi = getLastVal(indicators.rsi);
  const macd = getLastVal(indicators.macd.macd);
  const signal = getLastVal(indicators.macd.signal);
  const hist = getLastVal(indicators.macd.histogram);
  const bbUpper = getLastVal(indicators.bollinger.upper);
  const bbMiddle = getLastVal(indicators.bollinger.middle);
  const bbLower = getLastVal(indicators.bollinger.lower);

  const fmt = (v: number | null) => (v !== null ? v.toFixed(2) : '--');
  const fmtSmall = (v: number | null) => (v !== null ? v.toFixed(4) : '--');

  const rsiColor =
    rsi === null ? 'var(--text-secondary)'
    : rsi > 70 ? 'var(--accent-red)'
    : rsi < 30 ? 'var(--accent-green)'
    : 'var(--text-primary)';

  const macdColor = hist === null ? 'var(--text-secondary)' : hist > 0 ? 'var(--accent-green)' : 'var(--accent-red)';

  function maRelColor(ma: number | null) {
    if (ma === null) return 'var(--text-secondary)';
    return lastClose > ma ? 'var(--accent-green)' : 'var(--accent-red)';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Moving Averages */}
      <Section title="均線">
        <Row label="MA5" value={fmt(ma5)} color={maRelColor(ma5)} sub={ma5 !== null ? (lastClose > ma5 ? '↑ 價在線上' : '↓ 價在線下') : undefined} />
        <Row label="MA20" value={fmt(ma20)} color={maRelColor(ma20)} sub={ma20 !== null ? (lastClose > ma20 ? '↑ 價在線上' : '↓ 價在線下') : undefined} />
        <Row label="MA60" value={fmt(ma60)} color={maRelColor(ma60)} sub={ma60 !== null ? (lastClose > ma60 ? '↑ 價在線上' : '↓ 價在線下') : undefined} />
      </Section>

      {/* RSI */}
      <Section title="RSI (14)">
        <Row label="RSI" value={fmt(rsi)} color={rsiColor} />
        {rsi !== null && (
          <div style={{ marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>超賣 30</span>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>超買 70</span>
            </div>
            <div style={{ height: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '3px', position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${Math.min(rsi, 100)}%`,
                  backgroundColor: rsiColor,
                  borderRadius: '3px',
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        )}
      </Section>

      {/* MACD */}
      <Section title="MACD (12,26,9)">
        <Row label="MACD" value={fmtSmall(macd)} color={macd !== null ? (macd > 0 ? 'var(--accent-green)' : 'var(--accent-red)') : undefined} />
        <Row label="Signal" value={fmtSmall(signal)} />
        <Row label="Histogram" value={fmtSmall(hist)} color={macdColor} />
      </Section>

      {/* Bollinger Bands */}
      <Section title="布林通道 (20,2)">
        <Row label="上軌" value={fmt(bbUpper)} color="rgba(188,140,255,0.9)" />
        <Row label="中軌" value={fmt(bbMiddle)} color="rgba(188,140,255,0.6)" />
        <Row label="下軌" value={fmt(bbLower)} color="rgba(188,140,255,0.9)" />
        {bbUpper !== null && bbLower !== null && bbMiddle !== null && (
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            帶寬: {((bbUpper - bbLower) / bbMiddle * 100).toFixed(2)}%
          </div>
        )}
      </Section>

      {/* Recent prices */}
      <Section title="近期收盤">
        {data.slice(-5).reverse().map((d, i) => {
          const prev = data[n - 1 - i - 1];
          const chg = prev ? d.close - prev.close : 0;
          const isPos = chg > 0;
          const isNeg = chg < 0;
          return (
            <div
              key={d.time}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '3px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: '11px',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{d.time}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                {d.close.toFixed(2)}
              </span>
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  color: isPos ? 'var(--accent-green)' : isNeg ? 'var(--accent-red)' : 'var(--text-secondary)',
                  minWidth: '48px',
                  textAlign: 'right',
                }}
              >
                {isPos ? '+' : ''}{chg.toFixed(2)}
              </span>
            </div>
          );
        })}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '5px 10px',
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {title}
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            fontSize: '12px',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 600,
            color: color || 'var(--text-primary)',
          }}
        >
          {value}
        </span>
        {sub && (
          <span style={{ marginLeft: '5px', fontSize: '10px', color: color || 'var(--text-secondary)', opacity: 0.8 }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
