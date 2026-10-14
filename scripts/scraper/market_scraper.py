"""Best-effort scraper for public real-estate listings; run outside Vercel.

Portal markup and terms change. Configure listing URLs/selectors per portal and
confirm each portal permits automated access before scheduling this script.
"""
from __future__ import annotations

import logging
import os
import random
import re
import time
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from supabase import Client, create_client

LOG = logging.getLogger("market_scraper")
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/123.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 Version/17 Safari/605.1.15",
]
PORTAL_URLS = {
    # Set MARKET_URL_MERCADOLIBRE / MARKET_URL_FINCA RAIZ / MARKET_URL_METROCUADRADO
    # to public search result URLs. Selectors below are deliberately configurable.
    "mercadolibre": os.getenv("MARKET_URL_MERCADOLIBRE", ""),
    "fincaraiz": os.getenv("MARKET_URL_FINCARAIZ", ""),
    "metrocuadrado": os.getenv("MARKET_URL_METROCUADRADO", ""),
}
SELECTORS = {
    "mercadolibre": {"card": ".ui-search-result", "title": ".poly-component__title", "price": ".andes-money-amount__fraction", "area": ".ui-search-card-attributes", "url": "a.poly-component__title"},
    "fincaraiz": {"card": "article", "title": "h2", "price": "[class*=price]", "area": "[class*=area]", "url": "a[href]"},
    "metrocuadrado": {"card": "article", "title": "h2", "price": "[class*=price]", "area": "[class*=area]", "url": "a[href]"},
}

@dataclass
class Listing:
    source_url: str
    source_portal: str
    title: str
    price: float
    area_m2: float
    property_type: str
    stratum: int | None
    rooms: int | None
    bathrooms: int | None
    location_precision: str
    latitude: float
    longitude: float

def number(text: str) -> float | None:
    """Read the first localized numeric token, avoiding bedroom counts in attributes."""
    match = re.search(r"\d[\d.,]*", text)
    if not match:
        return None
    token = match.group(0)
    if "," in token and len(token.rsplit(",", 1)[-1]) in (1, 2):
        token = token.replace(".", "").replace(",", ".")
    else:
        token = token.replace(",", "").replace(".", "")
    try:
        return float(token)
    except ValueError:
        return None
def integer_match(text: str, pattern: str) -> int | None:
    match = re.search(pattern, text, re.I)
    return int(match.group(1)) if match else None

_GEOCODE_CACHE: dict[str, tuple[float, float] | None] = {}

def geocode(query: str, session: requests.Session) -> tuple[float, float] | None:
    if query in _GEOCODE_CACHE:
        return _GEOCODE_CACHE[query]
    try:
        response = session.get("https://nominatim.openstreetmap.org/search", params={"q": query, "format": "jsonv2", "limit": 1}, headers={"User-Agent": "MarketComparableResearch/1.0 (" + os.getenv("MARKET_CONTACT_EMAIL", "operator") + ")"}, timeout=15)
        response.raise_for_status()
        rows = response.json()
        if rows:
            point = (float(rows[0]["lat"]), float(rows[0]["lon"]))
            _GEOCODE_CACHE[query] = point
            return point
    except (requests.RequestException, ValueError, KeyError, TypeError) as exc:
        LOG.warning("Geocoding failed for %r: %s", query, exc)
    _GEOCODE_CACHE[query] = None
    return None

def coordinates_from_card(card: Any) -> tuple[float, float] | None:
    """Use portal-provided card coordinates when available."""
    for element in [card, *card.find_all(True)]:
        attrs = element.attrs
        lat = attrs.get("data-lat") or attrs.get("data-latitude") or attrs.get("latitude")
        lng = attrs.get("data-lng") or attrs.get("data-lon") or attrs.get("data-longitude") or attrs.get("longitude")
        try:
            if lat is not None and lng is not None:
                latitude, longitude = float(lat), float(lng)
                if -90 <= latitude <= 90 and -180 <= longitude <= 180 and (latitude != 0 or longitude != 0):
                    return latitude, longitude
        except (TypeError, ValueError):
            continue
    return None
