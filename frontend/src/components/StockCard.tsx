import React, { useState } from 'react';
import type { Quote } from '../types/stock';

interface StockCardProps {
  quote: Quote;
  isSelected: boolean;
  onClick: () => void;
  onRemove?: () => void;
}

function formatVolume(vol: number): string {
  if (vol >= 100_000_000) return `${(vol / 100_000_000).toFixed(1)}億`;
  if (vol >= 10_000) return `${(vol / 10_000).toFixed(1)}萬`;
  return vol.toLocaleString();
}

function formatPrice(price: number): string {
  return price.toFixed(2);
}

export const StockCard: React.FC<StockCardProps> = ({ quote, isSelected, onClick, onRemove }) => {
  const [hovered, setHovered] = useState(false);
  const isPositive = quote.change > 0;
  const isNegative = quote.change < 0;
  const changeClass = isPositive ? 'positive' : isNegative ? 'negative' : 'neutral';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        padding: '10px 12px',
        borderRadius: '6px',
        backgroundColor: isSelected ? 'rgba(88, 166, 255, 0.1)' : hovered ? '#2d333b' : 'var(--bg-card)',
        border: isSelected ? '1px solid rgba(88, 166, 255, 0.4)' : '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        marginBottom: '6px',
      }}
    >
      {/* Remove button */}
      {onRemove && hovered && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: 'rgba(248,81,73,0.2)',
            color: 'var(--accent-red)',
            border: '1px solid rgba(248,81,73,0.4)',
            fontSize: '10px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ✕
        </button>
      )}

      {/* Top row: name + price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.2' }}>
            {quote.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>
            {quote.symbol}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {formatPrice(quote.price)}
          </div>
        </div>
      </div>

      {/* Middle row: change */}
      <div className={changeClass} style={{ fontSize: '12px', fontVariantNumeric: 'tabular-nums', fontWeight: 500, marginBottom: '4px' }}>
        {isPositive ? '+' : ''}{formatPrice(quote.change)}
        <span style={{ marginLeft: '4px', opacity: 0.85 }}>
          ({isPositive ? '+' : ''}{quote.change_pct.toFixed(2)}%)
        </span>
      </div>

      {/* Bottom row: volume + H/L */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
          量 <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatVolume(quote.volume)}</span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          H <span style={{ color: 'var(--accent-green)' }}>{formatPrice(quote.high)}</span>
          {' '}L <span style={{ color: 'var(--accent-red)' }}>{formatPrice(quote.low)}</span>
        </div>
      </div>
    </div>
  );
};
