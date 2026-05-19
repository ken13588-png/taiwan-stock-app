from __future__ import annotations
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
import yfinance as yf

STOCK_NAMES: dict[str, str] = {
    "2330": "台積電",
    "2317": "鴻海",
    "2454": "聯發科",
    "2382": "廣達",
    "2881": "富邦金",
    "2882": "國泰金",
    "2886": "兆豐金",
    "2412": "中華電",
    "2308": "台達電",
    "2303": "聯電",
    "2891": "中信金",
    "1301": "台塑",
    "1303": "南亞",
    "2002": "中鋼",
    "2207": "和泰車",
}

_executor = ThreadPoolExecutor(max_workers=4)


def _fetch_history(symbol: str, months: int) -> list[dict]:
    yf_sym = f"{symbol}.TW"
    end = datetime.today()
    start = end - timedelta(days=months * 31)
    try:
        ticker = yf.Ticker(yf_sym)
        df = ticker.history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"), interval="1d")
        if df is None or df.empty:
            return []
        results = []
        for ts, row in df.iterrows():
            results.append({
                "time": ts.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })
        return results
    except Exception:
        return []


def _fetch_quote(symbol: str) -> dict:
    yf_sym = f"{symbol}.TW"
    name = STOCK_NAMES.get(symbol, symbol)
    try:
        ticker = yf.Ticker(yf_sym)
        hist = ticker.history(period="2d")
        if hist.empty:
            raise ValueError("No data")

        last = hist.iloc[-1]
        prev = hist.iloc[-2] if len(hist) >= 2 else last

        price = round(float(last["Close"]), 2)
        prev_close = round(float(prev["Close"]), 2)
        change = round(price - prev_close, 2)
        change_pct = round(change / prev_close * 100, 2) if prev_close else 0.0

        return {
            "symbol": symbol,
            "name": name,
            "price": price,
            "change": change,
            "change_pct": change_pct,
            "volume": int(last["Volume"]),
            "high": round(float(last["High"]), 2),
            "low": round(float(last["Low"]), 2),
            "open": round(float(last["Open"]), 2),
        }
    except Exception:
        return {
            "symbol": symbol, "name": name,
            "price": 0.0, "change": 0.0, "change_pct": 0.0,
            "volume": 0, "high": 0.0, "low": 0.0, "open": 0.0,
        }


async def get_stock_history(symbol: str, months: int = 3) -> list[dict]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _fetch_history, symbol, months)


async def get_quote(symbol: str) -> dict:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _fetch_quote, symbol)
