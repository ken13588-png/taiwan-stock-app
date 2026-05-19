# 台股分析系統

專業的台灣股票市場分析桌面應用程式，提供即時報價、K 線圖表及技術指標分析。

## 功能特色

- **即時報價**：透過 TWSE 公開 API 取得股價資訊
- **K 線圖表**：使用 TradingView Lightweight Charts 繪製互動式 K 線圖
- **技術指標**：MA5/MA20/MA60、RSI、MACD、布林通道
- **規則分析**：自動產生趨勢判斷、技術訊號偵測及操作建議
- **深色主題**：專業交易終端風格介面

## 環境需求

- Python 3.10+
- Node.js 18+

## 安裝步驟

### 後端

```bash
cd backend
pip install -r requirements.txt
```

### 前端

```bash
cd frontend
npm install
```

## 啟動方式

### 啟動後端 API 伺服器

```bash
cd backend
uvicorn main:app --reload --port 8000
```

API 文件可於 http://localhost:8000/docs 查閱。

### 啟動前端開發伺服器

```bash
cd frontend
npm run dev
```

開啟瀏覽器至 http://localhost:5173

## 專案結構

```
taiwan-stock-app/
├── backend/
│   ├── main.py                 # FastAPI 應用程式入口
│   ├── routers/
│   │   ├── stocks.py           # 股票歷史/報價 API
│   │   └── analysis.py         # 技術分析 API
│   ├── services/
│   │   ├── twse.py             # TWSE 資料擷取服務
│   │   └── indicators.py       # 技術指標計算
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # 主應用程式 + 指標面板
│   │   ├── components/
│   │   │   ├── Dashboard.tsx   # 圖表 + 分析面板組合
│   │   │   ├── StockCard.tsx   # 自選股清單卡片
│   │   │   ├── KLineChart.tsx  # K 線圖表 (lightweight-charts)
│   │   │   └── AnalysisPanel.tsx # 技術分析顯示
│   │   ├── hooks/
│   │   │   └── useStockData.ts # 資料擷取 Hook
│   │   └── types/
│   │       └── stock.ts        # TypeScript 型別定義
│   └── ...
└── README.md
```

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/stocks/history/{symbol}?months=3` | 歷史 K 線資料 + 技術指標 |
| GET | `/api/stocks/quote/{symbol}` | 即時報價 |
| GET | `/api/stocks/batch-quotes?symbols=2330,2317` | 批次報價 |
| GET | `/api/analysis/{symbol}` | 技術分析結果 |

## 預設自選股

| 代號 | 名稱 |
|------|------|
| 2330 | 台積電 |
| 2317 | 鴻海 |
| 2454 | 聯發科 |
| 2382 | 廣達 |
| 2881 | 富邦金 |
