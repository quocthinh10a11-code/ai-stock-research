"""Build the cached ICB sector screener from free VNStock community data.

Full mode refreshes classification, OHLCV liquidity and financial ratios.
Intraday mode only refreshes batch price-board values and re-scores cached rows.
No LLM decides the ranking; AI web research is added later as an explanation layer.
"""
from __future__ import annotations

import json
import math
import os
import re
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from vnstock import Fundamental, Listing, Market, Trading
from vnstock.core import setup_api_key

try:
    from .sync_market_data import SupabaseRest
except ImportError:
    from sync_market_data import SupabaseRest


ROOT = Path(__file__).resolve().parents[1]
TAXONOMY = json.loads((ROOT / "data" / "icb-sector-taxonomy.json").read_text(encoding="utf-8"))
GROUP_BY_CODE = {
    str(code): sector["name"]
    for sector in TAXONOMY
    for code in sector["codes"]
}
VALID_EXCHANGES = {"HOSE", "HNX"}
FUNDAMENTAL_FIELDS = (
    "financial_period", "pe", "pb", "roe", "revenue_growth", "profit_growth", "debt_to_equity",
    "gross_margin", "current_ratio", "inventory_turnover", "dividend_yield", "nim", "npl", "llcr",
)
NON_EQUITY_MARKERS = {
    "ETF": "etf",
    "EXCHANGE TRADED FUND": "etf",
    "CHỨNG CHỈ QUỸ": "fund",
    "CHUNG CHI QUY": "fund",
    "FUND": "fund",
    "WARRANT": "warrant",
    "CHỨNG QUYỀN": "warrant",
    "CHUNG QUYEN": "warrant",
    "BOND": "bond",
    "TRÁI PHIẾU": "bond",
    "TRAI PHIEU": "bond",
}


