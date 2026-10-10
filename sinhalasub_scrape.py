#!/usr/bin/env python3
"""
Scrape SinhalaSub.LK movies.

Collects for every movie:
  - backdrop banner + poster image
  - full details (title, year, language, quality, IMDb, duration, genres,
    country, director, stars, subtitle site, rating, posted date)
  - description / synopsis
  - ONE-CLICK DIRECT download links (real .mp4 file URLs, no redirect page,
    no "verify 3 steps" wall) filtered to files >= --min-size (default 1 GB)

How the direct link is obtained:
  The movie page lists rows like  <a href='https://sinhalasub.lk/links/xyz123/'>
  That short URL is a "link unlocker" page which embeds the real file URL in:
      <script>var zluFinalLink = 'https://cdn.sinhalasub.net/.../Movie_1080p.mp4';</script>
  The 3 "verify" buttons in that page are pure client-side timers (ad clicks) --
  they never gate the URL, so we read it straight out of the HTML.
  We then HEAD-request the file URL to confirm it really is a downloadable file
  (Content-Disposition: attachment) and to learn the exact byte size.

Outputs (default dir: sinhalasub/):
  movies.json   - full records
  movies.csv    - flat table
  gallery.html  - browsable page, one card per movie, big DOWNLOAD buttons

Usage:
  python3 sinhalasub_scrape.py                      # pages 1..5
  python3 sinhalasub_scrape.py --pages 1-20
  python3 sinhalasub_scrape.py --page 3
  python3 sinhalasub_scrape.py --all                # every page (169 pages!)
  python3 sinhalasub_scrape.py --min-size 2GB --language english
  python3 sinhalasub_scrape.py --no-verify          # skip HEAD requests (faster)
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://sinhalasub.lk"
LIST_URL = f"{BASE}/movies/"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# hosts we know serve a real file with Content-Disposition: attachment
DIRECT_HOSTS = ("cdn.sinhalasub.net", "ddl.sinhalasub.net")
FILE_EXT_RE = re.compile(r"\.(mp4|mkv|avi|webm|m4v|ts)(\?|$)", re.I)
FINAL_LINK_RE = re.compile(r"var\s+zluFinalLink\s*=\s*['\"](.*?)['\"]\s*;")

session = requests.Session()
session.headers.update(
    {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": BASE + "/",
    }
)


def get(url: str, tries: int = 3, timeout: int = 20) -> str | None:
    for attempt in range(1, tries + 1):
        try:
            r = session.get(url, timeout=timeout)
            if r.status_code == 200:
                return r.text
            if r.status_code in (404, 410):
                return None
        except requests.RequestException as exc:
            if attempt == tries:
                print(f"  ! GET {url} failed: {exc}", file=sys.stderr)
                return None
        time.sleep(1.2 * attempt)
    return None


# ---------------------------------------------------------------- size utils
def parse_size(text: str | None) -> int | None:
    """'3.39 GB' -> 3642090000-ish (bytes)."""
    if not text:
        return None
    m = re.match(r"([\d.,]+)\s*(B|KB|MB|GB|TB)", text.strip(), re.I)
    if not m:
        return None
    num = float(m.group(1).replace(",", ""))
    unit = m.group(2).upper()
    mult = {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3, "TB": 1024**4}[unit]
    return int(num * mult)


def human_size(n: int | None) -> str:
    if n is None:
        return "?"
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.2f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024
    return f"{n:.2f} TB"


# --------------------------------------------------------------- list pages
def max_page() -> int:
    """Binary-search the last /movies/page/N/ that exists."""
    lo, hi = 1, 2
    while True:
        try:
            r = session.head(f"{LIST_URL}page/{hi}/", timeout=15, allow_redirects=True)
        except requests.RequestException:
            return hi - 1
        if r.status_code != 200:
            break
        lo, hi = hi, hi * 2
        if hi > 5000:
            return hi
    while hi - lo > 1:
        mid = (lo + hi) // 2
        try:
            r = session.head(f"{LIST_URL}page/{mid}/", timeout=15, allow_redirects=True)
            ok = r.status_code == 200
        except requests.RequestException:
            ok = False
        if ok:
            lo = mid
        else:
            hi = mid
    return lo


def parse_list_page(page_html: str) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    out: list[dict] = []
    seen: set[str] = set()
    for a in soup.select("a[href*='/movies/']"):
        href = (a.get("href") or "").strip()
        m = re.match(r"https?://sinhalasub\.lk/movies/([a-z0-9\-]{6,})/$", href)
        if not m:
            continue
        slug = m.group(1)
        if slug in seen:
            continue
        seen.add(slug)
        title = (a.get("title") or "").strip()
        if not title:
            h3 = a.find(["h3", "span"])
            title = h3.get_text(" ", strip=True) if h3 else slug
        img = a.find("img")
        poster = ""
        if img:
            poster = (img.get("src") or img.get("data-original") or "").strip()
        out.append({"slug": slug, "url": href, "title": title, "poster": poster})
    return out


# -------------------------------------------------------------- movie pages
def _txt(node) -> str:
    return node.get_text(" ", strip=True) if node else ""


def parse_movie_page(page_html: str, url: str) -> dict:
    soup = BeautifulSoup(page_html, "html.parser")

    # ---- banner / poster ------------------------------------------------
    backdrop = ""
    og = soup.find("meta", attrs={"property": "og:image"})
    if og and og.get("content"):
        backdrop = og["content"].strip().split("?")[0]
    poster = ""
    p = soup.select_one("img.poster-img")
    if p:
        poster = (p.get("src") or "").strip()
    # ask TMDB's CDN for a bigger version of both (w154/w185 -> w780)
    backdrop = re.sub(r"/t/p/w\d+/", "/t/p/w1280/", backdrop)
    poster = re.sub(r"/t/p/w\d+/", "/t/p/w780/", poster)

    # ---- title / basics -------------------------------------------------
    title = _txt(soup.select_one(".details-title h3")) or _txt(soup.select_one("h1"))

    quality = _txt(soup.select_one(".details-data .data-quality"))
    language = _txt(soup.select_one(".details-data .data-language"))
    duration = _txt(soup.select_one(".details-data [itemprop='duration']")) or _txt(
        soup.select_one(".details-data .data-views")
    )
    imdb = ""
    imdb_el = soup.select_one(".details-data .data-imdb")
    if imdb_el:
        m = re.search(r"IMDb[:\s]*([\d.]+)", imdb_el.get_text(" ", strip=True))
        if m:
            imdb = m.group(1)

    rating = _txt(soup.select_one("[itemprop='ratingValue']"))
    votes = _txt(soup.select_one("[itemprop='ratingCount']"))
    tagline = _txt(soup.select_one(".details-tag"))
    posted = ""
    dc = soup.find("meta", attrs={"itemprop": "dateCreated"})
    if dc and dc.get("content"):
        posted = dc["content"].strip()

    genres = [a.get_text(strip=True) for a in soup.select(".details-genre a")]

    # ---- description ----------------------------------------------------
    desc_el = soup.select_one(".details-desc")
    description = ""
    if desc_el:
        for bad in desc_el.select("script, style"):
            bad.decompose()
        description = re.sub(r"\s+", " ", desc_el.get_text(" ", strip=True)).strip()

    # ---- structured info block (Language / Country / Director / Stars / Year)
    info: dict[str, list[str]] = {}
    for p_el in soup.select(".details-info p"):
        strong = p_el.find("strong")
        if not strong:
            continue
        key = strong.get_text(" ", strip=True).rstrip(":").strip()
        vals = [a.get_text(strip=True) for a in p_el.find_all("a")]
        if not vals:
            rest = p_el.get_text(" ", strip=True)
            rest = rest.replace(strong.get_text(strip=True), "", 1).strip(" :")
            vals = [rest] if rest else []
        if vals:
            info[key] = vals

    # ---- download link rows --------------------------------------------
    links: list[dict] = []
    for table in soup.select("#links table.links-table"):
        server = (table.get("id") or "").strip()
        for tr in table.select("tbody tr"):
            a = tr.select_one("td .link-opt a[href]")
            if not a:
                continue
            short = urljoin(BASE, a["href"].strip())
            quality_cell = _txt(tr.select_one("td span.quality")) or _txt(
                tr.select("td")[1] if len(tr.select("td")) > 1 else None
            )
            size_cell = _txt(tr.select("td")[-1]) if tr.select("td") else ""
            links.append(
                {
                    "server": server or a.get_text(strip=True) or "unknown",
                    "quality": quality_cell,
                    "size_label": size_cell,
                    "size_bytes": parse_size(size_cell),
                    "short_url": short,
                    "direct_url": None,
                }
            )

    return {
        "title": title,
        "url": url,
        "backdrop": backdrop or None,
        "poster": poster or None,
        "quality": quality or None,
        "language": language or None,
        "imdb": imdb or None,
        "duration": duration or None,
        "rating": rating or None,
        "votes": votes or None,
        "tagline": tagline or None,
        "posted_date": posted or None,
        "genres": genres,
        "description": description,
        "info": info,
        "download_links": links,
    }


# --------------------------------------------------------- direct link step
def load_cache(path: Path) -> dict:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            pass
    return {}


def save_cache(path: Path, cache: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")


def resolve_direct(short_url: str) -> str | None:
    """Fetch the unlocker page and pull the real file URL out of it."""
    page = get(short_url)
    if not page:
        return None
    m = FINAL_LINK_RE.search(page)
    if not m:
        return None
    return m.group(1).strip()


def head_file(url: str) -> dict:
    """Confirm the URL is a real one-click file download and get its size."""
    out: dict = {"direct_url": url, "ok": False, "bytes": None, "filename": None, "reason": None}
    try:
        r = session.head(url, timeout=25, allow_redirects=True)
    except requests.RequestException as exc:
        out["reason"] = f"head failed: {exc}"
        return out

    final = r.url
    cd = r.headers.get("Content-Disposition", "")
    clen = r.headers.get("Content-Length")
    ctype = r.headers.get("Content-Type", "")

    if r.status_code >= 400:
        out["reason"] = f"HTTP {r.status_code}"
        return out
    # a redirect to an HTML page means this is NOT a one-click file
    if final.rstrip("/") != url.rstrip("/") and not FILE_EXT_RE.search(final):
        out["reason"] = f"redirects to {final}"
        return out
    if "text/html" in ctype and not FILE_EXT_RE.search(final):
        out["reason"] = f"content-type {ctype}"
        return out

    out["direct_url"] = final
    out["bytes"] = int(clen) if clen and clen.isdigit() else None
    m = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", cd)
    if m:
        out["filename"] = m.group(1).strip()
    out["ok"] = True
    return out


def resolve_one(short: str, args, cache: dict) -> dict:
    """Resolve one short link -> verified one-click file info (thread worker).

    Results land in the shared `cache` dict (keyed by short URL); the caller
    persists the cache after the pool drains.
    """
    if short in cache:
        return cache[short]
    direct = resolve_direct(short)
    if not direct:
        info = {"ok": False, "reason": "no final link"}
    elif args.no_verify:
        info = {"ok": True, "direct_url": direct, "bytes": None, "filename": None}
    else:
        info = head_file(direct)
    cache[short] = info
    return info


def collect_direct_links(rec: dict, args, cache: dict) -> None:
    """Attach resolved direct URLs to a movie and filter to >= min-size."""
    links = rec.get("download_links") or []

    for ln in links:
        info = cache.get(ln["short_url"]) or {}
        ln["direct_url"] = info.get("direct_url") if info.get("ok") else None
        ln["bytes"] = info.get("bytes") or ln.get("size_bytes")
        ln["filename"] = info.get("filename")
        ln["ok"] = bool(info.get("ok"))
        if not info.get("ok"):
            ln["error"] = info.get("reason")

    # keep only verified, one-click, big enough files
    min_bytes = args.min_size
    good = [
        ln
        for ln in links
        if ln.get("ok")
        and ln.get("direct_url")
        and (ln.get("bytes") or 0) >= min_bytes
    ]
    # de-duplicate identical direct URLs, keep the largest-quality label first
    seen: set[str] = set()
    uniq = []
    for ln in sorted(good, key=lambda x: -(x.get("bytes") or 0)):
        key = ln["direct_url"].split("?")[0]
        if key in seen:
            continue
        seen.add(key)
        uniq.append(ln)

    rec["download_links"] = uniq
    rec["has_direct_download"] = bool(uniq)
    rec["largest_file_bytes"] = max((ln.get("bytes") or 0 for ln in uniq), default=0) or None


# ------------------------------------------------------------------ pipeline
def scrape(args) -> list[dict]:
    if args.all:
        total = max_page()
        pages = list(range(1, total + 1))
    elif args.page:
        pages = [args.page]
    elif args.pages:
        lo, hi = (int(x) for x in args.pages.split("-"))
        pages = list(range(lo, hi + 1))
    else:
        pages = [1, 2, 3, 4, 5]

    print(f"List pages: {pages[0]}..{pages[-1]} ({len(pages)} pages)")

    items: list[dict] = []
    for n in pages:
        url = LIST_URL if n == 1 else f"{LIST_URL}page/{n}/"
        page_html = get(url)
        if not page_html:
            print(f"  ! list page {n} unavailable", file=sys.stderr)
            continue
        batch = parse_list_page(page_html)
        print(f"  page {n}: {len(batch)} movies")
        items.extend(batch)
        if n != pages[-1]:
            time.sleep(args.delay)

    seen: set[str] = set()
    unique = []
    for it in items:
        if it["url"] in seen:
            continue
        seen.add(it["url"])
        unique.append(it)
    print(f"Unique movies: {len(unique)}")

    if args.language:
        unique = [u for u in unique if args.language.lower() in u["url"].lower()]
        print(f"After language filter '{args.language}': {len(unique)}")
    if args.limit:
        unique = unique[: args.limit]
        print(f"Limited to first {len(unique)}")

    # ---- pass 1: movie detail pages
    records: list[dict] = []

    def detail(item: dict) -> dict:
        page_html = get(item["url"])
        if not page_html:
            return {**item, "description": "", "genres": [], "info": {}, "download_links": []}
        rec = parse_movie_page(page_html, item["url"])
        if not rec.get("title"):
            rec["title"] = item["title"]
        if not rec.get("poster"):
            rec["poster"] = item.get("poster")
        return rec

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futs = {pool.submit(detail, it): it for it in unique}
        done = 0
        for fut in as_completed(futs):
            records.append(fut.result())
            done += 1
            if done % 20 == 0 or done == len(unique):
                print(f"  details {done}/{len(unique)}")

    # ---- pass 2: resolve one-click direct links (flat global pool)
    shorts: list[str] = []
    seen_short: set[str] = set()
    for r in records:
        for ln in (r.get("download_links") or []):
            s = ln["short_url"]
            if s not in seen_short:
                seen_short.add(s)
                shorts.append(s)

    cache_path = Path(args.outdir) / ".link_cache.json"
    cache = load_cache(cache_path)
    todo = [s for s in shorts if s not in cache]
    print(
        f"Resolving {len(shorts)} download links ({len(todo)} new, "
        f"{len(shorts) - len(todo)} cached) -> direct file URLs ..."
    )
    if todo:
        done = 0
        with ThreadPoolExecutor(max_workers=args.workers * 2) as pool:
            futs = {pool.submit(resolve_one, s, args, cache): s for s in todo}
            for fut in as_completed(futs):
                fut.result()
                done += 1
                if done % 25 == 0 or done == len(todo):
                    print(f"  resolved {done}/{len(todo)}")
                    save_cache(cache_path, cache)
        save_cache(cache_path, cache)

    for r in records:
        collect_direct_links(r, args, cache)

    records.sort(key=lambda r: -(r.get("largest_file_bytes") or 0))
    return records


# ------------------------------------------------------------------- outputs
def write_outputs(records: list[dict], outdir: Path) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    (outdir / "movies.json").write_text(
        json.dumps(
            {"source": LIST_URL, "scraped_at": stamp, "count": len(records), "movies": records},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    fields = [
        "title", "language", "quality", "year", "imdb", "duration", "genres",
        "posted_date", "description", "backdrop", "poster", "url",
        "best_server", "best_quality", "file_size", "file_size_bytes",
        "direct_download", "all_downloads",
    ]
    with (outdir / "movies.csv").open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in records:
            best = (r.get("download_links") or [{}])[0]
            row = {
                "title": r.get("title"),
                "language": r.get("language"),
                "quality": r.get("quality"),
                "year": (r.get("info") or {}).get("Year", [""])[0] if r.get("info") else "",
                "imdb": r.get("imdb"),
                "duration": r.get("duration"),
                "genres": ", ".join(r.get("genres") or []),
                "posted_date": r.get("posted_date"),
                "description": r.get("description"),
                "backdrop": r.get("backdrop"),
                "poster": r.get("poster"),
                "url": r.get("url"),
                "best_server": best.get("server"),
                "best_quality": best.get("quality"),
                "file_size": human_size(best.get("bytes")),
                "file_size_bytes": best.get("bytes"),
                "direct_download": best.get("direct_url"),
                "all_downloads": " | ".join(
                    f"{l.get('quality')} {human_size(l.get('bytes'))} {l.get('direct_url')}"
                    for l in (r.get("download_links") or [])
                ),
            }
            w.writerow(row)

    # ---- gallery
    cards = []
    for i, r in enumerate(records, 1):
        links = r.get("download_links") or []
        banner = r.get("backdrop") or r.get("poster") or ""
        poster = r.get("poster") or banner
        info = r.get("info") or {}
        genres = ", ".join(r.get("genres") or [])

        btns = []
        for ln in links[:4]:
            btns.append(
                f'<a class="dl" href="{html.escape(ln["direct_url"])}" download '
                f'target="_blank" rel="noopener">'
                f'{html.escape(ln.get("quality") or "FILE")} &middot; '
                f'{human_size(ln.get("bytes"))} &middot; {html.escape(ln.get("server") or "")}</a>'
            )
        if not btns:
            btns.append('<span class="no-dl">No direct download &ge; 1 GB found</span>')

        def kv(k):
            v = info.get(k)
            return html.escape(", ".join(v)) if v else ""

        cards.append(f"""
    <article class="card">
      <div class="banner">
        <img src="{html.escape(banner)}" alt="" loading="lazy"
             onerror="this.style.display='none'">
        <img class="poster" src="{html.escape(poster)}" alt="" loading="lazy"
             onerror="this.style.display='none'">
        <span class="badge">#{i}</span>
      </div>
      <div class="body">
        <h2>{html.escape(r.get('title') or 'Untitled')}</h2>
        <p class="meta">
          {html.escape(r.get('language') or '')} &middot; {html.escape(r.get('quality') or '')}
          &middot; {html.escape(r.get('duration') or '')}
          &middot; IMDb {html.escape(r.get('imdb') or 'n/a')}
          &middot; <a href="{html.escape(r.get('url') or '#')}" target="_blank" rel="noopener">source</a>
        </p>
        <p class="meta2">
          {f'<b>Genres:</b> {genres}' if genres else ''}
          {f' &middot; <b>Year:</b> {kv("Year")}' if kv("Year") else ''}
          {f' &middot; <b>Country:</b> {kv("Country")}' if kv("Country") else ''}
        </p>
        {f'<p class="meta2"><b>Director:</b> {kv("Director")}<br><b>Stars:</b> {kv("Stars")}</p>' if kv("Director") or kv("Stars") else ''}
        <p class="desc">{html.escape(r.get('description') or '')}</p>
        <div class="dls">{"".join(btns)}</div>
      </div>
    </article>""")

    page = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SinhalaSub.LK &mdash; {len(records)} movies with direct downloads</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{ margin:0; font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
         background:#0d0f14; color:#e7e9ee; }}
  header {{ padding:28px 24px 10px; max-width:1280px; margin:0 auto; }}
  header h1 {{ margin:0 0 6px; font-size:26px; }}
  header p {{ margin:0; color:#98a2b3; }}
  main {{ max-width:1280px; margin:0 auto; padding:18px 24px 60px;
          display:grid; gap:18px; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); }}
  .card {{ background:#141821; border:1px solid #232733; border-radius:12px; overflow:hidden;
           display:flex; flex-direction:column; }}
  .banner {{ position:relative; aspect-ratio:16/7; background:#000; }}
  .banner > img {{ width:100%; height:100%; object-fit:cover; display:block; opacity:.65; }}
  .banner .poster {{ position:absolute; left:14px; bottom:-28px; width:88px; border-radius:8px;
        box-shadow:0 8px 24px rgba(0,0,0,.7); opacity:1; aspect-ratio:2/3; object-fit:cover; }}
  .badge {{ position:absolute; top:8px; left:8px; background:rgba(0,0,0,.7);
            color:#fff; font-size:11px; padding:2px 7px; border-radius:999px; }}
  .body {{ padding:38px 14px 14px; display:flex; flex-direction:column; flex:1; }}
  .card h2 {{ font-size:16px; margin:0 0 6px; line-height:1.35; }}
  .meta {{ margin:0 0 4px; font-size:12.5px; color:#8b93a5; }}
  .meta a {{ color:#6ea8fe; text-decoration:none; }}
  .meta2 {{ margin:0 0 4px; font-size:12.5px; color:#a6adbb; }}
  .desc {{ margin:8px 0 12px; font-size:13.5px; color:#c3c9d6; flex:1; }}
  .dls {{ display:flex; flex-wrap:wrap; gap:8px; }}
  .dl {{ display:inline-block; background:linear-gradient(135deg,#e50914,#a90000); color:#fff;
        font-size:13px; font-weight:600; padding:9px 14px; border-radius:8px;
        text-decoration:none; transition:.15s; }}
  .dl:hover {{ transform:translateY(-1px); box-shadow:0 6px 18px rgba(229,9,20,.35); }}
  .no-dl {{ color:#7c8496; font-size:13px; font-style:italic; }}
</style></head>
<body>
  <header>
    <h1>SinhalaSub.LK &mdash; Direct Downloads</h1>
    <p>{len(records)} movies &middot; one-click direct .mp4 links (no redirect, no verify wall)
       &middot; scraped {html.escape(stamp)}</p>
  </header>
  <main>{''.join(cards)}
  </main>
</body></html>"""
    (outdir / "gallery.html").write_text(page, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description="Scrape SinhalaSub.LK for one-click direct downloads")
    ap.add_argument("--page", type=int, help="single list page")
    ap.add_argument("--pages", help="page range, e.g. 1-20")
    ap.add_argument("--all", action="store_true", help="every page on the site")
    ap.add_argument("--limit", type=int, help="only first N movies")
    ap.add_argument("--language", help="substring filter on the URL, e.g. english")
    ap.add_argument("--min-size", type=parse_size, default=1024**3, help="e.g. 500MB, 2GB (default 1GB)")
    ap.add_argument("--outdir", default="sinhalasub")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--delay", type=float, default=0.4, help="pause between list page fetches")
    ap.add_argument("--no-verify", action="store_true", help="skip HEAD requests (trust listed size)")
    args = ap.parse_args()

    print(f"Minimum file size: {human_size(args.min_size)}")
    started = time.time()
    records = scrape(args)
    if not records:
        print("No records found.", file=sys.stderr)
        sys.exit(1)

    with_links = [r for r in records if r.get("has_direct_download")]
    write_outputs(records, Path(args.outdir))
    print(f"\nWrote {len(records)} movies ({len(with_links)} with >=1GB direct download) to {args.outdir}/")
    print(f"  movies.json, movies.csv, gallery.html")
    print(f"Elapsed {time.time() - started:.1f}s")


if __name__ == "__main__":
    main()
