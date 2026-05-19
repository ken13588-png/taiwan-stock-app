from __future__ import annotations
import asyncio
import httpx
from datetime import datetime, timedelta

STOCK_NAMES: dict[str, str] = {
    "2330": "台積電", "2317": "鴻海", "2454": "聯發科", "2382": "廣達",
    "2881": "富邦金", "2882": "國泰金", "2886": "兆豐金", "2412": "中華電",
    "2308": "台達電", "2303": "聯電", "2891": "中信金", "1301": "台塑",
    "1303": "南亞", "2002": "中鋼", "2207": "和泰車",
}

FINMIND_URL = "https://api.finmindtrade.com/api/v4/data"


async def get_stock_history(symbol: str, months: int = 3) -> list[dict]:
    start = (datetime.today() - timedelta(days=months * 31)).strftime("%Y-%m-%d")
    end = datetime.today().strftime("%Y-%m-%d")
    params = {
        "dataset": "TaiwanStockPrice",
        "data_id": symbol,
        "start_date": start,
        "end_date": end,
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(FINMIND_URL, params=params)
            resp.raise_for_status()
            payload = resp.json()
            rows = payload.get("data", [])
            return [
                {
                    "time": r["date"],
                    "open": float(r["open"]),
                    "high": float(r["max"]),
                    "low": float(r["min"]),
                    "close": float(r["close"]),
                    "volume": int(r["Trading_Volume"]),
                }
                for r in rows
            ]
    except Exception:
        return []


async def get_quote(symbol: str) -> dict:
    name = STOCK_NAMES.get(symbol, symbol)
    start = (datetime.today() - timedelta(days=5)).strftime("%Y-%m-%d")
    end = datetime.today().strftime("%Y-%m-%d")
    params = {
        "dataset": "TaiwanStockPrice",
        "data_id": symbol,
        "start_date": start,
        "end_date": end,
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(FINMIND_URL, params=params)
            resp.raise_for_status()
            rows = resp.json().get("data", [])
            if not rows:
                raise ValueError("No data")
            last = rows[-1]
            prev = rows[-2] if len(rows) >= 2 else last
            price = float(last["close"])
            prev_close = float(prev["close"])
            change = round(price - prev_close, 2)
            change_pct = round(change / prev_close * 100, 2) if prev_close else 0.0
            return {
                "symbol": symbol, "name": name,
                "price": price, "change": change, "change_pct": change_pct,
                "volume": int(last["Trading_Volume"]),
                "high": float(last["max"]), "low": float(last["min"]),
                "open": float(last["open"]),
            }
    except Exception:
        return {
            "symbol": symbol, "name": name,
            "price": 0.0, "change": 0.0, "change_pct": 0.0,
            "volume": 0, "high": 0.0, "low": 0.0, "open": 0.0,
        }
