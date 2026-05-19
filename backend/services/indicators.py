from __future__ import annotations
import math


def calc_ma(closes: list[float], period: int) -> list[float | None]:
    """Calculate Simple Moving Average. Returns None for positions with insufficient data."""
    result: list[float | None] = []
    for i in range(len(closes)):
        if i < period - 1:
            result.append(None)
        else:
            window = closes[i - period + 1 : i + 1]
            result.append(round(sum(window) / period, 2))
    return result


def calc_rsi(closes: list[float], period: int = 14) -> list[float | None]:
    """Calculate Relative Strength Index using Wilder's smoothing method."""
    result: list[float | None] = [None] * len(closes)
    if len(closes) < period + 1:
        return result

    # Initial average gain/loss over first period
    gains = []
    losses = []
    for i in range(1, period + 1):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))

    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period

    for i in range(period, len(closes)):
        if i == period:
            # First RSI value
            if avg_loss == 0:
                result[i] = 100.0
            else:
                rs = avg_gain / avg_loss
                result[i] = round(100 - (100 / (1 + rs)), 2)
        else:
            diff = closes[i] - closes[i - 1]
            gain = max(diff, 0)
            loss = max(-diff, 0)
            avg_gain = (avg_gain * (period - 1) + gain) / period
            avg_loss = (avg_loss * (period - 1) + loss) / period
            if avg_loss == 0:
                result[i] = 100.0
            else:
                rs = avg_gain / avg_loss
                result[i] = round(100 - (100 / (1 + rs)), 2)

    return result


def calc_ema(closes: list[float], period: int) -> list[float | None]:
    """Calculate Exponential Moving Average."""
    result: list[float | None] = [None] * len(closes)
    if len(closes) < period:
        return result
    multiplier = 2 / (period + 1)
    # Seed with SMA for first period
    seed = sum(closes[:period]) / period
    result[period - 1] = round(seed, 4)
    for i in range(period, len(closes)):
        prev = result[i - 1]
        ema = closes[i] * multiplier + prev * (1 - multiplier)
        result[i] = round(ema, 4)
    return result


def calc_macd(
    closes: list[float], fast: int = 12, slow: int = 26, signal: int = 9
) -> dict:
    """Calculate MACD, signal line, and histogram."""
    ema_fast = calc_ema(closes, fast)
    ema_slow = calc_ema(closes, slow)

    macd_line: list[float | None] = []
    for f, s in zip(ema_fast, ema_slow):
        if f is None or s is None:
            macd_line.append(None)
        else:
            macd_line.append(round(f - s, 4))

    # Calculate signal line (EMA of MACD) — only over non-None values
    # We need positional signal line
    # Extract only valid macd values with their indices
    valid_indices = [i for i, v in enumerate(macd_line) if v is not None]
    valid_macd = [macd_line[i] for i in valid_indices]
    valid_ema = calc_ema(valid_macd, signal)

    # Map back to full-length arrays
    signal_line: list[float | None] = [None] * len(closes)
    histogram: list[float | None] = [None] * len(closes)
    for j, orig_idx in enumerate(valid_indices):
        if valid_ema[j] is not None:
            signal_line[orig_idx] = valid_ema[j]
            if macd_line[orig_idx] is not None:
                histogram[orig_idx] = round(macd_line[orig_idx] - valid_ema[j], 4)

    return {
        "macd": macd_line,
        "signal": signal_line,
        "histogram": histogram,
    }


def calc_bollinger(
    closes: list[float], period: int = 20, num_std: float = 2.0
) -> dict:
    """Calculate Bollinger Bands: upper, middle (SMA), lower."""
    middle = calc_ma(closes, period)
    upper: list[float | None] = []
    lower: list[float | None] = []

    for i in range(len(closes)):
        if i < period - 1:
            upper.append(None)
            lower.append(None)
        else:
            window = closes[i - period + 1 : i + 1]
            mean = sum(window) / period
            variance = sum((x - mean) ** 2 for x in window) / period
            std = math.sqrt(variance)
            upper.append(round(mean + num_std * std, 2))
            lower.append(round(mean - num_std * std, 2))

    return {"upper": upper, "middle": middle, "lower": lower}
