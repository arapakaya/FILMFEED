#!/usr/bin/env python3
"""
Populate full database of Movies, TV Series, Cartoons, and Anime
from CineSubz, SinhalaSub, Cartoons.lk, and AnimeKaizen.
"""

import sys
import os
import json
import re
import urllib.request
import urllib.parse
from bs4 import BeautifulSoup

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'filmfeed-website', 'data')
os.makedirs(DATA_DIR, exist_ok=True)

def fetch_cinesubz(max_pages=15):
    print(f"Scraping CineSubz ({max_pages} pages)...")
    movies = []
    series = []
    seen = set()

    for p in range(1, max_pages + 1):
        # Movies
        url_m = f"https://cinesubz.co/movies/page/{p}/" if p > 1 else "https://cinesubz.co/movies/"
        try:
            req = urllib.request.Request(url_m, headers={"User-Agent": UA})
            html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
            soup = BeautifulSoup(html, "html.parser")
            for box in soup.select("div.display-item"):
                a = box.select_one("a[data-url]") or box.select_one("a[href]")
                img = box.select_one("img.thumb") or box.select_one("img")
                title_el = box.select_one(".item-desc-title h3") or box.select_one("h3")
                if a and title_el:
                    title = title_el.get_text(strip=True)
                    href = a.get("href")
                    poster = img.get("data-original") or img.get("src") if img else None
                    if href and href not in seen:
                        seen.add(href)
                        movies.append({
                            "id": box.get("id", "").replace("item-", "") or href.rsplit("/", 2)[-2],
                            "title": title,
                            "url": href,
                            "poster": poster,
                            "category": "Movie",
                            "quality": "HD",
                            "year": "2024"
                        })
        except Exception as e:
            print(f"  CineSubz movie p{p} error: {e}")

        # TV Shows
        url_s = f"https://cinesubz.co/tvshows/page/{p}/" if p > 1 else "https://cinesubz.co/tvshows/"
        try:
            req = urllib.request.Request(url_s, headers={"User-Agent": UA})
            html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
            soup = BeautifulSoup(html, "html.parser")
            for box in soup.select("div.display-item"):
                a = box.select_one("a[data-url]") or box.select_one("a[href]")
                img = box.select_one("img.thumb") or box.select_one("img")
                title_el = box.select_one(".item-desc-title h3") or box.select_one("h3")
                if a and title_el:
                    title = title_el.get_text(strip=True)
                    href = a.get("href")
                    poster = img.get("data-original") or img.get("src") if img else None
                    if href and href not in seen:
                        seen.add(href)
                        series.append({
                            "id": box.get("id", "").replace("item-", "") or href.rsplit("/", 2)[-2],
                            "title": title,
                            "url": href,
                            "poster": poster,
                            "category": "TV Series",
                            "quality": "HD",
                            "year": "2024"
                        })
        except Exception as e:
            print(f"  CineSubz tv p{p} error: {e}")

    print(f"✓ CineSubz Movies: {len(movies)} | TV Series: {len(series)}")
    return movies, series

def fetch_sinhalasub(max_pages=15):
    print(f"Scraping SinhalaSub ({max_pages} pages)...")
    movies = []
    seen = set()

    for p in range(1, max_pages + 1):
        url = f"https://sinhalasub.lk/movies/page/{p}/" if p > 1 else "https://sinhalasub.lk/movies/"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
            soup = BeautifulSoup(html, "html.parser")
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                m = re.match(r"https?://sinhalasub\.lk/movies/([a-z0-9\-]{6,})/$", href)
                if not m or href in seen:
                    continue
                seen.add(href)
                slug = m.group(1)
                title = (a.get("title") or "").strip()
                if not title:
                    h3 = a.find(["h3", "span"])
                    title = h3.get_text(" ", strip=True) if h3 else slug.replace("-", " ").title()
                img = a.find("img")
                poster = (img.get("src") or img.get("data-original") or "").strip() if img else None
                movies.append({
                    "id": slug,
                    "title": title,
                    "url": href,
                    "poster": poster,
                    "category": "SinhalaSub",
                    "quality": "HD",
                    "year": "2024"
                })
        except Exception as e:
            print(f"  SinhalaSub p{p} error: {e}")

    print(f"✓ SinhalaSub Movies: {len(movies)}")
    return movies

