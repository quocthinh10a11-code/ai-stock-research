"""Synchronize the free VNStock listing universe and quarterly fundamentals."""
from __future__ import annotations

import os
import re
import time
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from typing import Any

import pandas as pd
from vnstock import Finance, Listing

try:
    from .sync_market_data import SupabaseRest, STOCKS, configure_vnstock_api, preserve_stock_classification
except ImportError:  # Support `python scripts/sync_company_research.py`.
    from sync_market_data import SupabaseRest, STOCKS, configure_vnstock_api, preserve_stock_classification


EXCHANGES = {"HOSE", "HNX", "UPCOM"}
EXCHANGE_ORDER = ("HOSE", "HNX", "UPCOM")


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


def all_exchange_listings(listing: Listing) -> pd.DataFrame:
    """Fetch each exchange explicitly because some VNStock sources omit exchange in the combined payload."""
    frames: list[pd.DataFrame] = []
    for exchange in EXCHANGE_ORDER:
        frame = listing.symbols_by_exchange(exchange=exchange).copy()
        if frame.empty:
            continue
        if not pick_column(frame, ("exchange", "comgroupcode", "exchange_code")):
            frame["exchange"] = exchange
        frames.append(frame)
    if not frames:
        raise RuntimeError("VNStock returned no listings for HOSE, HNX or UPCOM")
    return pd.concat(frames, ignore_index=True).drop_duplicates(subset=[
        pick_column(frames[0], ("symbol", "ticker", "code")) or "symbol"
    ])


ALIASES = {
    "revenue": ("revenue", "net_revenue", "net_interest_income"),
    "gross_profit": ("gross_profit", "gross_profit_from_sales_and_services", "total_operating_income"),
    "operating_profit": ("operating_profit", "operating_income", "net_operating_profit", "operating_profit_before_provision_for_credit_losses", "net_operating_profit_before_allowance_for_credit_loss"),
    "profit_before_tax": ("profit_before_tax", "taxable_profit", "net_accounting_profit_loss_before_tax"),
    "net_profit": ("profit_after_tax", "net_profit", "net_profit_after_tax", "net_profit_loss_after_tax", "profit_after_tax_for_shareholders_of_the_parent_company"),
    "eps": ("basic_earnings_per_share", "earnings_per_share", "earning_per_share_vnd", "eps_basic_vnd", "eps"),
    "total_assets": ("total_assets",),
    "total_liabilities": ("liabilities", "total_liabilities"),
    "equity": ("owners_equity", "equity", "total_equity"),
    "operating_cash_flow": ("net_cash_flows_from_operating_activities", "net_cash_flow_from_operating_activities"),
}


def normalize_id(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value).lower()).strip("_")


def normalize_financial_item_id(value: Any) -> str:
    return re.sub(r"^(?:[ivxlcdm]+|\d+)_", "", normalize_id(value))


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
    operating_expenses: dict[str, float] = {}
    unit = "reported unit"
    for record in frame.to_dict("records"):
        item_id = normalize_financial_item_id(record.get(item_column))
        if record.get("unit") and unit == "reported unit":
            unit = str(record["unit"])
        for target, aliases in ALIASES.items():
            if item_id in aliases or any(re.fullmatch(rf"{re.escape(alias)}_\d+", item_id) for alias in aliases):
                for period_column, period in zip(period_columns, periods):
                    raw = record.get(period_column)
                    number = pd.to_numeric(raw, errors="coerce")
                    values[period][target] = None if pd.isna(number) else float(number)
        if item_id == "operating_expenses":
            for period_column, period in zip(period_columns, periods):
                number = pd.to_numeric(record.get(period_column), errors="coerce")
                if not pd.isna(number):
                    operating_expenses[period] = float(number)
    for period in periods:
        operating_profit = values[period].get("operating_profit")
        if values[period].get("gross_profit") is None and operating_profit is not None and period in operating_expenses:
            values[period]["gross_profit"] = operating_profit + abs(operating_expenses[period])
        total_assets = values[period].get("total_assets")
        total_liabilities = values[period].get("total_liabilities")
        if values[period].get("equity") is None and total_assets is not None and total_liabilities is not None:
            values[period]["equity"] = total_assets - total_liabilities
    return periods, values, unit


KBS_REPORTS = {
    "income_statement": ("KQKD", "Kết quả kinh doanh"),
    "balance_sheet": ("CDKT", "Báo cáo tình hình tài chính"),
    "cash_flow": ("LCTT", "Lưu chuyển tiền tệ"),
}


def kbs_report_frame(finance: Finance, report_name: str) -> pd.DataFrame:
    """Read KBS values in response order and keep the last consolidated duplicate period."""
    report_type, report_key = KBS_REPORTS[report_name]
    provider = getattr(finance, "_provider", None)
    if provider is None or not hasattr(provider, "_fetch_financial_data"):
        raise RuntimeError("KBS raw financial API is unavailable")
    response = provider._fetch_financial_data(  # noqa: SLF001 - vnstock is pinned to 4.0.7.
        report_type=report_type, period_type=2, page=1, page_size=20
    )
    heads = response.get("Head", [])
    records = response.get("Content", {}).get(report_key, [])
    if not heads or not records:
        return pd.DataFrame()

    selected: dict[str, int] = {}
    for value_index, head in enumerate(heads, 1):
        year = head.get("YearPeriod")
        quarter = str(head.get("TermCode") or "").upper()
        if year and re.fullmatch(r"Q[1-4]", quarter):
            selected[f"{year}-{quarter}"] = value_index

    rows: list[dict[str, Any]] = []
    for record in records:
        row: dict[str, Any] = {
            "item": record.get("Name", ""),
            "item_en": record.get("NameEn", ""),
            "item_id": normalize_financial_item_id(record.get("NameEn") or record.get("Name")),
            "unit": "VND",
        }
        for period, value_index in selected.items():
            raw = pd.to_numeric(record.get(f"Value{value_index}"), errors="coerce")
            row[period] = None if pd.isna(raw) else float(raw) * 1_000
        rows.append(row)
    return pd.DataFrame(rows)


