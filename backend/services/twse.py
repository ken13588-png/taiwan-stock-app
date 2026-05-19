from __future__ import annotations
import httpx
import time
from datetime import datetime, timedelta

STOCK_NAMES: dict[str, str] = {
    "2330": "台積電", "2317": "鴻海", "2454": "聯發科", "2382": "廣達",
    "2881": "富邦金", "2882": "國泰金", "2886": "兆豐金", "2412": "中華電",
    "2308": "台達電", "2303": "聯電", "2891": "中信金", "1301": "台塑",
    "1303": "南亞", "2002": "中鋼", "2207": "和泰車",
}

FINMIND_URL = "https://api.finmindtrade.com/api/v4/data"

# In-memory TTL cache: key → (data, fetched_at)
_history_cache: dict[str, tuple[list, float]] = {}
_quote_cache: dict[str, tuple[dict, float]] = {}

HISTORY_TTL = 3600   # 1 hour — daily data rarely changes intraday
QUOTE_TTL   = 300    # 5 minutes


def _make_quote_from_rows(symbol: str, rows: list[dict]) -> dict:
    name = STOCK_NAMES.get(symbol, symbol)
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


async def get_stock_history(symbol: str, months: int = 0) -> list[dict]:
    cache_key = f"{symbol}:{months}"
    if cache_key in _history_cache:
        cached, ts = _history_cache[cache_key]
        if time.time() - ts < HISTORY_TTL:
            return cached

    if months == 0:
        start = "1990-01-01"
    else:
        start = (datetime.today() - timedelta(days=months * 31)).strftime("%Y-%m-%d")
    end = datetime.today().strftime("%Y-%m-%d")

    params = {
        "dataset": "TaiwanStockPrice",
        "data_id": symbol,
        "start_date": start,
        "end_date": end,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(FINMIND_URL, params=params)
            resp.raise_for_status()
            rows = resp.json().get("data", [])
            data = [
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
            _history_cache[cache_key] = (data, time.time())
            return data
    except Exception:
        return []


async def get_quote(symbol: str) -> dict:
    name = STOCK_NAMES.get(symbol, symbol)
    empty = {"symbol": symbol, "name": name,
             "price": 0.0, "change": 0.0, "change_pct": 0.0,
             "volume": 0, "high": 0.0, "low": 0.0, "open": 0.0}

    # Check quote cache first
    if symbol in _quote_cache:
        cached, ts = _quote_cache[symbol]
        if time.time() - ts < QUOTE_TTL:
            return cached

    # Derive quote from history cache (all-time) if available — no extra API call
    for months_key in (0, 6, 3, 12, 36):
        ck = f"{symbol}:{months_key}"
        if ck in _history_cache:
            hist, ts = _history_cache[ck]
            if hist and time.time() - ts < HISTORY_TTL:
                # Re-parse raw rows not available here; build from history bars
                data = hist
                last = data[-1]
                prev = data[-2] if len(data) >= 2 else last
                price = float(last["close"])
                prev_close = float(prev["close"])
                change = round(price - prev_close, 2)
                change_pct = round(change / prev_close * 100, 2) if prev_close else 0.0
                quote = {
                    "symbol": symbol, "name": name,
                    "price": price, "change": change, "change_pct": change_pct,
                    "volume": int(last["volume"]),
                    "high": float(last["high"]), "low": float(last["low"]),
                    "open": float(last["open"]),
                }
                _quote_cache[symbol] = (quote, time.time())
                return quote

    # Fall back to direct FinMind request (small date range)
    start = (datetime.today() - timedelta(days=7)).strftime("%Y-%m-%d")
    end = datetime.today().strftime("%Y-%m-%d")
    params = {
        "dataset": "TaiwanStockPrice",
        "data_id": symbol,
        "start_date": start,
        "end_date": end,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(FINMIND_URL, params=params)
            resp.raise_for_status()
            rows = resp.json().get("data", [])
            if not rows:
                return empty
            quote = _make_quote_from_rows(symbol, rows)
            _quote_cache[symbol] = (quote, time.time())
            return quote
    except Exception:
        return empty
