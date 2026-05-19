import React from 'react';
import type { Quote } from '../types/stock';

interface StockCardProps {
  quote: Quote;
  isSelected: boolean;
  onClick: () => void;
}

function formatVolume(vol: number): string {
  if (vol >= 100_000_000) return `${(vol / 100_000_000).toFixed(1)}億`;
  if (vol >= 10_000) return `${(vol / 10_000).toFixed(1)}萬`;
  return vol.toLocaleString();
}

function formatPrice(price: number): string {
  return price.toFixed(2);
}

export const StockCard: React.FC<StockCardProps> = ({ quote, isSelected, onClick }) => {
  const isPositive = quote.change > 0;
  const isNegative = quote.change < 0;
  const changeClass = isPositive ? 'positive' : isNegative ? 'negative' : 'neutral';

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        borderRadius: '6px',
        backgroundColor: isSelected ? 'rgba(88, 166, 255, 0.1)' : 'var(--bg-card)',
        border: isSelected
          ? '1px solid rgba(88, 166, 255, 0.4)'
          : '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        marginBottom: '6px',
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.backgroundColor = '#2d333b';
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--bg-card)';
        }
      }}
    >
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

      {/* Bottom row: change + volume */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className={changeClass} style={{ fontSize: '12px', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
          {isPositive ? '+' : ''}{formatPrice(quote.change)}
          <span style={{ marginLeft: '4px', opacity: 0.85 }}>
            ({isPositive ? '+' : ''}{quote.change_pct.toFixed(2)}%)
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          {formatVolume(quote.volume)}
        </div>
      </div>
    </div>
  );
};
