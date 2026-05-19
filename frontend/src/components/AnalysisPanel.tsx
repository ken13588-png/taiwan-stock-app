import React from 'react';
import type { AnalysisResult } from '../types/stock';

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  loading: boolean;
}

function trendColor(trend: string): string {
  if (trend.includes('上升')) return 'var(--accent-green)';
  if (trend.includes('下降')) return 'var(--accent-red)';
  return 'var(--accent-yellow)';
}

function recStyle(rec: string): { bg: string; color: string } {
  if (rec.includes('買入')) return { bg: 'rgba(63,185,80,0.15)', color: 'var(--accent-green)' };
  if (rec.includes('賣出')) return { bg: 'rgba(248,81,73,0.15)', color: 'var(--accent-red)' };
  return { bg: 'rgba(210,153,34,0.15)', color: 'var(--accent-yellow)' };
}

function signalChipColor(type: string): { bg: string; color: string } {
  if (type === 'bullish') return { bg: 'rgba(63,185,80,0.15)', color: 'var(--accent-green)' };
  if (type === 'bearish') return { bg: 'rgba(248,81,73,0.15)', color: 'var(--accent-red)' };
  return { bg: 'rgba(139,148,158,0.15)', color: 'var(--text-secondary)' };
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysis, loading }) => {
  if (loading) {
    return (
      <div
        style={{
          padding: '16px',
          color: 'var(--text-secondary)',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        分析中...
      </div>
    );
  }

  if (!analysis) {
    return (
      <div
        style={{
          padding: '16px',
          color: 'var(--text-secondary)',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        暫無分析數據
      </div>
    );
  }

  const tc = trendColor(analysis.trend);
  const rs = recStyle(analysis.recommendation);

  return (
    <div style={{ padding: '12px 16px', height: '100%', overflowY: 'auto' }}>
      {/* Header row: trend + recommendation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>趨勢</span>
          <span
            style={{
              padding: '2px 10px',
              borderRadius: '4px',
              backgroundColor: 'rgba(0,0,0,0.3)',
              color: tc,
              border: `1px solid ${tc}`,
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {analysis.trend}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>建議</span>
          <span
            style={{
              padding: '3px 14px',
              borderRadius: '4px',
              backgroundColor: rs.bg,
              color: rs.color,
              border: `1px solid ${rs.color}`,
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            {analysis.recommendation}
          </span>
        </div>
      </div>

      {/* Signals */}
      {analysis.signals.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>技術訊號</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {analysis.signals.map((signal, idx) => {
              const { bg, color } = signalChipColor(signal.type);
              return (
                <span
                  key={idx}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '3px',
                    backgroundColor: bg,
                    color,
                    border: `1px solid ${color}`,
                    fontSize: '11px',
                    fontWeight: 500,
                  }}
                >
                  {signal.text}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <div
        style={{
          padding: '10px 12px',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          fontSize: '12px',
          color: 'var(--text-primary)',
          lineHeight: '1.7',
        }}
      >
        {analysis.summary}
      </div>
    </div>
  );
};
