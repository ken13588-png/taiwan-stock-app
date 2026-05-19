from fastapi import APIRouter, HTTPException
from services.twse import get_stock_history, STOCK_NAMES
from services.indicators import calc_ma, calc_rsi, calc_macd, calc_bollinger

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def analyze_trend(closes, ma5, ma20, ma60):
    """Determine trend from MA alignment."""
    if not all([closes, ma5, ma20]):
        return "無法判斷"

    last_close = closes[-1]
    last_ma5 = next((v for v in reversed(ma5) if v is not None), None)
    last_ma20 = next((v for v in reversed(ma20) if v is not None), None)
    last_ma60 = next((v for v in reversed(ma60) if v is not None), None) if ma60 else None

    if last_ma5 is None or last_ma20 is None:
        return "盤整"

    if last_ma5 > last_ma20 and last_close > last_ma5:
        if last_ma60 and last_ma20 > last_ma60:
            return "強勢上升"
        return "上升"
    elif last_ma5 < last_ma20 and last_close < last_ma5:
        if last_ma60 and last_ma20 < last_ma60:
            return "強勢下降"
        return "下降"
    else:
        return "盤整"


def detect_signals(closes, volumes, ma5, ma20, ma60, rsi_values, macd_data, bb_data):
    """Detect all technical signals."""
    signals = []

    if len(closes) < 3:
        return signals

    last_close = closes[-1]
    prev_close = closes[-2]

    # --- MA Crossover signals ---
    if len([v for v in ma5 if v is not None]) >= 2 and len([v for v in ma20 if v is not None]) >= 2:
        pairs = [(a, b) for a, b in zip(ma5[-10:], ma20[-10:]) if a is not None and b is not None]
        if len(pairs) >= 2:
            if pairs[-1][0] > pairs[-1][1] and pairs[-2][0] <= pairs[-2][1]:
                signals.append({"text": "MA5/MA20 黃金交叉", "type": "bullish"})
            elif pairs[-1][0] < pairs[-1][1] and pairs[-2][0] >= pairs[-2][1]:
                signals.append({"text": "MA5/MA20 死亡交叉", "type": "bearish"})

    if ma60:
        valid_ma60 = [v for v in ma60 if v is not None]
        if valid_ma60:
            last_ma60 = valid_ma60[-1]
            if last_close > last_ma60 and prev_close <= last_ma60:
                signals.append({"text": "突破 MA60 壓力", "type": "bullish"})
            elif last_close < last_ma60 and prev_close >= last_ma60:
                signals.append({"text": "跌破 MA60 支撐", "type": "bearish"})

    # --- RSI signals ---
    valid_rsi = [v for v in rsi_values if v is not None]
    if len(valid_rsi) >= 2:
        last_rsi = valid_rsi[-1]
        prev_rsi = valid_rsi[-2]
        if last_rsi >= 80:
            signals.append({"text": f"RSI 嚴重超買 ({last_rsi:.1f})", "type": "bearish"})
        elif last_rsi >= 70:
            signals.append({"text": f"RSI 超買 ({last_rsi:.1f})", "type": "bearish"})
        elif last_rsi <= 20:
            signals.append({"text": f"RSI 嚴重超賣 ({last_rsi:.1f})", "type": "bullish"})
        elif last_rsi <= 30:
            signals.append({"text": f"RSI 超賣 ({last_rsi:.1f})", "type": "bullish"})

        if prev_rsi < 50 <= last_rsi:
            signals.append({"text": "RSI 突破 50 中線", "type": "bullish"})
        elif prev_rsi > 50 >= last_rsi:
            signals.append({"text": "RSI 跌破 50 中線", "type": "bearish"})

    # --- MACD signals ---
    if macd_data:
        macd_line = macd_data.get("macd", [])
        signal_line = macd_data.get("signal", [])
        histogram = macd_data.get("histogram", [])

        valid_pairs = [(m, s) for m, s in zip(macd_line[-10:], signal_line[-10:])
                       if m is not None and s is not None]
        if len(valid_pairs) >= 2:
            if valid_pairs[-1][0] > valid_pairs[-1][1] and valid_pairs[-2][0] <= valid_pairs[-2][1]:
                label = "MACD 黃金交叉（零軸上）" if valid_pairs[-1][0] > 0 else "MACD 黃金交叉"
                signals.append({"text": label, "type": "bullish"})
            elif valid_pairs[-1][0] < valid_pairs[-1][1] and valid_pairs[-2][0] >= valid_pairs[-2][1]:
                signals.append({"text": "MACD 死亡交叉", "type": "bearish"})

        valid_hist = [h for h in histogram if h is not None]
        if len(valid_hist) >= 3:
            if valid_hist[-1] > 0 and valid_hist[-2] > 0 and valid_hist[-1] > valid_hist[-2]:
                signals.append({"text": "MACD 柱狀圖持續放大（多方動能）", "type": "bullish"})
            elif valid_hist[-1] < 0 and valid_hist[-2] < 0 and valid_hist[-1] < valid_hist[-2]:
                signals.append({"text": "MACD 柱狀圖持續縮小（空方動能）", "type": "bearish"})

    # --- Bollinger Band signals ---
    if bb_data:
        upper = bb_data.get("upper", [])
        lower = bb_data.get("lower", [])

        valid_upper = [v for v in upper if v is not None]
        valid_lower = [v for v in lower if v is not None]

        if valid_upper and valid_lower:
            last_upper = valid_upper[-1]
            last_lower = valid_lower[-1]

            if last_close > last_upper:
                signals.append({"text": "股價突破布林上軌", "type": "bearish"})
            elif last_close < last_lower:
                signals.append({"text": "股價跌破布林下軌（可能反彈）", "type": "bullish"})

            band_width = (last_upper - last_lower) / ((last_upper + last_lower) / 2) * 100
            if band_width < 3:
                signals.append({"text": "布林通道收縮（蓄勢待發）", "type": "neutral"})

    # --- Volume signals ---
    if len(volumes) >= 5:
        avg_vol = sum(volumes[-5:-1]) / 4
        last_vol = volumes[-1]
        if avg_vol > 0:
            if last_vol > avg_vol * 2 and last_close > prev_close:
                signals.append({"text": "大量上漲（主力介入）", "type": "bullish"})
            elif last_vol > avg_vol * 2 and last_close < prev_close:
                signals.append({"text": "大量下跌（出貨訊號）", "type": "bearish"})
            elif last_vol < avg_vol * 0.5:
                signals.append({"text": "成交量萎縮（觀望氣氛）", "type": "neutral"})

    # --- Price pattern signals ---
    if len(closes) >= 5:
        recent_high = max(closes[-5:])
        recent_low = min(closes[-5:])
        range_pct = (recent_high - recent_low) / recent_low * 100 if recent_low > 0 else 0

        if range_pct < 2:
            signals.append({"text": "股價橫盤整理中", "type": "neutral"})

    return signals