def extract_portal(portal: str, page_url: str, session: requests.Session) -> list[Listing]:
    selectors = SELECTORS[portal]
    try:
        response = session.get(page_url, headers={"User-Agent": random.choice(USER_AGENTS)}, timeout=25)
        response.raise_for_status()
    except requests.RequestException as exc:
        LOG.error("HTTP failure portal=%s url=%s: %s", portal, page_url, exc)
        return []
    soup = BeautifulSoup(response.text, "html.parser")
    listings: list[Listing] = []
    for card in soup.select(selectors["card"]):
        try:
            title_el, price_el = card.select_one(selectors["title"]), card.select_one(selectors["price"])
            area_el, link = card.select_one(selectors["area"]), card.select_one(selectors["url"])
            if not all((title_el, price_el, area_el, link)):
                continue
            title = title_el.get_text(" ", strip=True)
            price = number(price_el.get_text(" ", strip=True))
            area = number(area_el.get_text(" ", strip=True))
            url = urljoin(page_url, link.get("href", ""))
            if not price or not area or not url.startswith("http"):
                continue
            point = coordinates_from_card(card)
            precision = "stored"
            if point is None:
                # The fallback is the search area's geocoded point, not the unit's exact location.
                context = os.getenv("MARKET_GEOCODE_CONTEXT", "").strip()
                if not context:
                    LOG.warning("Set MARKET_GEOCODE_CONTEXT to the target neighborhood/city; skipping approximate geocoding")
                    continue
                point = geocode(f"{context}, Colombia", session)
                precision = "geocoded"
            if point is None:
                continue
            listing_text = card.get_text(" ", strip=True)
            ptype = "Apartamento" if re.search(r"aparta|apartamento", title, re.I) else "Casa" if re.search(r"casa", title, re.I) else "Villa" if re.search(r"villa", title, re.I) else "Lote" if re.search(r"lote|terreno", title, re.I) else "Comercial" if re.search(r"local|comercial|oficina", title, re.I) else "unknown"
            listings.append(Listing(url, portal, title, price, area, ptype,
                integer_match(listing_text, r"estrato\s*(\d)"),
                integer_match(listing_text, r"(\d+)\s*(?:hab|alcoba|dormitorio)"),
                integer_match(listing_text, r"(\d+)\s*baño"), precision, point[0], point[1]))
        except (AttributeError, TypeError, ValueError) as exc:
            LOG.warning("Skipping malformed card from %s: %s", portal, exc)
    return listings

def main() -> None:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    supabase_url, service_key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    db: Client = create_client(supabase_url, service_key)
    session = requests.Session()
    for portal, url in PORTAL_URLS.items():
        if not url:
            LOG.info("No search URL configured for %s; skipping", portal)
            continue
        rows = extract_portal(portal, url, session)
        payload: list[dict[str, Any]] = [{
            "source_url": x.source_url, "source_portal": x.source_portal,
            "title": x.title, "price": x.price, "area_m2": x.area_m2, "property_type": x.property_type,
            "extraction_date": datetime.now(timezone.utc).isoformat(),
            "stratum": x.stratum, "rooms": x.rooms, "bathrooms": x.bathrooms,
            "location": f"SRID=4326;POINT({x.longitude} {x.latitude})",
            "location_precision": x.location_precision,
        } for x in rows]
        if payload:
            try:
                db.table("market_comparables").upsert(payload, on_conflict="source_url").execute()
                LOG.info("Upserted %d listings from %s", len(payload), portal)
            except Exception as exc:  # SDK/API errors vary by supabase-py version
                LOG.exception("Supabase upsert failed for %s: %s", portal, exc)
        time.sleep(random.uniform(2.0, 5.0))  # courteous pacing; no anti-bot bypass

if __name__ == "__main__":
    main()







