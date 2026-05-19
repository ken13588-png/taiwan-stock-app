import React from 'react';
import type { AnalysisResult } from '../types/stock';

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  loading: boolean;
}

const TREND_COLOR: Record<string, string> = {
  上升: 'var(--accent-green)',
  下降: 'var(--accent-red)',
  盤整: 'var(--accent-yellow)',
};

const REC_STYLE: Record<string, { bg: string; color: string }> = {
  買入: { bg: 'rgba(63,185,80,0.15)', color: 'var(--accent-green)' },
  賣出: { bg: 'rgba(248,81,73,0.15)', color: 'var(--accent-red)' },
  觀望: { bg: 'rgba(210,153,34,0.15)', color: 'var(--accent-yellow)' },
};

// Decide signal chip color: positive signals green, negative red, neutral gray
const POSITIVE_SIGNALS = new Set([
  '黃金交叉', 'MACD黃金交叉', 'MACD翻多', 'RSI回升', '突破年線', '強勢上漲', '突破布林上軌',
]);
const NEGATIVE_SIGNALS = new Set([
  '死亡交叉', 'MACD死亡交叉', 'MACD翻空', 'RSI超買', 'RSI回落', '跌破年線',
  '急速下跌', '跌破布林下軌',
]);

function signalColor(signal: string): { bg: string; color: string } {
  if (POSITIVE_SIGNALS.has(signal)) return { bg: 'rgba(63,185,80,0.15)', color: 'var(--accent-green)' };
  if (NEGATIVE_SIGNALS.has(signal)) return { bg: 'rgba(248,81,73,0.15)', color: 'var(--accent-red)' };
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

  const trendColor = TREND_COLOR[analysis.trend] || 'var(--text-secondary)';
  const recStyle = REC_STYLE[analysis.recommendation] || { bg: 'transparent', color: 'var(--text-secondary)' };

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
              backgroundColor: `${trendColor}22`,
              color: trendColor,
              border: `1px solid ${trendColor}55`,
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
              backgroundColor: recStyle.bg,
              color: recStyle.color,
              border: `1px solid ${recStyle.color}55`,
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
              const { bg, color } = signalColor(signal);
              return (
                <span
                  key={idx}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '3px',
                    backgroundColor: bg,
                    color,
                    border: `1px solid ${color}44`,
                    fontSize: '11px',
                    fontWeight: 500,
                  }}
                >
                  {signal}
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
