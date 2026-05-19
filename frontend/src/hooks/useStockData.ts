import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { StockHistory, Quote, AnalysisResult } from '../types/stock';
import { API_BASE } from '../config';

const BASE_URL = API_BASE;

interface StockDataState {
  history: StockHistory | null;
  quote: Quote | null;
  analysis: AnalysisResult | null;
  loading: boolean;
  error: string | null;
}

export function useStockData(symbol: string): StockDataState & { refetch: () => void } {
  const [state, setState] = useState<StockDataState>({
    history: null,
    quote: null,
    analysis: null,
    loading: false,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!symbol) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const [historyRes, quoteRes, analysisRes] = await Promise.allSettled([
        axios.get<StockHistory>(`${BASE_URL}/api/stocks/history/${symbol}?months=3`),
        axios.get<Quote>(`${BASE_URL}/api/stocks/quote/${symbol}`),
        axios.get<AnalysisResult>(`${BASE_URL}/api/analysis/${symbol}`),
      ]);

      const history =
        historyRes.status === 'fulfilled' ? historyRes.value.data : null;
      const quote =
        quoteRes.status === 'fulfilled' ? quoteRes.value.data : null;
      const analysis =
        analysisRes.status === 'fulfilled' ? analysisRes.value.data : null;

      const errors: string[] = [];
      if (historyRes.status === 'rejected') errors.push('歷史數據載入失敗');
      if (quoteRes.status === 'rejected') errors.push('即時報價載入失敗');
      if (analysisRes.status === 'rejected') errors.push('分析數據載入失敗');

      setState({
        history,
        quote,
        analysis,
        loading: false,
        error: errors.length > 0 ? errors.join('；') : null,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: '無法連線至後端伺服器，請確認 API 服務是否正在運行。',
      }));
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

export async function fetchBatchQuotes(symbols: string[]): Promise<Quote[]> {
  const res = await axios.get<Quote[]>(
    `${BASE_URL}/api/stocks/batch-quotes?symbols=${symbols.join(',')}`
  );
  return res.data;
}
