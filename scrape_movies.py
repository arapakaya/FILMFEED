#!/usr/bin/env python3
"""
Scrape LakvisionTV playlist "Sinhala Dubbed Children's Movies" (more.php?list=1002).

Collects for every movie:
  - banner / thumbnail image
  - title
  - details (watch URL, views, posted date, page number, hosting provider)
  - description text from the watch page "About" tab

Outputs:
  scraped_movies/movies.json
  scraped_movies/movies.csv
  scraped_movies/gallery.html   (banners + details + description, one card per movie)

Usage:
  python3 scrape_movies.py                 # all 19 pages
  python3 scrape_movies.py --pages 1-3     # only pages 1..3
  python3 scrape_movies.py --page 1        # only page 1
  python3 scrape_movies.py --no-embeds     # skip embed.php lookups (faster)
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
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://lakvisiontv.net"
LIST_URL = f"{BASE}/more.php?list=1002"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

session = requests.Session()
session.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})


def get(url: str, tries: int = 3, timeout: int = 15) -> str | None:
    """GET with retries. Returns text or None."""
    for attempt in range(1, tries + 1):
        try:
            r = session.get(url, timeout=timeout)
            if r.status_code == 200:
                return r.text
            if r.status_code in (404, 410):
                return None
        except requests.RequestException as exc:
            if attempt == tries:
                print(f"  ! {url} failed: {exc}", file=sys.stderr)
                return None
        time.sleep(1.5 * attempt)
    return None


# ---------------------------------------------------------------- list pages

def max_page(soup: BeautifulSoup) -> int:
    pages = []
    for a in soup.select(".lakvision-tv-pagination-bar a[href]"):
        m = re.search(r"[?&]i=(\d+)", a.get("href", ""))
        if m:
            pages.append(int(m.group(1)))
    return max(pages) if pages else 1


def parse_list_page(page_html: str, page_no: int) -> list[dict]:
    soup = BeautifulSoup(page_html, "html.parser")
    out = []
    for cell in soup.select("div.lakvision-tv-inner-video-cell"):
        link = cell.select_one(".lakvision-tv-inner-video-thumb a[href]")
        img = cell.select_one(".lakvision-tv-inner-video-thumb img")
        title_a = cell.select_one(".lakvision-tv-inner-video-cell-title a")
        info = cell.select_one(".lakvision-tv-cell-info")

        if not link:
            continue

        title = (title_a.get("title") or title_a.get_text(" ", strip=True) if title_a else "").strip()
        if not title:
            title = (link.get("title") or "").strip()

        views = None
        if info:
            m = re.search(r"([\d,]+)\s+views", info.get_text(" ", strip=True))
            if m:
                views = int(m.group(1).replace(",", ""))

        out.append(
            {
                "title": title,
                "banner": (img.get("src") or "").strip() or None,
                "watch_url": urljoin(BASE, link.get("href")),
                "views": views,
                "list_page": page_no,
            }
        )
    return out


# --------------------------------------------------------------- watch pages

def detail_url(watch_url: str) -> str:
    """Same watch page, but fetched from the fast first-party host.

    The playlist links point at mirror domains (lakvisioncartoons.in,
    ginisisilacartoon.net) which serve identical id-based pages; lakvisiontv.net
    answers ~3x faster.
    """
    return re.sub(r"^https?://[^/]+", BASE, watch_url)

def parse_watch_page(page_html: str, fallback_title: str, watch_url: str) -> dict:
    soup = BeautifulSoup(page_html, "html.parser")

    h1 = soup.select_one("#lakvision-tv-watch-video-title h1")
    title = h1.get_text(" ", strip=True) if h1 else fallback_title

    view_el = soup.select_one(".lakvision-tv-view-count")
    views = None
    if view_el:
        m = re.search(r"([\d,]+)", view_el.get_text(" ", strip=True))
        if m:
            views = int(m.group(1).replace(",", ""))

    about = soup.select_one("#lakvision-tv-video-about")
    description = ""
    has_synopsis = False
    posted = None
    if about:
        p = about.find("p")
        if p:
            posted_match = re.search(
                r"Posted by\s+(.+?)\s+on\s+(.+?)\. Hosted on the Internet\.", p.get_text(" ", strip=True)
            )
            if posted_match:
                posted = posted_match.group(2).strip()

        # The real synopsis lives in #video-information as "About Video: ..."
        info = about.select_one("#video-information")
        if info:
            description = info.get_text("\n", strip=True)
            description = re.sub(r"^About Video:\s*", "", description)
            description = re.sub(r"\s+", " ", description).strip()
            has_synopsis = bool(description)
        if not description and p:
            # site's default About line when no synopsis was written
            description = p.get_text(" ", strip=True)

    embed_iframe = soup.select_one("#player iframe[src]")
    embed_url = urljoin(BASE, embed_iframe["src"]) if embed_iframe else None

    return {
        "title": title,
        "views": views,
        "description": description,
        "has_synopsis": has_synopsis,
        "posted_date": posted,
        "embed_page": embed_url,
        "canonical_url": watch_url,
    }


def embed_host(embed_page_url: str | None) -> tuple[str | None, str | None]:
    """Resolve embed.php -> (provider, absolute player URL)."""
    if not embed_page_url:
        return None, None
    html_text = get(embed_page_url)
    if not html_text:
        return None, None
    soup = BeautifulSoup(html_text, "html.parser")
    iframe = soup.find("iframe", src=True)
    if not iframe:
        # direct file embed?
        m = re.search(r"""(?:file|src)\s*:\s*['"]([^'"]+)""", html_text)
        if m and re.search(r"\.(mp4|mkv|webm|m3u8)(\?|$)", m.group(1), re.I):
            return "direct-file", m.group(1)
        return None, None
    # resolve protocol-relative (//host/...) and relative (/player.php) sources
    src = urljoin(embed_page_url, iframe["src"].strip())
    host = urlparse(src).netloc or urlparse("https:" + src).netloc
    host = re.sub(r"^www\.", "", host)
    return host or None, src