def fetch_cartoons(max_pages=5):
    print(f"Scraping Cartoons.lk ({max_pages} pages)...")
    cartoons = []
    seen = set()

    for p in range(1, max_pages + 1):
        url = f"https://cartoons.lk/page/{p}/" if p > 1 else "https://cartoons.lk/"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
            soup = BeautifulSoup(html, "html.parser")
            for article in soup.select("article, div.post"):
                a = article.select_one("a[href]")
                img = article.select_one("img")
                title_el = article.select_one("h2, h3, .entry-title")
                if a and title_el:
                    href = a.get("href")
                    title = title_el.get_text(strip=True)
                    poster = img.get("src") or img.get("data-src") if img else None
                    if href and href not in seen and title:
                        seen.add(href)
                        cartoons.append({
                            "id": f"cartoon_{href.rsplit('/', 2)[-2]}",
                            "title": title,
                            "url": href,
                            "poster": poster,
                            "category": "Sinhala Dubbed",
                            "quality": "Dubbed",
                            "description": f"Watch {title} Sinhala Dubbed Cartoon / Movie on FilmFeed"
                        })
        except Exception as e:
            print(f"  Cartoons.lk p{p} error: {e}")

    print(f"✓ Cartoons.lk: {len(cartoons)}")
    return cartoons

def fetch_animekaizen(max_pages=5):
    print(f"Scraping AnimeKaizen ({max_pages} pages)...")
    anime = []
    seen = set()

    for p in range(1, max_pages + 1):
        url = f"https://www.animekaizen.org/page/{p}/" if p > 1 else "https://www.animekaizen.org/"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
            soup = BeautifulSoup(html, "html.parser")
            for article in soup.select("article, div.post, div.anime-card"):
                a = article.select_one("a[href]")
                img = article.select_one("img")
                title_el = article.select_one("h2, h3, .title, .entry-title")
                if a and title_el:
                    href = a.get("href")
                    title = title_el.get_text(strip=True)
                    poster = img.get("src") or img.get("data-src") if img else None
                    if href and href not in seen and title:
                        seen.add(href)
                        anime.append({
                            "id": f"anime_{href.rsplit('/', 2)[-2]}",
                            "title": title,
                            "url": href,
                            "poster": poster,
                            "category": "Anime",
                            "quality": "HD",
                            "description": f"Watch {title} Anime Series with English Subtitles on FilmFeed"
                        })
        except Exception as e:
            print(f"  AnimeKaizen p{p} error: {e}")

    print(f"✓ AnimeKaizen: {len(anime)}")
    return anime

def main():
    print("==========================================")
    print("Populating FILMFEED Full Movie Database...")
    print("==========================================")

    c_movies, c_series = fetch_cinesubz(15)
    s_movies = fetch_sinhalasub(15)
    cartoons = fetch_cartoons(5)
    anime = fetch_animekaizen(5)

    # Save to JSON files in filmfeed-website/data/
    cinesubz_path = os.path.join(DATA_DIR, 'cinesubz_result.json')
    sinhalasub_path = os.path.join(DATA_DIR, 'sinhalasub_result.json')
    cartoons_path = os.path.join(DATA_DIR, 'cartoons_lk_enhanced.json')
    anime_path = os.path.join(DATA_DIR, 'animekaizen_enhanced.json')

    # Merge CineSubz movies and series
    all_cinesubz = c_movies + c_series
    with open(cinesubz_path, 'w', encoding='utf-8') as f:
        json.dump(all_cinesubz, f, ensure_ascii=False, indent=2)

    with open(sinhalasub_path, 'w', encoding='utf-8') as f:
        json.dump(s_movies, f, ensure_ascii=False, indent=2)

    with open(cartoons_path, 'w', encoding='utf-8') as f:
        json.dump(cartoons, f, ensure_ascii=False, indent=2)

    with open(anime_path, 'w', encoding='utf-8') as f:
        json.dump(anime, f, ensure_ascii=False, indent=2)

    print("==========================================")
    print("✓ SUCCESSFULLY POPULATED FILMFEED DATABASE!")
    print(f"Total Movies & Series saved in {DATA_DIR}")
    print("==========================================")

if __name__ == '__main__':
    main()
