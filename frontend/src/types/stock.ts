export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  high: number;
  low: number;
  open: number;
}

export interface OHLCVData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  ma5: (number | null)[];
  ma20: (number | null)[];
  ma60: (number | null)[];
  rsi: (number | null)[];
  macd: {
    macd: (number | null)[];
    signal: (number | null)[];
    histogram: (number | null)[];
  };
  bollinger: {
    upper: (number | null)[];
    middle: (number | null)[];
    lower: (number | null)[];
  };
}

export interface StockHistory {
  symbol: string;
  name: string;
  data: OHLCVData[];
  indicators: TechnicalIndicators;
}

export interface AnalysisSignal {
  text: string;
  type: 'bullish' | 'bearish' | 'neutral';
}

export interface AnalysisResult {
  symbol: string;
  name: string;
  trend: string;
  signals: AnalysisSignal[];
  summary: string;
  recommendation: string;
}
