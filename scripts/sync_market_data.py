"""Fetch public Vietnam OHLCV data, calculate indicators, and upsert Supabase.

Vnstock prices are normalized in thousand VND in the v4 community API. The
default multiplier converts them to VND before persistence. Override with
VNSTOCK_PRICE_MULTIPLIER if the upstream source changes its unit contract.
"""

from __future__ import annotations

import json
import math
import os
import sys
import time
from datetime import date, timedelta
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pandas as pd
from vnstock import Listing, Market


STOCKS: dict[str, tuple[str, str, str]] = {
    "VCB": ("Vietcombank", "Financials", "HOSE"),
    "SSI": ("SSI Securities", "Financials", "HOSE"),
    "HPG": ("Hoa Phat Group", "Materials", "HOSE"),
    "FPT": ("FPT Corporation", "Technology", "HOSE"),
    "VHM": ("Vinhomes", "Real Estate", "HOSE"),
    "VIC": ("Vingroup", "Real Estate", "HOSE"),
    "VND": ("VNDIRECT Securities", "Financials", "HOSE"),
    "MWG": ("Mobile World", "Retail", "HOSE"),
    "DGC": ("Duc Giang Chemicals", "Materials", "HOSE"),
    "VPB": ("VPBank", "Financials", "HOSE"),
    "VNM": ("Vinamilk", "Consumer", "HOSE"),
    "MBB": ("MB Bank", "Financials", "HOSE"),
}


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value.rstrip("/")


def finite(value: Any) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"Non-finite indicator value: {value}")
    return number