# ------------------------------------------------------------------ pipeline

def scrape(args) -> list[dict]:
    first = get(LIST_URL)
    if not first:
        print("Could not load the list page.", file=sys.stderr)
        sys.exit(1)

    total_pages = max_page(BeautifulSoup(first, "html.parser"))

    if args.page:
        pages = [args.page]
    elif args.pages:
        lo, hi = (int(x) for x in args.pages.split("-"))
        pages = list(range(lo, hi + 1))
    else:
        pages = list(range(1, total_pages + 1))

    print(f"Playlist pages to scrape: {pages[0]}..{pages[-1]} (site reports {total_pages})")

    items: list[dict] = []
    for n in pages:
        html_text = first if n == 1 else get(f"{LIST_URL}&i={n}")
        if not html_text:
            print(f"  ! page {n} unavailable", file=sys.stderr)
            continue
        batch = parse_list_page(html_text, n)
        print(f"  page {n}: {len(batch)} movies")
        items.extend(batch)
        if n != pages[-1]:
            time.sleep(args.delay)

    # de-duplicate by watch URL, keeping first occurrence
    seen: set[str] = set()
    unique = []
    for it in items:
        if it["watch_url"] in seen:
            continue
        seen.add(it["watch_url"])
        unique.append(it)
    print(f"Total unique movies: {len(unique)}")

    def work(item: dict) -> dict:
        detail = None
        page_html = get(detail_url(item["watch_url"]))
        if page_html:
            detail = parse_watch_page(page_html, item["title"], item["watch_url"])
        rec = dict(item)
        if detail:
            rec["title"] = detail["title"] or item["title"]
            rec["views"] = detail["views"] if detail["views"] is not None else item["views"]
            rec["description"] = detail["description"]
            rec["has_synopsis"] = detail["has_synopsis"]
            rec["posted_date"] = detail["posted_date"]
            embed_page = detail["embed_page"]
        else:
            rec["description"] = ""
            rec["has_synopsis"] = False
            rec["posted_date"] = None
            embed_page = None
        rec["watch_page"] = item["watch_url"]
        rec["embed_page"] = embed_page
        if not args.no_embeds:
            provider, direct = embed_host(embed_page)
            rec["host"] = provider
            rec["embed_url"] = direct
        rec.pop("watch_url", None)
        return rec

    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(work, it): it for it in unique}
        done = 0
        for fut in as_completed(futures):
            results.append(fut.result())
            done += 1
            if done % 25 == 0 or done == len(unique):
                print(f"  detail {done}/{len(unique)}")

    # second/third pass for anything that failed or came back incomplete
    for attempt in (1, 2, 3):
        bad = [
            r
            for r in results
            if not (r.get("description") or "").strip()
            or (not args.no_embeds and (r.get("host") is None or r.get("embed_url") is None))
        ]
        if not bad:
            break
        print(f"  retry pass {attempt}: {len(bad)} incomplete records")
        fixed = 0
        for item in bad:
            page_html = get(detail_url(item["watch_page"]))
            if page_html:
                detail = parse_watch_page(page_html, item["title"], item["watch_page"])
                if detail["description"]:
                    item["description"] = detail["description"]
                item["has_synopsis"] = detail["has_synopsis"]
                if detail["views"] is not None:
                    item["views"] = detail["views"]
                if detail["posted_date"]:
                    item["posted_date"] = detail["posted_date"]
                if detail["title"]:
                    item["title"] = detail["title"]
                if detail["embed_page"]:
                    item["embed_page"] = detail["embed_page"]
            if not args.no_embeds and (item.get("host") is None or item.get("embed_url") is None):
                provider, direct = embed_host(item.get("embed_page"))
                if provider:
                    item["host"] = provider
                    item["embed_url"] = direct
            fixed += 1
            time.sleep(0.2)
        print(f"  retry pass {attempt}: re-checked {fixed}")

    results.sort(key=lambda r: (r.get("list_page", 0), -(r.get("views") or 0)))
    return results


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

    fields = ["title", "banner", "description", "has_synopsis", "posted_date", "views", "list_page", "watch_page", "embed_page", "host", "embed_url"]
    with (outdir / "movies.csv").open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)

    cards = []
    for i, r in enumerate(records, 1):
        banner = r.get("banner") or ""
        desc = r.get("description") or "No description provided by the site."
        host = r.get("host") or "unknown host"
        desc_cls = "desc" if r.get("has_synopsis") else "desc site-note"
        cards.append(
            f"""
    <article class="card">
      <a class="banner" href="{html.escape(r.get('watch_page') or '#')}" target="_blank" rel="noopener">
        <img src="{html.escape(banner)}" alt="{html.escape(r['title'])}" loading="lazy"
             onerror="this.style.display='none';this.parentNode.classList.add('missing')">
        <span class="badge">#{i}</span>
      </a>
      <h2>{html.escape(r['title'])}</h2>
      <p class="meta">{r.get('views') or 0} views &middot; posted {html.escape(r.get('posted_date') or 'n/a')} &middot; playlist page {r.get('list_page')}</p>
      <p class="{desc_cls}">{html.escape(desc)}</p>
      <p class="links">
        <a href="{html.escape(r.get('watch_page') or '#')}" target="_blank" rel="noopener">Watch page</a>
        {f'&middot; <a href="{html.escape(r.get("embed_url") or "#")}" target="_blank" rel="noopener">Player source ({html.escape(host)})</a>' if r.get('embed_url') else ''}
      </p>
    </article>"""
        )

    page = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sinhala Dubbed Children's Movies &mdash; {len(records)} titles</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{ margin:0; font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
         background:#0f1115; color:#e7e9ee; }}
  header {{ padding:28px 24px 10px; max-width:1200px; margin:0 auto; }}
  header h1 {{ margin:0 0 6px; font-size:26px; }}
  header p {{ margin:0; color:#98a2b3; }}
  main {{ max-width:1200px; margin:0 auto; padding:18px 24px 60px;
          display:grid; gap:18px; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); }}
  .card {{ background:#171a21; border:1px solid #232733; border-radius:12px; overflow:hidden;
           display:flex; flex-direction:column; }}
  .banner {{ position:relative; display:block; aspect-ratio:16/9; background:#000; }}
  .banner img {{ width:100%; height:100%; object-fit:cover; display:block; }}
  .banner.missing::after {{ content:"No banner"; position:absolute; inset:0; display:grid;
        place-items:center; color:#5b6270; font-size:13px; }}
  .badge {{ position:absolute; top:8px; left:8px; background:rgba(0,0,0,.7);
            color:#fff; font-size:11px; padding:2px 7px; border-radius:999px; }}
  .card h2 {{ font-size:16px; margin:12px 14px 4px; line-height:1.35; }}
  .meta {{ margin:0 14px; font-size:12.5px; color:#8b93a5; }}
  .desc {{ margin:10px 14px; font-size:13.5px; color:#c3c9d6; flex:1; }}
  .desc.site-note {{ color:#7c8496; font-style:italic; }}
  .links {{ margin:0 14px 14px; font-size:13px; }}
  .links a {{ color:#6ea8fe; text-decoration:none; }}
  .links a:hover {{ text-decoration:underline; }}
</style></head>
<body>
  <header>
    <h1>Sinhala Dubbed Children's Movies</h1>
    <p>Scraped from {html.escape(LIST_URL)} &middot; {len(records)} titles &middot; {html.escape(stamp)}</p>
  </header>
  <main>{''.join(cards)}
  </main>
</body></html>"""
    (outdir / "gallery.html").write_text(page, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description="Scrape LakvisionTV playlist 1002")
    ap.add_argument("--page", type=int, help="scrape a single list page")
    ap.add_argument("--pages", help="scrape a page range, e.g. 1-5")
    ap.add_argument("--outdir", default="scraped_movies")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--delay", type=float, default=0.5, help="pause between list page fetches")
    ap.add_argument("--no-embeds", action="store_true", help="skip resolving embed.php sources")
    args = ap.parse_args()

    started = time.time()
    records = scrape(args)
    if not records:
        print("No records found.", file=sys.stderr)
        sys.exit(1)
    write_outputs(records, Path(args.outdir))
    print(f"\nWrote {len(records)} movies to {args.outdir}/ (movies.json, movies.csv, gallery.html)")
    print(f"Elapsed {time.time() - started:.1f}s")


if __name__ == "__main__":
    main()