def generate_summary(trend, signals, last_close, ma20):
    """Generate Chinese text summary from rules."""
    bullish = [s for s in signals if s["type"] == "bullish"]
    bearish = [s for s in signals if s["type"] == "bearish"]
    neutral = [s for s in signals if s["type"] == "neutral"]

    trend_desc = {
        "強勢上升": "目前股價處於強勢上升趨勢，多頭排列明顯",
        "上升": "目前股價處於上升趨勢，短線偏多",
        "強勢下降": "目前股價處於強勢下降趨勢，空頭排列明顯",
        "下降": "目前股價處於下降趨勢，短線偏空",
        "盤整": "目前股價處於盤整格局，方向待明確",
        "無法判斷": "資料不足，無法判斷趨勢",
    }.get(trend, "趨勢不明")

    summary = trend_desc + "。"

    if bullish:
        summary += f"技術面出現 {len(bullish)} 個多頭訊號，包括{bullish[0]['text']}。"

    if bearish:
        summary += f"同時有 {len(bearish)} 個空頭訊號需注意，包括{bearish[0]['text']}。"

    if neutral:
        summary += f"另有 {len(neutral)} 個中性訊號供參考。"

    if not bullish and not bearish:
        summary += "目前無明確買賣訊號，建議持續觀察。"

    return summary


def get_recommendation(trend, signals):
    """Score-based recommendation."""
    score = 0

    trend_scores = {
        "強勢上升": 3,
        "上升": 2,
        "盤整": 0,
        "下降": -2,
        "強勢下降": -3,
        "無法判斷": 0,
    }
    score += trend_scores.get(trend, 0)

    for s in signals:
        if s["type"] == "bullish":
            score += 1
        elif s["type"] == "bearish":
            score -= 1

    if score >= 3:
        return "強力買入"
    elif score >= 1:
        return "買入"
    elif score <= -3:
        return "強力賣出"
    elif score <= -1:
        return "賣出"
    else:
        return "觀望"


@router.get("/{symbol}")
async def get_analysis(symbol: str):
    """Return rule-based technical analysis for a stock."""
    try:
        history = await get_stock_history(symbol, months=3)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch data: {e}")

    if not history:
        raise HTTPException(status_code=404, detail=f"No data found for {symbol}")

    closes = [d["close"] for d in history]
    volumes = [d.get("volume", 0) for d in history]
    name = STOCK_NAMES.get(symbol, symbol)

    ma5 = calc_ma(closes, 5)
    ma20 = calc_ma(closes, 20)
    ma60 = calc_ma(closes, 60)
    rsi_values = calc_rsi(closes, 14)
    macd_data = calc_macd(closes)
    bb_data = calc_bollinger(closes, 20)

    trend = analyze_trend(closes, ma5, ma20, ma60)
    signals = detect_signals(closes, volumes, ma5, ma20, ma60, rsi_values, macd_data, bb_data)
    summary = generate_summary(trend, signals, closes[-1] if closes else 0, ma20)
    recommendation = get_recommendation(trend, signals)

    valid_rsi = [v for v in rsi_values if v is not None]

    return {
        "symbol": symbol,
        "name": name,
        "trend": trend,
        "signals": signals,
        "summary": summary,
        "recommendation": recommendation,
        "score_data": {
            "rsi": round(valid_rsi[-1], 1) if valid_rsi else None,
            "bullish_count": len([s for s in signals if s["type"] == "bullish"]),
            "bearish_count": len([s for s in signals if s["type"] == "bearish"]),
        },
    }