class SupabaseRest:
    def __init__(self) -> None:
        self.url = required_env("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not self.key:
            raise RuntimeError("Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY")

    def upsert(self, table: str, rows: list[dict[str, Any]], conflict: str) -> None:
        if not rows:
            return
        query = urlencode({"on_conflict": conflict})
        payload = json.dumps(rows, allow_nan=False).encode("utf-8")
        max_attempts = int(os.getenv("SUPABASE_HTTP_MAX_ATTEMPTS", "4"))
        retry_delay = float(os.getenv("SUPABASE_HTTP_RETRY_DELAY_SECONDS", "1.5"))
        for attempt in range(1, max_attempts + 1):
            request = Request(
                f"{self.url}/rest/v1/{table}?{query}",
                data=payload,
                method="POST",
                headers={
                    "apikey": self.key,
                    "Authorization": f"Bearer {self.key}",
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates,return=minimal",
                },
            )
            try:
                with urlopen(request, timeout=60) as response:
                    if response.status not in (200, 201, 204):
                        raise RuntimeError(f"Supabase returned HTTP {response.status} for {table}")
                return
            except HTTPError as error:
                detail = error.read().decode("utf-8", errors="replace")
                if error.code not in (408, 429, 500, 502, 503, 504) or attempt == max_attempts:
                    raise RuntimeError(f"Supabase upsert failed for {table}: HTTP {error.code} {detail}") from error
                last_error: Exception = error
            except (URLError, TimeoutError, ConnectionError) as error:
                if attempt == max_attempts:
                    raise RuntimeError(f"Supabase upsert failed for {table} after {max_attempts} attempts: {error}") from error
                last_error = error
            print(f"Retrying Supabase {table} upsert after attempt {attempt}: {last_error}", file=sys.stderr, flush=True)
            time.sleep(retry_delay * (2 ** (attempt - 1)))


def calculate_indicators(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.sort_values("date").copy()
    result["sma20"] = result["close"].rolling(20).mean()
    result["sma50"] = result["close"].rolling(50).mean()
    result["ema20"] = result["close"].ewm(span=20, adjust=False).mean()
    result["ema50"] = result["close"].ewm(span=50, adjust=False).mean()
    delta = result["close"].diff()
    average_gain = delta.clip(lower=0).rolling(14).mean()
    average_loss = (-delta.clip(upper=0)).rolling(14).mean()
    relative_strength = average_gain / average_loss.replace(0, float("nan"))
    result["rsi14"] = (100 - (100 / (1 + relative_strength))).fillna(100)
    previous_close = result["close"].shift(1)
    true_range = pd.concat([
        result["high"] - result["low"],
        (result["high"] - previous_close).abs(),
        (result["low"] - previous_close).abs(),
    ], axis=1).max(axis=1)
    result["atr14"] = true_range.rolling(14).mean()
    result["volume_ma20"] = result["volume"].rolling(20).mean()
    result["relative_volume"] = result["volume"] / result["volume_ma20"].replace(0, float("nan"))
    return result


def fetch_ohlcv(symbol: str, start: str, end: str, multiplier: float) -> pd.DataFrame:
    raw = Market().equity(symbol).ohlcv(start=start, end=end, interval="1D")
    if raw is None or raw.empty:
        raise RuntimeError("Vnstock returned no OHLCV rows")
    raw = raw.rename(columns={column: str(column).lower() for column in raw.columns})
    date_column = "time" if "time" in raw.columns else "date"
    required = {date_column, "open", "high", "low", "close", "volume"}
    missing = required.difference(raw.columns)
    if missing:
        raise RuntimeError(f"Vnstock response is missing columns: {sorted(missing)}")
    frame = raw[[date_column, "open", "high", "low", "close", "volume"]].copy()
    frame = frame.rename(columns={date_column: "date"})
    frame["date"] = pd.to_datetime(frame["date"]).dt.date
    for column in ("open", "high", "low", "close"):
        frame[column] = pd.to_numeric(frame[column], errors="coerce") * multiplier
    frame["volume"] = pd.to_numeric(frame["volume"], errors="coerce")
    frame = frame.dropna().drop_duplicates(subset=["date"], keep="last")
    if len(frame) < 50:
        raise RuntimeError(f"Only {len(frame)} valid sessions returned; at least 50 are required")
    return calculate_indicators(frame)


def direction(condition: bool) -> str:
    return "supporting" if condition else "contradicting"


def extend_stock_metadata(symbols: list[str]) -> None:
    unknown = [symbol for symbol in symbols if symbol not in STOCKS]
    if not unknown:
        return
    frame = Listing(source=os.getenv("VNSTOCK_SOURCE", "KBS")).all_symbols()
    lowered = {str(column).lower(): str(column) for column in frame.columns}
    symbol_column = next((lowered[name] for name in ("symbol", "ticker", "code") if name in lowered), None)
    company_column = next((lowered[name] for name in ("organ_name", "company_name", "name", "organname") if name in lowered), None)
    exchange_column = next((lowered[name] for name in ("exchange", "comgroupcode", "exchange_code") if name in lowered), None)
    sector_column = next((lowered[name] for name in ("icb_name3", "industry", "sector", "icb_name2") if name in lowered), None)
    if not symbol_column or not exchange_column:
        raise RuntimeError(f"VNStock listing response changed; columns={list(frame.columns)}")
    wanted = set(unknown)
    for record in frame.to_dict("records"):
        symbol = str(record.get(symbol_column, "")).strip().upper()
        if symbol not in wanted:
            continue
        exchange = str(record.get(exchange_column, "")).strip().upper().replace("HSX", "HOSE")
        if exchange not in {"HOSE", "HNX", "UPCOM"}:
            continue
        STOCKS[symbol] = (
            str(record.get(company_column) or symbol).strip(),
            str(record.get(sector_column) or "Unclassified").strip(),
            exchange,
        )


def sync_symbol(client: SupabaseRest, symbol: str, metadata: tuple[str, str, str], start: str, end: str, multiplier: float) -> int:
    company, sector, exchange = metadata
    client.upsert("stocks", [{"symbol": symbol, "company_name": company, "sector": sector, "exchange": exchange, "updated_at": f"{date.today().isoformat()}T00:00:00Z"}], "symbol")
    frame = fetch_ohlcv(symbol, start, end, multiplier)
    price_rows = [{
        "symbol": symbol,
        "date": row.date.isoformat(),
        "open": finite(row.open),
        "high": finite(row.high),
        "low": finite(row.low),
        "close": finite(row.close),
        "volume": int(row.volume),
    } for row in frame.itertuples()]
    for index in range(0, len(price_rows), 250):
        client.upsert("price_history", price_rows[index:index + 250], "symbol,date")

    latest = frame.iloc[-1]
    latest_date = latest["date"].isoformat()
    signals = [
        ("sma20", latest["sma20"], latest["close"] > latest["sma20"]),
        ("sma50", latest["sma50"], latest["close"] > latest["sma50"]),
        ("ema20", latest["ema20"], latest["close"] > latest["ema20"]),
        ("ema50", latest["ema50"], latest["close"] > latest["ema50"]),
        ("rsi14", latest["rsi14"], 50 <= latest["rsi14"] <= 70),
        ("atr14", latest["atr14"], latest["atr14"] / latest["close"] <= 0.04),
        ("volume_ma20", latest["volume_ma20"], latest["volume"] >= latest["volume_ma20"]),
        ("relative_volume", latest["relative_volume"], latest["relative_volume"] >= 1),
    ]
    evidence_rows = [{
        "symbol": symbol,
        "date": latest_date,
        "signal_name": name,
        "signal_value": finite(value),
        "signal_direction": direction(bool(is_supporting)),
        "source": "vnstock-community-v4/rule-based-indicators",
    } for name, value, is_supporting in signals]
    client.upsert("evidence_snapshots", evidence_rows, "symbol,date,signal_name")

    if latest["close"] > latest["ema20"] > latest["ema50"]:
        bias, label = "bullish", "Bullish trend"
    elif latest["close"] < latest["ema20"] < latest["ema50"]:
        bias, label = "bearish", "Bearish trend"
    else:
        bias, label = "neutral", "Mixed trend"
    summary = (
        f"Temporary rule-based synthesis: {symbol} is {bias}. "
        f"Close is {finite(latest['close']):,.0f} VND, EMA20 is {finite(latest['ema20']):,.0f} "
        f"and EMA50 is {finite(latest['ema50']):,.0f}. This is not LLM-generated advice."
    )
    client.upsert("agent_analysis", [{
        "symbol": symbol,
        "analysis_date": latest_date,
        "bias": bias,
        "bias_label": label,
        "summary_text": summary,
        "key_levels_json": {
            "latest_close": round(finite(latest["close"]), 2),
            "sma20": round(finite(latest["sma20"]), 2),
            "sma50": round(finite(latest["sma50"]), 2),
            "atr14": round(finite(latest["atr14"]), 2),
        },
        "watch_for_text": "Re-evaluate when the close crosses EMA20 or the EMA20/EMA50 ordering changes.",
    }], "symbol,analysis_date")
    return len(price_rows)


def main() -> int:
    client = SupabaseRest()
    end_date = date.today()
    start_date = end_date - timedelta(days=int(os.getenv("MARKET_LOOKBACK_DAYS", "240")))
    multiplier = float(os.getenv("VNSTOCK_PRICE_MULTIPLIER", "1000"))
    requested_value = os.getenv("MARKET_SYMBOLS", "").strip() or ",".join(STOCKS)
    requested = [item.strip().upper() for item in requested_value.split(",") if item.strip()]
    extend_stock_metadata(requested)
    unknown = [symbol for symbol in requested if symbol not in STOCKS]
    if unknown:
        raise RuntimeError(f"Unknown symbols in MARKET_SYMBOLS: {', '.join(unknown)}")

    failures: list[str] = []
    for index, symbol in enumerate(requested):
        try:
            rows = sync_symbol(client, symbol, STOCKS[symbol], start_date.isoformat(), end_date.isoformat(), multiplier)
            print(f"Synced {symbol}: {rows} OHLCV sessions", flush=True)
        except Exception as error:  # Keep the batch going and report every upstream limitation.
            failures.append(f"{symbol}: {error}")
            print(f"Failed {symbol}: {error}", file=sys.stderr, flush=True)
        if index < len(requested) - 1:
            time.sleep(float(os.getenv("VNSTOCK_REQUEST_DELAY_SECONDS", "3.2")))
    if failures:
        print("Market sync completed with failures:\n" + "\n".join(failures), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
