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

export interface AnalysisResult {
  symbol: string;
  name: string;
  trend: '上升' | '下降' | '盤整';
  signals: string[];
  summary: string;
  recommendation: '買入' | '賣出' | '觀望';
}
