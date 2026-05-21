from __future__ import annotations
import httpx
import logging
import os
import time
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

STOCK_NAMES: dict[str, str] = {
    "2330": "台積電", "2317": "鴻海", "2454": "聯發科", "2382": "廣達",
    "2881": "富邦金", "2882": "國泰金", "2886": "兆豐金", "2412": "中華電",
    "2308": "台達電", "2303": "聯電", "2891": "中信金", "1301": "台塑",
    "1303": "南亞", "2002": "中鋼", "2207": "和泰車",
}

FINMIND_URL = "https://api.finmindtrade.com/api/v4/data"

# Full history cache: symbol → (data, last_checked_ts)
# Incremental updates: only fetch from last known date forward
_full_history: dict[str, tuple[list[dict], float]] = {}
_quote_cache: dict[str, tuple[dict, float]] = {}

FRESHNESS = 300  # Re-check for new bars every 5 minutes


async def _fetch_rows(symbol: str, start: str, end: str) -> list[dict]:
    token = os.getenv("FINMIND_TOKEN", "")
    params: dict = {
        "dataset": "TaiwanStockPrice",
        "data_id": symbol,
        "start_date": start,
        "end_date": end,
    }
    if token:
        params["token"] = token
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(FINMIND_URL, params=params)
            resp.raise_for_status()
            body = resp.json()
            # FinMind returns status!=200 for quota exceeded
            if body.get("status") != 200:
                logger.warning("FinMind error %s: %s", body.get("status"), body.get("msg"))
                return []
            rows = body.get("data", [])
            return [
                {
                    "time":   r["date"],
                    "open":   float(r["open"]),
                    "high":   float(r["max"]),
                    "low":    float(r["min"]),
                    "close":  float(r["close"]),
                    "volume": int(r["Trading_Volume"]),
                }
                for r in rows
            ]
    except Exception as e:
        logger.error("_fetch_rows %s %s-%s failed: %s", symbol, start, end, e)
        return []


async def _ensure_full_history(symbol: str) -> list[dict]:
    """Fetch full history once; afterwards only fetch the incremental delta."""
    today = datetime.today().strftime("%Y-%m-%d")

    if symbol in _full_history:
        data, last_checked = _full_history[symbol]

        # Still fresh — return immediately, no API call
        if time.time() - last_checked < FRESHNESS:
            if data:  # only skip refetch if we actually have data
                return data
            # Empty cache that's still "fresh" — fall through to refetch

        # Stale with data: only fetch from last known date forward
        if data:
            last_date = data[-1]["time"]
            if last_date < today:
                delta = await _fetch_rows(symbol, last_date, today)
                if delta:
                    # Replace last bar (may update intraday) and append new bars
                    merged = [d for d in data if d["time"] < delta[0]["time"]] + delta
                    _full_history[symbol] = (merged, time.time())
                    return merged

            # No new data — update timestamp to avoid hammering API
            _full_history[symbol] = (data, time.time())
            return data
        # else: cached empty — fall through to full refetch

    # First time for this symbol: fetch up to 5 years (free tier friendly)
    five_years_ago = (datetime.today() - timedelta(days=5 * 365)).strftime("%Y-%m-%d")
    data = await _fetch_rows(symbol, five_years_ago, today)
    _full_history[symbol] = (data, time.time())
    return data


async def get_stock_history(symbol: str, months: int = 0) -> list[dict]:
    full = await _ensure_full_history(symbol)
    if not full or months == 0:
        return full
    # Trim to requested range without another API call
    cutoff = (datetime.today() - timedelta(days=months * 31)).strftime("%Y-%m-%d")
    return [d for d in full if d["time"] >= cutoff]


async def get_quote(symbol: str) -> dict:
    name = STOCK_NAMES.get(symbol, symbol)
    empty = {"symbol": symbol, "name": name,
             "price": 0.0, "change": 0.0, "change_pct": 0.0,
             "volume": 0, "high": 0.0, "low": 0.0, "open": 0.0}

    # Check quote cache
    if symbol in _quote_cache:
        cached, ts = _quote_cache[symbol]
        if time.time() - ts < FRESHNESS:
            return cached

    # Derive from full history cache — no extra API call
    if symbol in _full_history:
        data, _ = _full_history[symbol]
        if data:
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

    # No history cached yet — small direct fetch for quote only
    today = datetime.today().strftime("%Y-%m-%d")
    start = (datetime.today() - timedelta(days=7)).strftime("%Y-%m-%d")
    rows = await _fetch_rows(symbol, start, today)
    if not rows:
        return empty
    last = rows[-1]
    prev = rows[-2] if len(rows) >= 2 else last
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