def number(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def normalize_exchange(value: Any) -> str:
    return str(value or "").strip().upper().replace("HSX", "HOSE")


def normalize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    result.columns = [
        "_".join(str(part) for part in column if str(part)) if isinstance(column, tuple) else str(column)
        for column in result.columns
    ]
    return result


def classify_instrument(record: dict[str, Any], company_column: str | None = None) -> str:
    symbol = str(record.get("symbol") or "").strip().upper()
    fields = [str(record.get(name) or "").strip().upper() for name in (
        "security_type", "instrument_type", "listing_type", "type", "asset_type",
    )]
    if company_column:
        fields.append(str(record.get(company_column) or "").strip().upper())
    combined = " | ".join(fields)
    for marker, instrument_type in NON_EQUITY_MARKERS.items():
        if marker in combined:
            return instrument_type
    if re.match(r"^(E1|FUE|FUO|FUC)[A-Z0-9]+$", symbol):
        return "etf"
    return "equity"


def exclusion(item: dict[str, Any], as_of: str, phase: str, reason_code: str, reason_detail: str, instrument_type: str = "equity") -> dict[str, Any]:
    return {
        "symbol": str(item.get("symbol") or "").strip().upper(),
        "snapshot_date": date.today().isoformat(),
        "company_name": str(item.get("company_name") or item.get("symbol") or "").strip() or None,
        "exchange": normalize_exchange(item.get("exchange")) or None,
        "sector_group": item.get("sector_group"),
        "instrument_type": instrument_type,
        "phase": phase,
        "reason_code": reason_code,
        "reason_detail": reason_detail[:500],
        "provider_timestamp": as_of,
        "fetched_at": as_of,
        "source_name": "vnstock-community-v4/vci-kbs",
        "data_quality": "observed",
    }


def dedupe_exclusions(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep one row per database conflict key before a bulk upsert."""
    unique: dict[tuple[str, str, str], dict[str, Any]] = {}
    for row in rows:
        key = (
            str(row.get("symbol") or ""),
            str(row.get("snapshot_date") or ""),
            str(row.get("reason_code") or ""),
        )
        unique[key] = row
    return list(unique.values())


def load_universe_with_exclusions(as_of: str) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
    exchange_frames: list[pd.DataFrame] = []
    listing = Listing(source=os.getenv("VNSTOCK_LISTING_SOURCE", "KBS"))
    for exchange in ("HOSE", "HNX"):
        frame = listing.symbols_by_exchange(exchange=exchange).copy()
        if frame.empty:
            continue
        frame["exchange"] = exchange
        exchange_frames.append(frame)
    if not exchange_frames:
        raise RuntimeError("VNStock returned no HOSE/HNX listings")
    exchanges = pd.concat(exchange_frames, ignore_index=True)
    exchanges.columns = [str(column).lower() for column in exchanges.columns]
    company_column = next((name for name in ("organ_name", "company_name", "name") if name in exchanges.columns), None)
    if not company_column:
        raise RuntimeError(f"VNStock listing response changed; columns={list(exchanges.columns)}")

    excluded: list[dict[str, Any]] = []
    equity_records: list[dict[str, Any]] = []
    for record in exchanges.to_dict("records"):
        symbol = str(record.get("symbol") or "").strip().upper()
        exchange = normalize_exchange(record.get("exchange"))
        if not re.fullmatch(r"[A-Z0-9]{2,10}", symbol) or exchange not in VALID_EXCHANGES:
            continue
        normalized = {**record, "symbol": symbol, "exchange": exchange, "company_name": str(record.get(company_column) or symbol).strip()}
        instrument_type = classify_instrument(normalized, company_column)
        if instrument_type != "equity":
            excluded.append(exclusion(normalized, as_of, "universe", "instrument_not_equity", "Không phải cổ phiếu doanh nghiệp", instrument_type))
            continue
        equity_records.append(normalized)
    equities = pd.DataFrame(equity_records)
    if equities.empty:
        raise RuntimeError("VNStock returned no classified HOSE/HNX equities")

    industries = Listing(source="VCI").symbols_by_industries().copy()
    industries.columns = [str(column).lower() for column in industries.columns]
    required = {"symbol", "icb_level", "icb_code", "icb_name"}
    if not required.issubset(industries.columns):
        raise RuntimeError(f"VNStock ICB response changed; columns={list(industries.columns)}")
    industries = industries[industries["icb_level"].astype(str) == "2"].copy()
    industries["icb_code"] = industries["icb_code"].astype(str).str.zfill(4)
    industries = industries[industries["icb_code"].isin(GROUP_BY_CODE)].drop_duplicates("symbol")

    merged = equities.merge(
        industries[["symbol", "icb_code", "icb_name"]],
        on="symbol",
        how="left",
    )
    rows: list[dict[str, str]] = []
    for record in merged.to_dict("records"):
        symbol = str(record["symbol"]).strip().upper()
        exchange = normalize_exchange(record["exchange"])
        raw_code = record.get("icb_code")
        code = "" if pd.isna(raw_code) else str(raw_code).zfill(4)
        if not re.fullmatch(r"[A-Z0-9]{2,10}", symbol) or exchange not in VALID_EXCHANGES:
            continue
        company_name = str(record.get("company_name") or symbol).strip()
        if code not in GROUP_BY_CODE:
            excluded.append(exclusion({"symbol": symbol, "company_name": company_name, "exchange": exchange}, as_of, "universe", "missing_icb_taxonomy", "Thiếu phân loại ICB cấp 2 được hỗ trợ"))
            continue
        rows.append({
            "symbol": symbol,
            "company_name": company_name,
            "exchange": exchange,
            "icb_level2_code": code,
            "icb_level2_name": str(record["icb_name"]).strip(),
            "sector_group": GROUP_BY_CODE[code],
        })
    return list({row["symbol"]: row for row in rows}.values()), excluded


def load_universe() -> list[dict[str, str]]:
    return load_universe_with_exclusions(datetime.now(timezone.utc).isoformat())[0]


def fetch_price_board(symbols: list[str]) -> dict[str, dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    chunk_size = int(os.getenv("SCREENER_BOARD_CHUNK_SIZE", "100"))
    delay = float(os.getenv("SCREENER_BOARD_DELAY_SECONDS", "1.2"))
    for offset in range(0, len(symbols), chunk_size):
        chunk = symbols[offset:offset + chunk_size]
        frame = normalize_columns(Trading(source="VCI").price_board(chunk))
        for record in frame.to_dict("records"):
            symbol = str(record.get("listing_symbol") or "").strip().upper()
            price = number(record.get("match_match_price")) or number(record.get("listing_ref_price"))
            reference = number(record.get("listing_ref_price"))
            shares = number(record.get("listing_listed_share"))
            if not symbol or price is None:
                continue
            rows[symbol] = {
                "price": price,
                "change_pct": ((price - reference) / reference * 100) if reference else 0,
                "market_cap": price * shares if shares else None,
                "trading_status": str(record.get("listing_trading_status") or ""),
                "security_status": str(record.get("listing_security_status") or ""),
            }
        if offset + chunk_size < len(symbols):
            time.sleep(delay)
    return rows


def latest_ratio_metrics(symbol: str) -> dict[str, float | str | None]:
    frame = Fundamental().equity(symbol).ratio(period="quarter")
    if frame is None or frame.empty or "item_id" not in frame.columns:
        raise RuntimeError("empty financial ratio response")
    period_columns = [
        str(column) for column in frame.columns
        if re.match(r"^20\d{2}-Q[1-4]", str(column))
    ]
    if not period_columns:
        raise RuntimeError(f"financial ratio periods changed; columns={list(frame.columns)}")
    period_columns.sort(
        key=lambda value: tuple(int(part) for part in re.match(r"^(20\d{2})-Q([1-4])", value).groups()),
        reverse=True,
    )
    period = period_columns[0]

    def metric(*keys: str) -> float | None:
        for key in keys:
            matches = frame.loc[frame["item_id"].astype(str) == key, period]
            if not matches.empty:
                value = number(matches.iloc[0])
                if value is not None:
                    return value
        return None

    debt_percent = metric("debt_to_equity")
    dividend_ratio = metric("dividend_yield")
    nim_quarter = metric("net_interest_margin_nim")
    return {
        "financial_period": re.sub(r"_\d+$", "", period),
        "pe": metric("pe_ratio"),
        "pb": metric("pb_ratio"),
        "roe": metric("roe_trailling", "roe"),
        "revenue_growth": metric("net_revenue", "net_interest_income"),
        "profit_growth": metric("profit_after_tax_for_shareholders_of_the_parent_company", "profit_before_tax"),
        "debt_to_equity": debt_percent / 100 if debt_percent is not None else None,
        "gross_margin": metric("gross_margin"),
        "current_ratio": metric("short_term_ratio"),
        "inventory_turnover": metric("inventory_turnover"),
        "dividend_yield": dividend_ratio * 100 if dividend_ratio is not None and abs(dividend_ratio) <= 1 else dividend_ratio,
        "nim": nim_quarter * 4 if nim_quarter is not None else None,
        "npl": None,
        "llcr": None,
    }


def reusable_fundamentals(cached: dict[str, Any] | None, now: datetime, max_age_days: int) -> dict[str, Any] | None:
    if not cached or not cached.get("financial_period") or not cached.get("fundamentals_fetched_at"):
        return None
    try:
        fetched = datetime.fromisoformat(str(cached["fundamentals_fetched_at"]).replace("Z", "+00:00"))
    except ValueError:
        return None
    if fetched.tzinfo is None:
        fetched = fetched.replace(tzinfo=timezone.utc)
    if now - fetched > timedelta(days=max_age_days):
        return None
    return {field: cached.get(field) for field in FUNDAMENTAL_FIELDS}


def average_volume20(symbol: str) -> float:
    end = date.today()
    start = end - timedelta(days=90)
    frame = Market().equity(symbol).ohlcv(start=start.isoformat(), end=end.isoformat(), interval="1D")
    if frame is None or frame.empty or "volume" not in frame.columns:
        raise RuntimeError("empty OHLCV response")
    values = pd.to_numeric(frame["volume"], errors="coerce").dropna().tail(20)
    if len(values) < 15:
        raise RuntimeError(f"only {len(values)} recent volume sessions")
    return float(values.mean())


def criterion(key: str, label: str, value: float | str | None, target: str, passed: bool | None, weight: int) -> dict[str, Any]:
    return {"key": key, "label": label, "value": value, "target": target, "passed": passed, "weight": weight}


def score_row(row: dict[str, Any], inventory_median: float | None = None) -> dict[str, Any]:
    industry = str(row.get("industry") or "")
    group = str(row.get("sector_group") or "")
    status_ok = row.get("trading_status") == "TRADING_ACTIVATED" and row.get("security_status") in ("", "N")
    debt_limit = 3.0 if group in {"Bất động sản & Xây dựng", "Dầu khí & Năng lượng", "Vật liệu cơ bản", "Công nghiệp"} else 1.5
    criteria = [
        criterion("market_cap", "Vốn hóa", row.get("market_cap"), "≥ 1.000 tỷ ₫", row.get("market_cap") is not None and row["market_cap"] >= 1_000_000_000_000, 9),
        criterion("average_volume20", "KLGD TB20", row.get("average_volume20"), "≥ 300.000 cp", row.get("average_volume20") is not None and row["average_volume20"] >= 300_000, 9),
        criterion("price", "Giá đóng cửa", row.get("price"), "≥ 10.000 ₫", row.get("price") is not None and row["price"] >= 10_000, 5),
        criterion("exchange", "Sàn", row.get("exchange"), "HOSE hoặc HNX", row.get("exchange") in VALID_EXCHANGES, 3),
        criterion("status", "Trạng thái", row.get("security_status"), "Giao dịch bình thường", status_ok, 4),
        criterion("profit_growth", "Tăng trưởng LNST", row.get("profit_growth"), "> 10%", None if row.get("profit_growth") is None else row["profit_growth"] > 10, 9),
        criterion("revenue_growth", "Tăng trưởng doanh thu", row.get("revenue_growth"), "> 8%", None if row.get("revenue_growth") is None else row["revenue_growth"] > 8, 7),
        criterion("debt_to_equity", "Nợ/VCSH", row.get("debt_to_equity"), f"≤ {debt_limit:g} lần", None if row.get("debt_to_equity") is None else row["debt_to_equity"] <= debt_limit, 9),
        criterion("roe", "ROE 4 quý", row.get("roe"), "> 15%", None if row.get("roe") is None else row["roe"] > 15, 12),
        criterion("gross_margin", "Biên lợi nhuận gộp", row.get("gross_margin"), "≥ 15%", None if row.get("gross_margin") is None else row["gross_margin"] >= 15, 7),
        criterion("pe", "P/E trailing", row.get("pe"), "5–20 lần", None if row.get("pe") is None else 5 <= row["pe"] <= 20, 12),
    ]
    if industry == "Ngân hàng":
        criteria.extend([
            criterion("nim", "NIM quy đổi năm", row.get("nim"), "≥ 3,5%", None if row.get("nim") is None else row["nim"] >= 3.5, 8),
            criterion("npl", "Nợ xấu", row.get("npl"), "≤ 2%", None if row.get("npl") is None else row["npl"] <= 2, 5),
            criterion("llcr", "Bao phủ nợ xấu", row.get("llcr"), "≥ 100%", None if row.get("llcr") is None else row["llcr"] >= 100, 5),
        ])
    elif industry == "Bất động sản" or group == "Bất động sản & Xây dựng":
        criteria.append(criterion("current_ratio", "Thanh toán hiện hành", row.get("current_ratio"), "≥ 1,2 lần", None if row.get("current_ratio") is None else row["current_ratio"] >= 1.2, 8))
    elif group in {"Công nghiệp", "Hàng tiêu dùng", "Dịch vụ tiêu dùng"}:
        inventory_pass = None if row.get("inventory_turnover") is None or inventory_median is None else row["inventory_turnover"] > inventory_median
        criteria.extend([
            criterion("inventory_turnover", "Vòng quay tồn kho", row.get("inventory_turnover"), "Trên trung vị ngành", inventory_pass, 4),
            criterion("dividend_yield", "Tỷ suất cổ tức", row.get("dividend_yield"), "≥ 3%", None if row.get("dividend_yield") is None else row["dividend_yield"] >= 3, 4),
        ])

    total_weight = sum(item["weight"] for item in criteria)
    earned = sum(item["weight"] for item in criteria if item["passed"] is True)
    available = sum(1 for item in criteria if item["passed"] is not None)
    passed = sum(1 for item in criteria if item["passed"] is True)
    hard_keys = {"market_cap", "average_volume20", "price", "exchange", "status", "profit_growth", "revenue_growth", "roe", "pe"}
    eligible = all(item["passed"] is True for item in criteria if item["key"] in hard_keys)
    row.update({
        "score": round(earned / total_weight * 100),
        "passed_criteria": passed,
        "available_criteria": available,
        "eligible": eligible,
        "criteria_json": [{key: value for key, value in item.items() if key != "weight"} for item in criteria],
    })
    return row


def stock_payload(item: dict[str, str], as_of: str) -> dict[str, Any]:
    return {
        "symbol": item["symbol"],
        "company_name": item["company_name"],
        "sector": item["sector_group"],
        "exchange": item["exchange"],
        "icb_level2_code": item["icb_level2_code"],
        "icb_level2_name": item["icb_level2_name"],
        "sector_group": item["sector_group"],
        "instrument_type": "equity",
        "updated_at": as_of,
    }


def build_intraday_row(cached_row: dict[str, Any], quote: dict[str, Any], as_of: str, expires_at: str, inventory_median: float | None = None) -> dict[str, Any]:
    """Refresh quote fields while retaining the last verified fundamental period."""
    row = {
        **cached_row,
        **quote,
        "snapshot_date": date.today().isoformat(),
        "as_of": as_of,
        "provider_timestamp": as_of,
        "fetched_at": as_of,
        "expires_at": expires_at,
        "source_name": "vnstock-community-v4/vci-kbs",
        "data_quality": "delayed",
        "last_error": None,
        "refresh_status": "ready",
    }
    row.pop("id", None)
    row.pop("company_name", None)
    return score_row(row, inventory_median)


def full_sync(client: SupabaseRest) -> int:
    now = datetime.now(timezone.utc)
    as_of = now.isoformat()
    universe, exclusions = load_universe_with_exclusions(as_of)
    previous_rows = client.select("latest_sector_screenings")
    previous_by_symbol = {str(row.get("symbol") or ""): row for row in previous_rows}
    fundamental_refresh_days = max(1, int(os.getenv("SCREENER_FUNDAMENTAL_REFRESH_DAYS", "7")))
    expires_at = (datetime.fromisoformat(as_of) + timedelta(minutes=30)).isoformat()
    for offset in range(0, len(universe), 250):
        client.upsert("stocks", [stock_payload(item, as_of) for item in universe[offset:offset + 250]], "symbol")
    board = fetch_price_board([item["symbol"] for item in universe])
    delay = float(os.getenv("SCREENER_REQUEST_DELAY_SECONDS", "1.2"))
    rows: list[dict[str, Any]] = []
    failures: list[str] = []
    for index, item in enumerate(universe):
        quote = board.get(item["symbol"])
        if not quote:
            exclusions.append(exclusion(item, as_of, "quote", "missing_quote", "Nguồn price board chưa trả dữ liệu"))
            continue
        base_ok = (
            quote.get("price", 0) >= 10_000
            and (quote.get("market_cap") or 0) >= 1_000_000_000_000
            and quote.get("trading_status") == "TRADING_ACTIVATED"
            and quote.get("security_status") in ("", "N")
        )
        if not base_ok:
            if quote.get("price", 0) < 10_000:
                reason_code, reason_detail = "price_below_minimum", "Giá dưới 10.000 ₫"
            elif (quote.get("market_cap") or 0) < 1_000_000_000_000:
                reason_code, reason_detail = "market_cap_below_minimum", "Vốn hóa dưới 1.000 tỷ ₫"
            else:
                reason_code, reason_detail = "trading_status_not_normal", "Trạng thái giao dịch chưa bình thường"
            exclusions.append(exclusion(item, as_of, "quote", reason_code, reason_detail))
            continue
        try:
            volume = average_volume20(item["symbol"])
        except Exception as error:
            failures.append(f"{item['symbol']}: {error}")
            exclusions.append(exclusion(item, as_of, "fundamentals", "missing_ohlcv", "Thiếu OHLCV/thanh khoản có thể xác minh"))
            if index < len(universe) - 1:
                time.sleep(delay)
            continue
        time.sleep(delay)
        previous = previous_by_symbol.get(item["symbol"])
        metrics = reusable_fundamentals(previous, now, fundamental_refresh_days)
        fundamentals_fetched_at = previous.get("fundamentals_fetched_at") if metrics and previous else None
        fundamentals_provider_timestamp = previous.get("fundamentals_provider_timestamp") if metrics and previous else None
        fundamental_error: str | None = None
        if metrics is None:
            try:
                metrics = latest_ratio_metrics(item["symbol"])
                fundamentals_fetched_at = as_of
                fundamentals_provider_timestamp = as_of
            except Exception as error:
                fundamental_error = str(error)
                time.sleep(delay)
                if previous and previous.get("financial_period"):
                    metrics = {field: previous.get(field) for field in FUNDAMENTAL_FIELDS}
                    fundamentals_fetched_at = previous.get("fundamentals_fetched_at")
                    fundamentals_provider_timestamp = previous.get("fundamentals_provider_timestamp")
                else:
                    failures.append(f"{item['symbol']}: {error}")
                    exclusions.append(exclusion(item, as_of, "fundamentals", "missing_financial_metrics", "Thiếu chỉ số tài chính từ nguồn hiện tại"))
                    continue
            else:
                time.sleep(delay)
        try:
            row = {
                "symbol": item["symbol"],
                "snapshot_date": date.today().isoformat(),
                "as_of": as_of,
                "sector_group": item["sector_group"],
                "industry": item["icb_level2_name"],
                "exchange": item["exchange"],
                "average_volume20": volume,
                **quote,
                **metrics,
                "fundamentals_provider_timestamp": fundamentals_provider_timestamp,
                "fundamentals_fetched_at": fundamentals_fetched_at,
                "source": "vnstock-community-v4/vci-kbs",
                "provider_timestamp": as_of,
                "fetched_at": as_of,
                "expires_at": expires_at,
                "source_name": "vnstock-community-v4/vci-kbs",
                "data_quality": "stale-fundamentals" if fundamental_error else "delayed",
                "last_error": "Không làm mới được fundamentals; đang giữ kỳ gần nhất" if fundamental_error else None,
                "refresh_status": "ready",
            }
            rows.append(row)
        except Exception as error:
            failures.append(f"{item['symbol']}: {error}")
            exclusions.append(exclusion(item, as_of, "fundamentals", "screening_row_invalid", "Không thể chuẩn hóa dữ liệu screener"))

    medians: dict[str, float] = {}
    for industry in {str(row["industry"]) for row in rows}:
        values = [float(row["inventory_turnover"]) for row in rows if row["industry"] == industry and row.get("inventory_turnover") is not None]
        if values:
            medians[industry] = float(pd.Series(values).median())
    scored = [score_row(row, medians.get(str(row["industry"]))) for row in rows]
    for offset in range(0, len(scored), 100):
        client.upsert("sector_screenings", scored[offset:offset + 100], "symbol,snapshot_date")
    exclusions = dedupe_exclusions(exclusions)
    for offset in range(0, len(exclusions), 100):
        client.upsert("sector_screening_exclusions", exclusions[offset:offset + 100], "symbol,snapshot_date,reason_code")
    print(f"Sector screener full sync: {len(scored)} candidates from {len(universe)} HOSE/HNX equities", flush=True)
    if failures:
        print(f"Sector screener skipped {len(failures)} symbols; first warnings:\n" + "\n".join(failures[:20]), flush=True)
    return 0 if scored else 1


def intraday_sync(client: SupabaseRest) -> int:
    cached = client.select("latest_sector_screenings")
    if not cached:
        raise RuntimeError("No cached sector screening exists; run SCREENER_MODE=full first")
    board = fetch_price_board([str(row["symbol"]) for row in cached])
    as_of = datetime.now(timezone.utc).isoformat()
    expires_at = (datetime.fromisoformat(as_of) + timedelta(minutes=30)).isoformat()
    medians: dict[str, float] = {}
    for industry in {str(row["industry"]) for row in cached}:
        values = [float(row["inventory_turnover"]) for row in cached if row["industry"] == industry and row.get("inventory_turnover") is not None]
        if values:
            medians[industry] = float(pd.Series(values).median())
    updated: list[dict[str, Any]] = []
    exclusions: list[dict[str, Any]] = []
    for cached_row in cached:
        quote = board.get(str(cached_row["symbol"]))
        if not quote:
            exclusions.append(exclusion(cached_row, as_of, "intraday", "intraday_quote_missing", "Quote intraday tạm thời chưa có; tiếp tục giữ cache trước đó"))
            continue
        updated.append(build_intraday_row(cached_row, quote, as_of, expires_at, medians.get(str(cached_row["industry"]))))
    for offset in range(0, len(updated), 100):
        client.upsert("sector_screenings", updated[offset:offset + 100], "symbol,snapshot_date")
    exclusions = dedupe_exclusions(exclusions)
    for offset in range(0, len(exclusions), 100):
        client.upsert("sector_screening_exclusions", exclusions[offset:offset + 100], "symbol,snapshot_date,reason_code")
    print(f"Sector screener intraday refresh: {len(updated)} symbols at {as_of}", flush=True)
    return 0 if updated else 1


def main() -> int:
    api_key = os.getenv("VNSTOCK_API_KEY", "").strip()
    if api_key:
        setup_api_key(api_key)
    client = SupabaseRest()
    mode = os.getenv("SCREENER_MODE", "full").strip().lower()
    if mode == "full":
        return full_sync(client)
    if mode == "intraday":
        return intraday_sync(client)
    raise RuntimeError("SCREENER_MODE must be full or intraday")


if __name__ == "__main__":
    raise SystemExit(main())
