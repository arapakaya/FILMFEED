#!/usr/bin/env python3
"""
Movie and TV Series Search & Direct Link Resolver for FilmFeed WhatsApp Bot
Searches CineSubz, SinhalaSub, and other sources, and returns full metadata
including direct download link, size, poster, and description.
"""

import sys
import os
import json
import re
import urllib.request
import urllib.parse
from bs4 import BeautifulSoup

# Ensure parent directory is in path to access resolver.py if needed
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

try:
    import resolver
except ImportError:
    from .. import resolver

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

def search_cinesubz(query):
    """Search CineSubz for movies and TV series"""
    try:
        search_url = f"https://cinesubz.co/?s={urllib.parse.quote_plus(query)}"
        req = urllib.request.Request(search_url, headers={"User-Agent": UA})
        html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
        soup = BeautifulSoup(html, "html.parser")

        results = []
        for box in soup.select("div.display-item, article, div.result-item"):
            a = box.select_one("a[href]")
            img = box.select_one("img")
            title_el = box.select_one("h3, h2, .title, .entry-title")
            if a:
                title = title_el.get_text(strip=True) if title_el else a.get("title", "")
                href = a.get("href")
                poster = (
                    img.get("src") or img.get("data-src") or img.get("data-original")
                    if img
                    else None
                )
                if href and title:
                    results.append({"title": title, "url": href, "poster": poster})
        return results
    except Exception as e:
        sys.stderr.write(f"Cinesubz search error: {e}\n")
        return []

def parse_size_bytes(size_text):
    """Convert size text like '1.2 GB' or '850 MB' to bytes"""
    if not size_text:
        return 0
    m = re.search(r"([\d.,]+)\s*(GB|MB|KB|TB|B)", size_text, re.IGNORECASE)
    if not m:
        return 0
    num = float(m.group(1).replace(",", ""))
    unit = m.group(2).upper()
    mult = {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3, "TB": 1024**4}
    return int(num * mult.get(unit, 1))

def search_and_resolve(query, quality=None):
    """Search for movie or TV series and resolve direct download details"""
    results = search_cinesubz(query)
    if not results:
        return {"error": f"No results found for '{query}'"}

    # Try resolving top search results until one works
    for item in results[:3]:
        try:
            resolved = resolver.resolve_direct_link(item["url"], quality)
            if resolved and resolved.get("success"):
                size_text = resolved.get("size_text", "")
                size_bytes = parse_size_bytes(size_text)

                return {
                    "success": True,
                    "title": resolved.get("title") or item["title"],
                    "year": resolved.get("year"),
                    "poster": resolved.get("poster") or item.get("poster"),
                    "backdrop": resolved.get("backdrop"),
                    "description": resolved.get("description") or f"Watch {item['title']}",
                    "quality": resolved.get("quality") or quality or "720p",
                    "size_text": size_text,
                    "size_bytes": size_bytes,
                    "downloadUrl": resolved.get("direct_url"),
                    "source_url": item["url"]
                }
        except Exception as e:
            sys.stderr.write(f"Error resolving {item['url']}: {e}\n")
            continue

    return {"error": f"Could not resolve direct download link for '{query}'"}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No query provided"}))
        sys.exit(1)

    query = sys.argv[1]
    quality = sys.argv[2] if len(sys.argv) > 2 else None

    result = search_and_resolve(query, quality)
    print(json.dumps(result, ensure_ascii=False, indent=2))
