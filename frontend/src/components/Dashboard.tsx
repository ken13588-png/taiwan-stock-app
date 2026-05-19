import React from 'react';
import { KLineChart } from './KLineChart';
import type { StockHistory } from '../types/stock';

interface DashboardProps {
  history: StockHistory | null;
  loading: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ history, loading }) => {
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <KLineChart history={history} loading={loading} />
    </div>
  );
};
