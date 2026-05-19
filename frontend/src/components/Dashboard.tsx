import React from 'react';
import { KLineChart } from './KLineChart';
import { AnalysisPanel } from './AnalysisPanel';
import type { StockHistory, AnalysisResult } from '../types/stock';

interface DashboardProps {
  history: StockHistory | null;
  analysis: AnalysisResult | null;
  loading: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ history, analysis, loading }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* K-Line Chart — top 62% */}
      <div
        style={{
          flex: '0 0 62%',
          borderBottom: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <KLineChart history={history} loading={loading} />
      </div>

      {/* Analysis Panel — bottom 38% */}
      <div
        style={{
          flex: '0 0 38%',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div
          style={{
            padding: '6px 16px',
            borderBottom: '1px solid var(--border)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          技術分析
        </div>
        <div style={{ height: 'calc(100% - 30px)', overflowY: 'auto' }}>
          <AnalysisPanel analysis={analysis} loading={loading} />
        </div>
      </div>
    </div>
  );
};
