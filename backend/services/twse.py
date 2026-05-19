import httpx
import asyncio
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import re


def roc_to_ad_date(roc_date_str: str) -> str:
    """Convert ROC calendar date string (e.g. '113/01/15') to AD date string (e.g. '2024-01-15')"""
    parts = roc_date_str.strip().replace("/", "-").split("-")
    if len(parts) != 3:
        return None
    roc_year = int(parts[0])
    month = int(parts[1])
    day = int(parts[2])
    ad_year = roc_year + 1911
    return f"{ad_year:04d}-{month:02d}-{day:02d}"


def parse_price(price_str: str) -> float | None:
    """Parse a price string that may contain commas."""
    if not price_str or price_str.strip() in ("--", "", "X", "N/A"):
        return None
    try:
        return float(price_str.replace(",", "").strip())
    except ValueError:
        return None


async def get_stock_history(symbol: str, months: int = 3) -> list[dict]:
    """Fetch last N months of daily OHLCV data from TWSE."""
    results = []
    today = datetime.today()

    async with httpx.AsyncClient(timeout=20.0) as client:
        for i in range(months, 0, -1):
            # Go back i months from now
            target_date = today - relativedelta(months=i - 1)
            # Use first day of that month
            date_str = target_date.strftime("%Y%m01")
            url = (
                f"https://www.twse.com.tw/exchangeReport/STOCK_DAY"
                f"?response=json&date={date_str}&stockNo={symbol}"
            )
            try:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if resp.status_code != 200:
                    continue
                payload = resp.json()
                if payload.get("stat") not in ("OK", "ok"):
                    continue
                rows = payload.get("data", [])
                # Row format: [date, volume, turnover, open, high, low, close, price_diff, transactions]
                for row in rows:
                    if len(row) < 7:
                        continue
                    roc_date = row[0]
                    ad_date = roc_to_ad_date(roc_date)
                    if not ad_date:
                        continue
                    open_p = parse_price(row[3])
                    high_p = parse_price(row[4])
                    low_p = parse_price(row[5])
                    close_p = parse_price(row[6])
                    volume = parse_price(row[1])
                    if None in (open_p, high_p, low_p, close_p, volume):
                        continue
                    results.append(
                        {
                            "time": ad_date,
                            "open": open_p,
                            "high": high_p,
                            "low": low_p,
                            "close": close_p,
                            "volume": int(volume),
                        }
                    )
            except Exception:
                continue

    # Sort by date ascending and deduplicate
    seen = set()
    unique = []
    for item in sorted(results, key=lambda x: x["time"]):
        if item["time"] not in seen:
            seen.add(item["time"])
            unique.append(item)
    return unique


# Map of common Taiwan stock symbols to names
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


async def get_quote(symbol: str) -> dict:
    """Fetch real-time quote for a stock."""
    url = f"https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_{symbol}.tw&json=1&delay=0"
    name = STOCK_NAMES.get(symbol, symbol)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code != 200:
                raise ValueError(f"HTTP {resp.status_code}")
            payload = resp.json()
            msg_array = payload.get("msgArray", [])
            if not msg_array:
                raise ValueError("Empty msgArray")
            stock = msg_array[0]

            # Extract fields
            name = stock.get("n", name)
            z = parse_price(stock.get("z", ""))  # current price (latest transaction)
            o = parse_price(stock.get("o", ""))  # open
            h = parse_price(stock.get("h", ""))  # high
            l = parse_price(stock.get("l", ""))  # low
            y = parse_price(stock.get("y", ""))  # yesterday close
            v = parse_price(stock.get("v", ""))  # volume (in lots)

            # If real-time price not available, fall back to yesterday's close
            price = z if z is not None else y
            yesterday = y if y is not None else price

            change = round(price - yesterday, 2) if (price and yesterday) else 0.0
            change_pct = round(change / yesterday * 100, 2) if yesterday else 0.0

            return {
                "symbol": symbol,
                "name": name,
                "price": price or 0.0,
                "change": change,
                "change_pct": change_pct,
                "volume": int(v * 1000) if v else 0,
                "high": h or 0.0,
                "low": l or 0.0,
                "open": o or 0.0,
            }
    except Exception:
        # Fall back to last close from history
        try:
            history = await get_stock_history(symbol, months=1)
            if history:
                last = history[-1]
                prev_close = history[-2]["close"] if len(history) >= 2 else last["close"]
                change = round(last["close"] - prev_close, 2)
                change_pct = round(change / prev_close * 100, 2) if prev_close else 0.0
                return {
                    "symbol": symbol,
                    "name": name,
                    "price": last["close"],
                    "change": change,
                    "change_pct": change_pct,
                    "volume": last["volume"],
                    "high": last["high"],
                    "low": last["low"],
                    "open": last["open"],
                }
        except Exception:
            pass

        return {
            "symbol": symbol,
            "name": name,
            "price": 0.0,
            "change": 0.0,
            "change_pct": 0.0,
            "volume": 0,
            "high": 0.0,
            "low": 0.0,
            "open": 0.0,
        }
