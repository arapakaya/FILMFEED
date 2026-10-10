"""language: Python, file: cinesubz_scraper.py, runtime: Python 3.10+, target: cinesubz.co (Zetaflix WordPress theme)

pip install requests beautifulsoup4 lxml websocket-client

Four surfaces, one client:
  1. cards    - homepage / pagination / search result grids
  2. detail   - metadata, cast, quality, duration, genres, and the zt-links list
  3. resolve  - the zt-links interstitial -> the drive.csplayer2.space URL
  4. download - the last hop, which is browser-gated and needs a real Chrome

Hop 3 (zt-links): the page ships the real link inside <a id="link"> under a decoy
host (google.com/serverN) and rewrites it client-side. resolve_direct_url() is a
line-for-line port of that inline script, first-match-wins ordering included. The
<meta http-equiv="refresh"> on that page is an ad hop and is ignored.

Hop 4 (the one that bites): the resolved drive.csplayer2.space URL is NOT the file.
It serves an Express interstitial that calls
    GET /api/download-data<same path and query>
and re-navigates to the path it returns. The re-navigation is what returns the file.
Measured behaviour of that hop:
  - plain HTTP client (requests/curl/aria2/IDM) -> interstitial again, every time
  - headless Chrome -> 403, anti-bot on the headless UA
  - real Chrome -> 200, JS runs, second navigation returns a download response
So the last hop is only reachable by a real browser. BrowserFetch drives Chrome over
CDP, lets the site's own JS perform the hop, and lets Chrome save the response.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from typing import Iterable, Iterator
from urllib.parse import quote_plus, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://cinesubz.co"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
}

# urlMappings from the zt-links inline script. First matching needle wins, in order.
HOST_MAP: tuple[tuple[tuple[str, ...], str], ...] = (
    (
        (
            "https://google.com/server11/1:",
            "https://google.com/server12/1:",
            "https://google.com/server13/1:",
        ),
        "https://drive.csplayer2.space/server1/",
    ),
    (
        (
            "https://google.com/server21/1:",
            "https://google.com/server22/1:",
            "https://google.com/server23/1:",
        ),
        "https://drive.csplayer2.space/server2/",
    ),
    (("https://google.com/server3/1:",), "https://drive.csplayer2.space/server3/"),
    (("https://google.com/server4/1:",), "https://drive.csplayer2.space/server4/"),
    (("https://google.com/server5/1:",), "https://drive.csplayer2.space/server5/"),
    (("https://google.com/server6/",), "https://drive.csplayer2.space/server6/"),
    (("https://google.com/server7/",), "https://drive.csplayer2.space/server7/"),
)

# Telegram hosts are rewrites of each other on the same page.
TELEGRAM_SUBS: tuple[tuple[str, str], ...] = (
    ("srilank222", "srilanka2222"),
    ("https://tsadsdaas.me/", "http://tdsdfasdaddd.me/"),
)

CODE_SUFFIX = "?bot=cscloud2bot&code="
EXT_RULES: tuple[tuple[str, str], ...] = (
    (f".mp4{CODE_SUFFIX}", f"?ext=mp4{CODE_SUFFIX}"),
    (".mp4", "?ext=mp4"),
    (f".mkv{CODE_SUFFIX}", f"?ext=mkv{CODE_SUFFIX}"),
    (".mkv", "?ext=mkv"),
    (".zip", "?ext=zip"),
)

RETRY_STATUS = (429, 500, 502, 503, 504)
SYNOPSIS_SELECTORS = (
    "div.content-description",
    "div.movie-description",
    "div[itemprop='description']",
    "div.zt-synopsis",
    "div.summary",
)


# --------------------------------------------------------------------------- #
# zt-links resolution
# --------------------------------------------------------------------------- #
def _apply_ext(url: str) -> str:
    for needle, replacement in EXT_RULES:
        if needle in url:
            return url.replace(needle, replacement, 1)
    return url


def resolve_direct_url(raw_url: str) -> tuple[str, str, str]:
    """Port of the zt-links inline JS. Returns (direct_url, kind, button_text)."""
    modified = raw_url
    mapped = False
    for needles, replacement in HOST_MAP:
        for needle in needles:
            if needle in modified:
                modified = modified.replace(needle, replacement, 1)
                mapped = True
                break
        if mapped:
            break

    if mapped:
        return _apply_ext(modified), "direct", "Go to Download Page"

    candidate, changed = modified, False
    for old, new in TELEGRAM_SUBS:
        if old in candidate:
            candidate = candidate.replace(old, new, 1)
            changed = True
    if changed:
        return candidate, "telegram", "Telegram Download"
    if raw_url.startswith("https://t.me/"):
        return raw_url, "telegram", "Telegram Download"
    return raw_url, "unresolved", "Contact Admin"


def parse_zt_page(html: str) -> tuple[str | None, str | None]:
    """Pull (raw #link href, parent movie url) out of an interstitial page."""
    soup = BeautifulSoup(html, "lxml")
    node = soup.select_one("#link") or soup.select_one("a.wait-done") or soup.select_one("a[id='link']")
    raw = (node.get("href") or "").strip() if node else None
    back = soup.select_one("a.prev-lnk")
    parent = urljoin(BASE + "/", back.get("href")) if back and back.get("href") else None
    return (raw or None), parent


# --------------------------------------------------------------------------- #
# records
# --------------------------------------------------------------------------- #
@dataclass
class Card:
    url: str
    title: str
    poster: str | None = None
    slug: str | None = None
    post_id: str | None = None
    quality: str | None = None
    language: str | None = None
    season: str | None = None
    episode: str | None = None
    imdb_id: str | None = None
    imdb_rating: str | None = None
    ptype: str | None = None


@dataclass
class CastMember:
    name: str
    role: str | None = None
    url: str | None = None


@dataclass
class RawLink:
    zt_url: str
    row_id: str | None
    label: str | None
    meta: str | None
    quality: str | None = None
    size: str | None = None
    language: str | None = None


@dataclass
class ResolvedLink:
    zt_url: str
    raw_url: str
    direct_url: str
    kind: str
    button_text: str
    resolved: bool = True


@dataclass
class MovieDetail:
    url: str
    title: str
    poster: str | None = None
    slug: str | None = None
    imdb_id: str | None = None
    imdb_rating: str | None = None
    imdb_votes: str | None = None
    site_rating: str | None = None
    site_votes: int | None = None
    quality: str | None = None
    duration: str | None = None
    language: str | None = None
    genres: list[str] = field(default_factory=list)
    director: str | None = None
    year: str | None = None
    subtitle_by: str | None = None
    country: str | None = None
    source_article: str | None = None
    description: str | None = None
    cast: list[CastMember] = field(default_factory=list)
    links: list[RawLink] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# hop 4: browser-gated download
# --------------------------------------------------------------------------- #
CHROME_CANDIDATES = (
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
)
UA_CHROME = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def find_browser() -> str | None:
    for path in CHROME_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


@dataclass
class DownloadResult:
    page_url: str
    final_url: str | None
    saved_path: str | None
    bytes_on_disk: int
    state: str
    suggested_name: str | None = None
    complete: bool = False


class BrowserFetch:
    """Drive a real browser through the interstitial so the file hop actually happens.

    Headless Chrome gets a 403 from the host, so this runs Chrome windowed at an
    off-screen position. Chrome's own JS performs the /api/download-data call; we
    only watch Browser.downloadWillBegin to learn the true final URL and let the
    download land in download_dir.
    """

    def __init__(
        self,
        download_dir: str = ".",
        browser: str | None = None,
        port: int = 9355,
        timeout: float = 180.0,
        keep_partial: bool = True,
    ) -> None:
        self.download_dir = os.path.abspath(download_dir)
        self.browser = browser or find_browser()
        self.port = port
        self.timeout = timeout
        self.keep_partial = keep_partial
        if not self.browser:
            raise RuntimeError("no Chrome/Edge binary found; pass browser=<path>")
        os.makedirs(self.download_dir, exist_ok=True)

    def _extension(self, page_url: str) -> str:
        path = urlparse(page_url).path
        stem = os.path.basename(path)
        m = re.search(r"\.(mp4|mkv|zip)$", stem, re.IGNORECASE)
        return m.group(1).lower() if m else "mp4"

    def _target_name(self, page_url: str, suggested: str | None) -> str:
        # The host serves Content-Disposition: downloads.htm; the real name comes
        # from the URL path, so rebuild it from the path instead of trusting that.
        stem = os.path.basename(urlparse(page_url).path)
        stem = re.sub(r"\.(mp4|mkv|zip)$", "", stem, flags=re.IGNORECASE)
        stem = re.sub(r"%[0-9A-Fa-f]{2}", lambda m: m.group(0), stem)
        try:
            from urllib.parse import unquote

            stem = unquote(stem)
        except Exception:
            pass
        stem = re.sub(r'[<>:"/\\|?*]', "_", stem).strip() or (suggested or "download")
        return f"{stem}.{self._extension(page_url)}"

    def download(self, page_url: str, referer: str | None = None, budget: float | None = None) -> DownloadResult:
        import shutil
        import subprocess
        import tempfile
        import urllib.request

        import websocket  # lazy: only needed for this hop

        budget = budget if budget is not None else self.timeout
        profile = tempfile.mkdtemp(prefix="cinesubz-chrome-")
        staging = tempfile.mkdtemp(prefix="cinesubz-dl-")
        proc = subprocess.Popen(
            [
                self.browser, f"--remote-debugging-port={self.port}",
                f"--user-data-dir={profile}", "--no-first-run", "--no-default-browser-check",
                "--disable-gpu", "--disable-features=Translate", "--no-sandbox",
                "--window-position=-32000,-32000", "--window-size=1280,900",
                "about:blank",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        def devjson(path: str):
            with urllib.request.urlopen(f"http://127.0.0.1:{self.port}{path}", timeout=5) as r:
                return json.loads(r.read().decode())

        bws = pws = None
        final_url: str | None = None
        suggested: str | None = None
        state = "unknown"
        received = 0
        try:
            for _ in range(50):
                try:
                    version = devjson("/json/version")
                    break
                except Exception:
                    time.sleep(0.4)
            else:
                raise RuntimeError("browser devtools endpoint never came up")

            bws = websocket.create_connection(version["webSocketDebuggerUrl"], timeout=5, suppress_origin=True)
            bws.send(json.dumps({"id": 1, "method": "Browser.setDownloadBehavior", "params": {
                "behavior": "allow", "downloadPath": staging, "eventsEnabled": True}}))

            page = None
            for _ in range(50):
                page = next((t for t in devjson("/json/list")
                             if t.get("type") == "page" and t.get("webSocketDebuggerUrl")), None)
                if page:
                    break
                time.sleep(0.3)
            if not page:
                raise RuntimeError("no browser page target")

            pws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=5, suppress_origin=True)
            setup = (
                ("Network.enable", {}),
                ("Page.enable", {}),
                ("Network.setUserAgentOverride", {"userAgent": UA_CHROME, "platform": "Win32"}),
                ("Network.setExtraHTTPHeaders", {"headers": {"Referer": referer} if referer else {}}),
            )
            for i, (method, params) in enumerate(setup, start=10):
                pws.send(json.dumps({"id": i, "method": method, "params": params}))
            time.sleep(1.0)
            pws.send(json.dumps({"id": 50, "method": "Page.navigate", "params": {"url": page_url}}))

            bws.settimeout(1.0)
            pws.settimeout(1.0)
            start = time.time()
            while time.time() - start < budget:
                for sock in (bws, pws):
                    try:
                        msg = json.loads(sock.recv())
                    except Exception:
                        continue
                    method, params = msg.get("method"), msg.get("params", {})
                    if method in ("Browser.downloadWillBegin", "Page.downloadWillBegin") and not final_url:
                        final_url = params.get("url")
                        suggested = params.get("suggestedFilename")
                    elif method in ("Browser.downloadProgress", "Page.downloadProgress"):
                        state = params.get("state", state)
                        received = int(params.get("receivedBytes") or 0)
                        if state in ("completed", "canceled"):
                            budget = 0
                time.sleep(0.1)

            files = sorted(os.listdir(staging)) if os.path.isdir(staging) else []
            if not files:
                return DownloadResult(page_url, final_url or page_url, None, 0, state or "no-download")

            staged = os.path.join(staging, files[0])
            # No .crdownload left behind means Chrome finished the transfer.
            if state == "unknown" and not files[0].endswith(".crdownload"):
                state = "completed"
            if final_url is None:
                # The navigation that triggers the download is the page URL itself;
                # the host answers it with Content-Disposition, which is what made
                # Chrome save rather than render.
                final_url = page_url
            final_name = self._target_name(page_url, suggested)
            dest = os.path.join(self.download_dir, final_name)
            if os.path.exists(dest):
                root, ext = os.path.splitext(final_name)
                n = 2
                while os.path.exists(dest):
                    dest = os.path.join(self.download_dir, f"{root} ({n}){ext}")
                    n += 1
            shutil.move(staged, dest)
            size = os.path.getsize(dest)
            complete = state == "completed"
            if not complete and not self.keep_partial:
                os.remove(dest)
                dest = None
                size = 0
            return DownloadResult(page_url, final_url, dest, size, state, suggested, complete)
        finally:
            for sock in (bws, pws):
                try:
                    if sock:
                        sock.close()
                except Exception:
                    pass
            proc.terminate()
            try:
                proc.wait(timeout=8)
            except Exception:
                proc.kill()
            shutil.rmtree(profile, ignore_errors=True)
            shutil.rmtree(staging, ignore_errors=True)


# --------------------------------------------------------------------------- #
# html parsing
# --------------------------------------------------------------------------- #
def _soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def _text(node, sep: str = " ") -> str | None:
    if node is None:
        return None
    out = node.get_text(sep, strip=True)
    return out or None


def _abs(base: str, href: str | None) -> str | None:
    return urljoin(base + "/", href.strip()) if href and href.strip() else None


def _badges(scope, kind: str) -> str | None:
    found = [n.get_text(" ", strip=True) for n in scope.select(f"span.badge-{kind}-corner")]
    found = [f for f in found if f]
    return ", ".join(found) if found else None


def _strip_parens(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if stripped.startswith("(") and stripped.endswith(")"):
        stripped = stripped[1:-1].strip()
    return stripped or None


def parse_cards(html: str, base: str = BASE) -> list[Card]:
    soup = _soup(html)
    cards: list[Card] = []
    seen: set[str] = set()

    for box in soup.select("div.display-item"):
        anchor = box.select_one("a[data-url]")
        if anchor is None:
            continue
        url = _abs(base, anchor.get("href"))
        if not url or url in seen:
            continue
        seen.add(url)

        img = box.select_one("img.thumb") or box.select_one("img[data-original]")
        title_el = box.select_one(".item-desc-title h3")
        score = box.select_one(".imdb-score")
        imdb_el = box.select_one(".rating1")
        imdb_id = None
        if imdb_el is not None:
            parts = imdb_el.get_text(" ", strip=True).split()
            if parts and parts[-1].startswith("tt"):
                imdb_id = parts[-1]

        cards.append(
            Card(
                url=url,
                title=(
                    _text(title_el)
                    or (anchor.get("title") or "").strip()
                    or (img.get("alt", "").strip() if img else "")
                    or url.rsplit("/", 2)[-2]
                ),
                poster=(img.get("data-original") or img.get("src")) if img else None,
                slug=(anchor.get("data-url") or "").strip() or None,
                post_id=(box.get("id") or "").replace("item-", "") or None,
                quality=_badges(box, "quality"),
                language=_badges(box, "language"),
                season=_badges(box, "season"),
                episode=_badges(box, "episode"),
                imdb_id=imdb_id,
                imdb_rating=_text(score),
                ptype=(anchor.get("data-ptype") or "movies"),
            )
        )
    return cards


def _info_value(scope, label: str) -> str | None:
    for para in scope.select("p"):
        strong = para.find("strong")
        if strong is None:
            continue
        if strong.get_text(strip=True).rstrip(":").strip().lower() != label.lower():
            continue
        whole = para.get_text(" ", strip=True)
        value = whole.split(":", 1)[1].strip() if ":" in whole else ""
        return value or None
    return None


def parse_detail(html: str, url: str, base: str = BASE) -> MovieDetail:
    soup = _soup(html)

    title_el = soup.select_one(".details-title h3")
    poster_el = soup.select_one(".content-poster img.poster-img")
    imdb_el = soup.select_one(".imdb-data[data-imdb]")
    site_rating = soup.select_one(".zt_rating_vgs")
    votes_meta = soup.select_one("meta[itemprop='ratingCount']")
    quality_el = soup.select_one(".data-quality")
    duration_el = soup.select_one("span[itemprop='duration']")
    lang_el = soup.select_one(".data-keywords-inline a")
    imdb_block = soup.select_one(".data-imdb")
    vote_span = soup.select_one(".data-imdb-votes")

    imdb_rating = None
    if imdb_block is not None:
        hit = re.search(r"IMDb:\s*([\d.]+)", imdb_block.get_text(" ", strip=True))
        imdb_rating = hit.group(1) if hit else None

    site_votes = None
    if votes_meta is not None:
        raw = (votes_meta.get("content") or "").strip()
        site_votes = int(raw) if raw.isdigit() else None

    hidden = soup.select_one(".vote-average-hidden")
    source_article = None
    if hidden is not None:
        hit = re.search(r"https?://[^\s<>]+", hidden.get_text(" ", strip=True))
        source_article = hit.group(0) if hit else None

    genres = [a.get_text(" ", strip=True) for a in soup.select(".details-genre a") if a.get_text(strip=True)]
    info = soup.select_one(".details-info")

    cast: list[CastMember] = []
    for card in soup.select(".zt-cast-card"):
        link = card.select_one("a.zt-cast-link")
        name = _text(card.select_one(".zt-cast-name")) or (link.get("title") if link else None)
        if not name:
            continue
        cast.append(
            CastMember(
                name=name,
                role=_text(card.select_one(".zt-cast-role")),
                url=_abs(base, link.get("href")) if link else None,
            )
        )

    description = None
    for sel in SYNOPSIS_SELECTORS:
        node = soup.select_one(sel)
        text = _text(node)
        if text:
            description = text
            break

    links: list[RawLink] = []
    for item in soup.select(".movie-download-link-item"):
        anchor = item.select_one("a.movie-download-button[href]")
        if anchor is None:
            continue
        zt = _abs(base, anchor.get("href"))
        if not zt:
            continue
        meta = _text(item.select_one(".movie-download-meta")) or ""
        parts = [p.strip() for p in meta.split("•") if p.strip()]
        links.append(
            RawLink(
                zt_url=zt,
                row_id=(item.get("id") or "").replace("link-row-", "") or None,
                label=_text(item.select_one(".movie-download-type")),
                meta=meta or None,
                quality=parts[0] if parts else None,
                size=parts[1] if len(parts) > 1 else None,
                language=parts[2] if len(parts) > 2 else None,
            )
        )

    return MovieDetail(
        url=url,
        title=_text(title_el) or (soup.title.get_text(strip=True) if soup.title else url),
        poster=poster_el.get("src") if poster_el else None,
        slug=urlparse(url).path.rstrip("/").rsplit("/", 1)[-1] or None,
        imdb_id=(imdb_el.get("data-imdb") if imdb_el else None),
        imdb_rating=imdb_rating,
        imdb_votes=_strip_parens(_text(vote_span)),
        site_rating=(site_rating.get("content") or site_rating.get_text(strip=True)) if site_rating else None,
        site_votes=site_votes,
        quality=_text(quality_el),
        duration=_text(duration_el),
        language=_text(lang_el),
        genres=genres,
        director=_info_value(info, "Director") if info else None,
        year=_info_value(info, "Year") if info else None,
        subtitle_by=_info_value(info, "Subtitle By") if info else None,
        country=_info_value(info, "Country") if info else None,
        source_article=source_article,
        description=description,
        cast=cast,
        links=links,
    )


# --------------------------------------------------------------------------- #
# client
# --------------------------------------------------------------------------- #
class CineSubz:
    def __init__(
        self,
        base: str = BASE,
        delay: float = 1.2,
        timeout: float = 30.0,
        retries: int = 3,
        referer: str | None = None,
    ) -> None:
        self.base = base.rstrip("/")
        self.delay = delay
        self.timeout = timeout
        self.retries = retries
        self.referer = referer
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self._last_call = 0.0

    def _throttle(self) -> None:
        wait = self.delay - (time.monotonic() - self._last_call)
        if wait > 0:
            time.sleep(wait + random.uniform(0.0, 0.3))
        self._last_call = time.monotonic()

    def get(self, url: str, referer: str | None = None) -> str:
        target = url if url.startswith("http") else urljoin(self.base + "/", url)
        ref = referer or self.referer
        headers = {"Referer": ref} if ref else {}
        last: Exception | None = None
        for attempt in range(self.retries):
            self._throttle()
            try:
                resp = self.session.get(target, timeout=self.timeout, headers=headers)
                if resp.status_code in RETRY_STATUS:
                    raise requests.HTTPError(f"HTTP {resp.status_code}")
                resp.raise_for_status()
                if not resp.text.strip():
                    raise ValueError("empty body")
                return resp.text
            except Exception as exc:  # noqa: BLE001 - retried and reported below
                last = exc
                if attempt < self.retries - 1:
                    time.sleep(1.5 * (attempt + 1))
        raise RuntimeError(f"GET failed after {self.retries} tries: {target} ({last})")

    # -- surfaces ---------------------------------------------------------- #
    def cards(self, page: int = 1) -> list[Card]:
        path = "/" if page <= 1 else f"/page/{page}/"
        return parse_cards(self.get(path), self.base)

    def search(self, query: str) -> list[Card]:
        return parse_cards(self.get(f"/?s={quote_plus(query)}"), self.base)

    def iter_cards(self, pages: int = 1) -> Iterator[Card]:
        seen: set[str] = set()
        for page in range(1, pages + 1):
            for card in self.cards(page):
                if card.url in seen:
                    continue
                seen.add(card.url)
                yield card

    def movie(self, url_or_slug: str) -> MovieDetail:
        target = url_or_slug
        if not target.startswith("http"):
            target = f"/movies/{target.strip('/')}/" if "/" not in target.strip("/") else target
        target = urljoin(self.base + "/", target)
        html = self.get(target)
        detail = parse_detail(html, target, self.base)
        if not detail.links:
            raise RuntimeError(f"no download links parsed from {target} (markup likely changed)")
        return detail

    def resolve(self, zt_url: str, referer: str | None = None) -> ResolvedLink:
        raw, _parent = parse_zt_page(self.get(zt_url, referer=referer))
        if not raw:
            raise RuntimeError(f"no #link href on interstitial page: {zt_url}")
        direct, kind, button = resolve_direct_url(raw)
        return ResolvedLink(
            zt_url=zt_url,
            raw_url=raw,
            direct_url=direct,
            kind=kind,
            button_text=button,
            resolved=kind != "unresolved",
        )

    def resolve_all(self, detail: MovieDetail) -> list[ResolvedLink]:
        out: list[ResolvedLink] = []
        for link in detail.links:
            out.append(self.resolve(link.zt_url, referer=detail.url))
        return out

    def direct_links(self, url_or_slug: str) -> tuple[MovieDetail, list[ResolvedLink]]:
        detail = self.movie(url_or_slug)
        return detail, self.resolve_all(detail)


# --------------------------------------------------------------------------- #
# output
# --------------------------------------------------------------------------- #
def _pad(text: str, width: int) -> str:
    text = text if len(text) <= width else text[: width - 1] + "…"
    return text.ljust(width)


def print_cards(cards: Iterable[Card]) -> None:
    rows = list(cards)
    if not rows:
        print("no cards found")
        return
    print(f"{'ID':>7}  {'RATING':>6}  {'QUALITY':<10}  {'TITLE'}")
    print("-" * 96)
    for c in rows:
        rating = c.imdb_rating or "-"
        print(f"{_pad(c.post_id or '-', 7)}  {rating:>6}  {_pad(c.quality or '-', 10)}  {c.title}")
    print(f"\n{len(rows)} cards")


def print_detail(detail: MovieDetail, links: list[ResolvedLink] | None = None) -> None:
    print("=" * 96)
    print(detail.title)
    print("=" * 96)
    print(f"url           {detail.url}")
    print(f"poster        {detail.poster or '-'}")
    print(f"quality       {detail.quality or '-'}   duration {detail.duration or '-'}   year {detail.year or '-'}")
    print(f"imdb          {detail.imdb_id or '-'}  {detail.imdb_rating or '-'} ({detail.imdb_votes or '-'})")
    print(f"site rating   {detail.site_rating or '-'} from {detail.site_votes or '-'} votes")
    print(f"language      {detail.language or '-'}")
    print(f"genres        {', '.join(detail.genres) or '-'}")
    print(f"director      {detail.director or '-'}")
    print(f"subtitle by   {detail.subtitle_by or '-'}   country {detail.country or '-'}")
    print(f"source        {detail.source_article or '-'}")
    if detail.description:
        print(f"description   {detail.description}")
    if detail.cast:
        print(f"cast          {', '.join(f'{m.name} ({m.role})' if m.role else m.name for m in detail.cast)}")
    print("\ndownload entries")
    for i, lk in enumerate(detail.links, 1):
        print(
            f"  {i}. {_pad(lk.quality or '-', 13)} {_pad(lk.size or '-', 9)} "
            f"{_pad(lk.language or '-', 8)} {lk.zt_url}"
        )
    if links is not None:
        print("\nresolved")
        for i, (lk, rs) in enumerate(zip(detail.links, links), 1):
            flag = "ok " if rs.resolved else "DEAD"
            print(f"  {i}. [{flag}/{rs.kind}] {rs.direct_url}")
            if rs.raw_url != rs.direct_url:
                print(f"        decoy : {rs.raw_url}")


# --------------------------------------------------------------------------- #
# cli
# --------------------------------------------------------------------------- #
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="cinesubz_scraper",
        description="Scrape cinesubz.co cards, movie details, and resolve zt-links to direct URLs.",
    )
    ap.add_argument("--base", default=BASE, help=f"site host (default {BASE})")
    ap.add_argument("--delay", type=float, default=1.2, help="seconds between requests")
    ap.add_argument("--timeout", type=float, default=30.0)
    ap.add_argument("--retries", type=int, default=3)
    ap.add_argument("--json", action="store_true", help="emit JSON instead of a table")

    sub = ap.add_subparsers(dest="cmd", required=True)

    p_cards = sub.add_parser("cards", help="homepage / pagination cards")
    p_cards.add_argument("--pages", type=int, default=1)

    p_search = sub.add_parser("search", help="WordPress search cards")
    p_search.add_argument("query")

    p_movie = sub.add_parser("movie", help="full detail for one movie")
    p_movie.add_argument("url_or_slug")
    p_movie.add_argument("--resolve", action="store_true", help="also resolve every zt-link")

    p_resolve = sub.add_parser("resolve", help="resolve one zt-links interstitial")
    p_resolve.add_argument("zt_url")

    p_dl = sub.add_parser(
        "download", help="browser-gated last hop: resolve, then let real Chrome save the file"
    )
    p_dl.add_argument("target", help="movie url/slug, or a zt-links url")
    p_dl.add_argument("--quality", help="pick a link by token, e.g. 1080p")
    p_dl.add_argument("--out", default=".", help="download directory (default .)")
    p_dl.add_argument("--browser", help="chrome/edge executable override")
    p_dl.add_argument("--browser-timeout", type=float, default=180.0)
    p_dl.add_argument("--discard-partial", action="store_true")

    # Accept --json on either side of the subcommand; SUPPRESS keeps the
    # subparser from clobbering a value already set by the top-level flag.
    for parser in (p_cards, p_search, p_movie, p_resolve, p_dl):
        parser.add_argument("--json", action="store_true", default=argparse.SUPPRESS)

    args = ap.parse_args(argv)
    client = CineSubz(
        base=args.base, delay=args.delay, timeout=args.timeout, retries=args.retries
    )

    try:
        if args.cmd == "cards":
            cards = list(client.iter_cards(args.pages))
            print(json.dumps([asdict(c) for c in cards], indent=2, ensure_ascii=False)) if args.json else print_cards(cards)
        elif args.cmd == "search":
            cards = client.search(args.query)
            print(json.dumps([asdict(c) for c in cards], indent=2, ensure_ascii=False)) if args.json else print_cards(cards)
        elif args.cmd == "movie":
            if args.resolve:
                detail, links = client.direct_links(args.url_or_slug)
            else:
                detail, links = client.movie(args.url_or_slug), None
            if args.json:
                blob = asdict(detail)
                if links is not None:
                    blob["resolved"] = [asdict(r) for r in links]
                print(json.dumps(blob, indent=2, ensure_ascii=False))
            else:
                print_detail(detail, links)
        elif args.cmd == "resolve":
            res = client.resolve(args.zt_url)
            print(json.dumps(asdict(res), indent=2, ensure_ascii=False)) if args.json else print(f"[{res.kind}] {res.direct_url}")
        elif args.cmd == "download":
            target = args.target
            if "/zt-links/" in target:
                zt_url, referer = target, None
            else:
                detail = client.movie(target)
                picked = detail.links[0]
                if args.quality:
                    needle = args.quality.lower()
                    picked = next(
                        (l for l in detail.links if needle in (l.quality or "").lower()),
                        next((l for l in detail.links if needle in (l.meta or "").lower()), None),
                    )
                    if picked is None:
                        raise RuntimeError(f"no link matching {args.quality!r}; have: "
                                           + ", ".join(l.quality or "?" for l in detail.links))
                zt_url, referer = picked.zt_url, detail.url
                print(f"target  {detail.title}  ->  {picked.quality} {picked.size or ''} {picked.language or ''}".rstrip())
            res = client.resolve(zt_url)
            if not res.resolved:
                raise RuntimeError(f"{res.kind}: {res.direct_url}")
            print(f"hop 1   {res.zt_url}\n       -> {res.direct_url}")
            print("hop 2   browser-gated, handing to Chrome ...", flush=True)
            fetcher = BrowserFetch(
                download_dir=args.out, browser=args.browser,
                timeout=args.browser_timeout, keep_partial=not args.discard_partial,
            )
            got = fetcher.download(res.direct_url, referer=res.zt_url)
            if args.json:
                print(json.dumps(asdict(got), indent=2, ensure_ascii=False))
            else:
                print(f"final   {got.final_url or '(download began without a captured url)'}")
                print(f"saved   {got.saved_path or '(nothing on disk)'}")
                print(f"bytes   {got.bytes_on_disk}  state={got.state}  complete={got.complete}")
                if got.saved_path and not got.complete:
                    print("note    partial save; raise --browser-timeout for the whole file")
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