def sync_fundamentals(client: SupabaseRest, symbol: str, sources: list[str]) -> tuple[int, str]:
    errors: list[str] = []
    request_delay = float(os.getenv("VNSTOCK_FINANCE_REQUEST_DELAY_SECONDS", "4"))
    for source in sources:
        try:
            finance = Finance(symbol=symbol, source=source)
            frames_list: list[pd.DataFrame] = []
            for report_name, fetch_report in (
                ("income_statement", finance.income_statement),
                ("balance_sheet", finance.balance_sheet),
                ("cash_flow", finance.cash_flow),
            ):
                if request_delay > 0:
                    time.sleep(request_delay)
                frame = kbs_report_frame(finance, report_name) if source == "KBS" else fetch_report(period="quarter")
                if not frame.empty:
                    frames_list.append(frame)
            frames = tuple(frames_list)
            if not frames:
                raise RuntimeError("provider returned no financial reports")
            period_order: list[str] = []
            combined: dict[str, dict[str, float | None]] = {}
            unit = "reported unit"
            for frame in frames:
                periods, values, frame_unit = report_values(frame)
                unit = frame_unit if unit == "reported unit" else unit
                for period in periods:
                    if period not in period_order:
                        period_order.append(period)
                    combined.setdefault(period, {}).update(values[period])
            fetched_at = datetime.now(timezone.utc)
            rows = [{
                "symbol": symbol,
                "period_type": "quarter",
                "period_label": period,
                "period_end": period_end_date(period),
                "unit": "VND" if source == "KBS" else unit,
                "source": f"vnstock-community/{source.lower()}",
                "provider_timestamp": f"{period_end_date(period)}T00:00:00+07:00",
                "fetched_at": fetched_at.isoformat(),
                "expires_at": (fetched_at + timedelta(days=7)).isoformat(),
                "source_name": f"vnstock-community/{source.lower()}",
                "data_quality": "partial",
                "refresh_status": "ready",
                **combined[period],
            } for period in period_order[:20]]
            if not rows:
                raise RuntimeError("provider returned no financial periods")
            client.upsert("financial_periods", rows, "symbol,period_type,period_label")
            return len(rows), source
        except Exception as error:
            errors.append(f"{source}: {error}")
    raise RuntimeError("; ".join(errors))


def main() -> int:
    configure_vnstock_api()
    client = SupabaseRest()
    listing_source = os.getenv("VNSTOCK_LISTING_SOURCE", os.getenv("VNSTOCK_SOURCE", "KBS"))
    configured_sources = os.getenv("VNSTOCK_FINANCE_SOURCES", f"{listing_source},VCI")
    finance_sources = list(dict.fromkeys(
        item.strip().upper() for item in configured_sources.split(",") if item.strip()
    ))
    listing = all_exchange_listings(Listing(source=listing_source))
    stocks = listing_rows(listing)
    for index in range(0, len(stocks), 250):
        batch = stocks[index:index + 250]
        symbols = ",".join(row["symbol"] for row in batch)
        existing_stocks = client.select(
            "stocks",
            "symbol,sector,icb_level2_code,icb_level2_name,sector_group",
            symbol=f"in.({symbols})",
            limit=str(len(batch)),
        )
        client.upsert("stocks", preserve_stock_classification(batch, existing_stocks), "symbol")
    print(f"Synced catalog: {len(stocks)} symbols across HOSE, HNX and UPCOM", flush=True)
    configured = os.getenv("FUNDAMENTAL_SYMBOLS", "").strip()
    requested_value = configured or ",".join(dict.fromkeys([*STOCKS, *client.recent_research_symbols()]))
    requested = [item.strip().upper() for item in requested_value.split(",") if item.strip()]
    initial_delay = float(os.getenv("VNSTOCK_INITIAL_DELAY_SECONDS", "0"))
    if requested and initial_delay > 0:
        print(f"Waiting {initial_delay:g}s for the free VNStock quota window", flush=True)
        time.sleep(initial_delay)
    known = {row["symbol"] for row in stocks}
    failures: list[str] = []
    synced_symbols = 0
    for symbol in requested:
        if symbol not in known:
            failures.append(f"{symbol}: not listed on HOSE, HNX or UPCOM")
            continue
        try:
            count, used_source = sync_fundamentals(client, symbol, finance_sources)
            synced_symbols += 1
            print(f"Synced fundamentals {symbol}: {count} quarters via {used_source}", flush=True)
        except Exception as error:
            failures.append(f"{symbol}: {error}")
    if failures:
        print("Fundamental sync warnings:\n" + "\n".join(failures), flush=True)
    return 1 if requested and synced_symbols == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
