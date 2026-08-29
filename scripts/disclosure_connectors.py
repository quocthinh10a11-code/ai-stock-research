"""Targeted official disclosure connectors for HNX/UPCoM and HOSE."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from typing import Any
from urllib.parse import quote, urlencode, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen

try:
    from .sync_market_data import SupabaseRest
except ImportError:  # Support direct script imports from the worker.
    from sync_market_data import SupabaseRest


HNX_BASE_URL = "https://www.hnx.vn"
HOSE_BASE_URL = "https://www.hsx.vn/vi"
HOSE_NEWS_API = "https://api.hsx.vn/n/api/v1/1/news"
VIETNAM_TIMEZONE = timezone(timedelta(hours=7))
USER_AGENT = "AIStockResearch/1.0 (+https://github.com/quocthinh10a11-code/ai-stock-research)"


def normalized_https_url(value: str) -> str:
    parts = urlsplit(value)
    if parts.scheme != "https" or not parts.netloc:
        raise RuntimeError("official source returned a non-HTTPS URL")
    return urlunsplit((parts.scheme, parts.netloc, quote(parts.path, safe="/%"), parts.query, ""))


def fetch_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/json"})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


class DisclosureTableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[tuple[str, str, str]] = []
        self._div_depth = 0
        self._in_row = False
        self._in_cell = False
        self._cells: list[str] = []
        self._cell_text: list[str] = []
        self._href = ""
        self._row_href = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "div" and attributes.get("id") == "dTinCongBo":
            self._div_depth = 1
            return
        if self._div_depth:
            if tag == "div":
                self._div_depth += 1
            elif tag == "tr":
                self._in_row = True
                self._cells = []
                self._row_href = ""
            elif tag == "td" and self._in_row:
                self._in_cell = True
                self._cell_text = []
            elif tag == "a" and self._in_cell:
                self._href = attributes.get("href") or ""
                if self._href:
                    self._row_href = self._href

    def handle_endtag(self, tag: str) -> None:
        if not self._div_depth:
            return
        if tag == "td" and self._in_cell:
            self._cells.append(" ".join("".join(self._cell_text).split()))
            self._in_cell = False
        elif tag == "tr" and self._in_row:
            if len(self._cells) >= 2 and self._row_href:
                self.rows.append((self._cells[0], self._cells[1], self._row_href))
            self._in_row = False
        elif tag == "div":
            self._div_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._div_depth and self._in_cell:
            self._cell_text.append(data)


class TextOnlyParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def plain_text(value: str | None) -> str | None:
    if not value:
        return None
    parser = TextOnlyParser()
    parser.feed(value)
    text = " ".join("".join(parser.parts).split())
    return text[:500] or None


def content_hash(symbol: str, published_at: str, title: str, source_url: str) -> str:
    return hashlib.sha256(f"{symbol}|{published_at}|{title}|{source_url}".encode("utf-8")).hexdigest()


def hnx_disclosures(symbol: str, exchange: str, fetched_at: datetime) -> list[dict[str, Any]]:
    profile_url = f"{HNX_BASE_URL}/vi-vn/m-tim-kiem-{quote(symbol)}.html"
    parser = DisclosureTableParser()
    parser.feed(fetch_text(profile_url))
    rows: list[dict[str, Any]] = []
    for date_text, title, href in parser.rows:
        published = datetime.strptime(date_text.strip(), "%d/%m/%Y %H:%M").replace(tzinfo=VIETNAM_TIMEZONE)
        source_url = normalized_https_url(urljoin(profile_url, href))
        published_at = published.isoformat()
        rows.append({
            "symbol": symbol,
            "exchange": exchange,
            "title": title,
            "excerpt": None,
            "published_at": published_at,
            "source_name": "HNX Official",
            "source_url": source_url,
            "fetched_at": fetched_at.isoformat(),
            "content_hash": content_hash(symbol, published_at, title, source_url),
            "data_quality": "verified",
        })
    return rows


def slugify(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-") or "chi-tiet"


def hose_disclosures(symbol: str, fetched_at: datetime) -> list[dict[str, Any]]:
    query = urlencode({
        "pageIndex": 1,
        "pageSize": 100,
        "startDate": (fetched_at - timedelta(days=7)).date().isoformat(),
        "endDate": fetched_at.date().isoformat(),
    })
    payload = json.loads(fetch_text(f"{HOSE_NEWS_API}?{query}"))
    news = payload.get("data", {}).get("list", []) if payload.get("success") else []
    prefix = re.compile(rf"^\s*{re.escape(symbol)}\s*[:\-]", re.IGNORECASE)
    rows: list[dict[str, Any]] = []
    for item in news:
        title = str(item.get("title") or "").strip()
        if not prefix.search(title):
            continue
        published = datetime.fromtimestamp(int(item["postedDate"]), tz=timezone.utc)
        published_at = published.isoformat()
        source_url = f"{HOSE_BASE_URL}/thong-tin-cong-bo/{slugify(title)}/{int(item['id'])}"
        rows.append({
            "symbol": symbol,
            "exchange": "HOSE",
            "title": title,
            "excerpt": plain_text(item.get("summary")),
            "published_at": published_at,
            "source_name": "HOSE Official",
            "source_url": source_url,
            "fetched_at": fetched_at.isoformat(),
            "content_hash": content_hash(symbol, published_at, title, source_url),
            "data_quality": "partial",
        })
    return rows


def sync_disclosures(client: SupabaseRest, symbol: str, exchange: str) -> int:
    fetched_at = datetime.now(timezone.utc)
    if exchange in {"HNX", "UPCOM"}:
        rows = hnx_disclosures(symbol, exchange, fetched_at)
        source_name, quality = "HNX Official", "verified"
    elif exchange == "HOSE":
        rows = hose_disclosures(symbol, fetched_at)
        source_name, quality = "HOSE Official", "partial"
    else:
        raise RuntimeError(f"unsupported exchange for official disclosures: {exchange}")

    client.upsert("official_disclosures", rows, "source_url")
    provider_timestamp = max((row["published_at"] for row in rows), default=None)
    client.upsert("disclosure_sync_status", [{
        "symbol": symbol,
        "source_name": source_name,
        "provider_timestamp": provider_timestamp,
        "fetched_at": fetched_at.isoformat(),
        "expires_at": (fetched_at + timedelta(minutes=30)).isoformat(),
        "data_quality": quality,
        "last_error": None,
        "refresh_status": "ready",
        "updated_at": fetched_at.isoformat(),
    }], "symbol")
    return len(rows)
