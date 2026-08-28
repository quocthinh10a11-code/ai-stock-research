"""Synchronize the free VNStock listing universe and quarterly fundamentals."""
from __future__ import annotations

import os
import re
from calendar import monthrange
from datetime import date
from typing import Any

import pandas as pd
from vnstock import Finance, Listing

try:
    from .sync_market_data import SupabaseRest, STOCKS
except ImportError:  # Support `python scripts/sync_company_research.py`.
    from sync_market_data import SupabaseRest, STOCKS


EXCHANGES = {"HOSE", "HNX", "UPCOM"}


def pick_column(frame: pd.DataFrame, candidates: tuple[str, ...]) -> str | None:
    lowered = {str(column).lower(): str(column) for column in frame.columns}
    return next((lowered[name] for name in candidates if name in lowered), None)


def listing_rows(frame: pd.DataFrame) -> list[dict[str, Any]]:
    symbol_column = pick_column(frame, ("symbol", "ticker", "code"))
    company_column = pick_column(frame, ("organ_name", "company_name", "name", "organname"))
    exchange_column = pick_column(frame, ("exchange", "comgroupcode", "exchange_code"))
    industry_column = pick_column(frame, ("icb_name3", "industry", "sector", "icb_name2"))
    type_column = pick_column(frame, ("type", "instrument_type", "security_type"))
    if not symbol_column or not exchange_column:
        raise RuntimeError(f"VNStock listing response changed; columns={list(frame.columns)}")
    rows: list[dict[str, Any]] = []
    for record in frame.to_dict("records"):
        if type_column and str(record.get(type_column, "")).strip().lower() != "stock":
            continue
        symbol = str(record.get(symbol_column, "")).strip().upper()
        exchange = str(record.get(exchange_column, "")).strip().upper().replace("HSX", "HOSE")
        if not re.fullmatch(r"[A-Z0-9]{2,10}", symbol) or exchange not in EXCHANGES:
            continue
        rows.append({
            "symbol": symbol,
            "company_name": str(record.get(company_column) or symbol).strip(),
            "sector": str(record.get(industry_column) or "Unclassified").strip(),
            "exchange": exchange,
            "updated_at": f"{date.today().isoformat()}T00:00:00Z",
        })
    return rows


ALIASES = {
    "revenue": ("revenue", "net_revenue", "net_interest_income"),
    "gross_profit": ("gross_profit", "gross_profit_from_sales_and_services"),
    "operating_profit": ("operating_profit", "operating_income", "net_operating_profit"),
    "profit_before_tax": ("profit_before_tax", "taxable_profit"),
    "net_profit": ("profit_after_tax", "net_profit", "profit_after_tax_for_shareholders_of_the_parent_company"),
    "eps": ("basic_earnings_per_share", "earnings_per_share", "eps"),
    "total_assets": ("total_assets",),
    "total_liabilities": ("liabilities", "total_liabilities"),
    "equity": ("owners_equity", "equity", "total_equity"),
    "operating_cash_flow": ("net_cash_flows_from_operating_activities", "net_cash_flow_from_operating_activities"),
}


def normalize_id(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value).lower()).strip("_")


def period_end_date(label: str) -> str | None:
    year_match = re.search(r"(20\d{2})", label)
    quarter_match = re.search(r"(?:Q|QUARTER)[-_ /]?([1-4])|([1-4])[-_ /]?(?:Q|QUARTER)", label.upper())
    if not year_match:
        return None
    year = int(year_match.group(1))
    if quarter_match:
        quarter = int(quarter_match.group(1) or quarter_match.group(2))
        month = quarter * 3
        return date(year, month, monthrange(year, month)[1]).isoformat()
    return date(year, 12, 31).isoformat()


def report_values(frame: pd.DataFrame) -> tuple[list[str], dict[str, dict[str, float | None]], str]:
    item_column = pick_column(frame, ("item_id", "item", "item_en"))
    if not item_column:
        raise RuntimeError(f"VNStock financial response changed; columns={list(frame.columns)}")
    metadata = {item_column, "item", "item_en", "unit", "levels", "row_number"}
    period_columns = [column for column in frame.columns if str(column) not in metadata]
    periods = [str(column) for column in period_columns]
    values: dict[str, dict[str, float | None]] = {period: {} for period in periods}
    unit = "reported unit"
    for record in frame.to_dict("records"):
        item_id = normalize_id(record.get(item_column))
        if record.get("unit") and unit == "reported unit":
            unit = str(record["unit"])
        for target, aliases in ALIASES.items():
            if item_id in aliases or any(item_id.endswith(f"_{alias}") for alias in aliases):
                for period_column, period in zip(period_columns, periods):
                    raw = record.get(period_column)
                    number = pd.to_numeric(raw, errors="coerce")
                    values[period][target] = None if pd.isna(number) else float(number)
    return periods, values, unit


def sync_fundamentals(client: SupabaseRest, symbol: str, source: str) -> int:
    finance = Finance(symbol=symbol, source=source)
    income = finance.income_statement(period="quarter")
    balance = finance.balance_sheet(period="quarter")
    cash_flow = finance.cash_flow(period="quarter")
    period_order: list[str] = []
    combined: dict[str, dict[str, float | None]] = {}
    unit = "reported unit"
    for frame in (income, balance, cash_flow):
        periods, values, frame_unit = report_values(frame)
        unit = frame_unit if unit == "reported unit" else unit
        for period in periods:
            if period not in period_order:
                period_order.append(period)
            combined.setdefault(period, {}).update(values[period])
    rows = [{
        "symbol": symbol,
        "period_type": "quarter",
        "period_label": period,
        "period_end": period_end_date(period),
        "unit": unit,
        "source": f"vnstock-community/{source.lower()}",
        **combined[period],
    } for period in period_order[:8]]
    client.upsert("financial_periods", rows, "symbol,period_type,period_label")
    return len(rows)


def main() -> int:
    client = SupabaseRest()
    source = os.getenv("VNSTOCK_SOURCE", "KBS")
    listing = Listing(source=source).symbols_by_exchange()
    stocks = listing_rows(listing)
    for index in range(0, len(stocks), 250):
        client.upsert("stocks", stocks[index:index + 250], "symbol")
    print(f"Synced catalog: {len(stocks)} symbols across HOSE, HNX and UPCOM", flush=True)
    requested_value = os.getenv("FUNDAMENTAL_SYMBOLS", "").strip() or ",".join(STOCKS)
    requested = [item.strip().upper() for item in requested_value.split(",") if item.strip()]
    known = {row["symbol"] for row in stocks}
    failures: list[str] = []
    for symbol in requested:
        if symbol not in known:
            failures.append(f"{symbol}: not listed on HOSE, HNX or UPCOM")
            continue
        try:
            count = sync_fundamentals(client, symbol, source)
            print(f"Synced fundamentals {symbol}: {count} quarters", flush=True)
        except Exception as error:
            failures.append(f"{symbol}: {error}")
    if failures:
        print("Fundamental sync warnings:\n" + "\n".join(failures), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
