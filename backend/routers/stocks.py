from fastapi import APIRouter, HTTPException, Query
from services.twse import get_stock_history, get_quote
from services.indicators import calc_ma, calc_rsi, calc_macd, calc_bollinger

router = APIRouter(prefix="/api/stocks", tags=["stocks"])


@router.get("/history/{symbol}")
async def stock_history(symbol: str, months: int = Query(default=3, ge=1, le=12)):
    """Return OHLCV history with technical indicators."""
    try:
        data = await get_stock_history(symbol, months=months)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch history: {e}")

    if not data:
        raise HTTPException(status_code=404, detail=f"No data found for {symbol}")

    closes = [d["close"] for d in data]

    ma5 = calc_ma(closes, 5)
    ma20 = calc_ma(closes, 20)
    ma60 = calc_ma(closes, 60)
    rsi = calc_rsi(closes, 14)
    macd_data = calc_macd(closes)
    bollinger = calc_bollinger(closes, 20)

    # Try to get stock name from quote cache or STOCK_NAMES
    from services.twse import STOCK_NAMES
    name = STOCK_NAMES.get(symbol, symbol)

    return {
        "symbol": symbol,
        "name": name,
        "data": data,
        "indicators": {
            "ma5": ma5,
            "ma20": ma20,
            "ma60": ma60,
            "rsi": rsi,
            "macd": macd_data,
            "bollinger": bollinger,
        },
    }


@router.get("/quote/{symbol}")
async def stock_quote(symbol: str):
    """Return real-time or latest quote for a stock."""
    try:
        quote = await get_quote(symbol)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch quote: {e}")
    return quote


@router.get("/batch-quotes")
async def batch_quotes(symbols: str = Query(..., description="Comma-separated stock symbols")):
    """Return quotes for multiple stocks."""
    import asyncio
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        raise HTTPException(status_code=400, detail="No symbols provided")

    tasks = [get_quote(sym) for sym in symbol_list]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    quotes = []
    for sym, result in zip(symbol_list, results):
        if isinstance(result, Exception):
            quotes.append({"symbol": sym, "name": sym, "price": 0.0, "change": 0.0,
                           "change_pct": 0.0, "volume": 0, "high": 0.0, "low": 0.0, "open": 0.0})
        else:
            quotes.append(result)
    return quotes
