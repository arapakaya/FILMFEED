# cinesubz-scraper

Scrape a **CineSubz** movie page (cinesubz.co / .net / .lk — they all redirect to
the live domain) and get:

- **banner** — wide backdrop image + poster image
- **details** — title, year, quality, IMDb, duration, site rating, genres,
  languages, directors, countries, cast, tagline
- **description** — the full movie synopsis
- **direct_downloads** — **one-click direct file URLs** (no redirects,
  `Content-Disposition: attachment`) for every option whose file is
  **≥ 1 GB**, each proven with a ranged GET before it is reported

Zero dependencies. Node **≥ 18** (uses global `fetch` + `node:crypto`).

## Install

```bash
npm install          # local use
npm link             # optional: makes the `cinesubz` command global
```

## CLI

```bash
node bin/cinesubz.js "https://cinesubz.co/movies/<slug>/" -o result.json
# or, after `npm link`:
cinesubz "https://cinesubz.co/movies/<slug>/" -o result.json
```

| Option | Meaning |
|---|---|
| `--min-gb N` | minimum file size in GB (default `1`) |
| `--limit N` | resolve at most N qualifying links (default: all) |
| `--no-verify` | skip the ranged-GET verification of the final URLs |
| `-o, --out FILE` | also write the JSON to FILE |

JSON goes to **stdout**, progress logs to **stderr**, so
`cinesubz URL > out.json` works cleanly. Exit code `0` when at least one
verified link was found, `2` otherwise, `1` on errors.

## Library

```js
const { scrape, scrapeMovie, resolveCandidates, verifyDirect } = require('cinesubz-scraper');

const result = await scrape('https://cinesubz.co/movies/<slug>/', {
  minGb: 1,          // minimum size (default 1)
  limit: 0,          // 0 = resolve all qualifying links
  verify: true,      // ranged-GET check of every final URL
  log: console.error // optional progress logger
});

console.log(result.banner.backdrop);
console.log(result.details.title, result.details.year);
console.log(result.description);
console.log(result.recommended); // largest verified one-click URL
```

### Output shape

```jsonc
{
  "banner":   { "backdrop": "https://image.tmdb.org/...", "poster": "https://cinesubz.lk/..." },
  "details":  { "title": "...", "year": 2025, "quality": "WEB", "imdb": 7.4,
                "duration": "198 min", "genres": [...], "directors": [...],
                "cast": [{ "name": "...", "role": "..." }], "tagline": "..." },
  "description": "…synopsis…",
  "directDownloads": [
    { "quality": "WEB-DL 1080p", "sizeText": "7.2 GB", "sizeBytes": 7730939453,
      "ztUrl": "https://cinesubz.lk/zt-links/…/",
      "directUrl": "https://drive06.supercloud2.space/….mp4?token=…",
      "verify": { "status": 206, "redirects": 0, "contentType": "video/mp4",
                  "sizeBytes": 7774000857, "oneClick": true, "meetsMinSize": true } }
  ],
  "otherDownloads": [],
  "recommended": "https://drive06.supercloud2.space/….mp4?token=…",
  "minSizeBytes": 1073741824
}
```

## How the direct link is produced

The site hides real files behind several layers; this package replays all of
them natively:

1. movie page → `/zt-links/<id>/` page (70-second timer + ad interstitial)
2. that page embeds the real href — a **decoy** `https://google.com/serverN/…`
   URL that its inline JS rewrites to `https://drive.csplayer2.space/serverN/…`
3. loader page + `GET /api/download-data` to open a session cookie
4. `POST` the page's obfuscated hex payload → protobuf `DownloadData{url,error}`
5. the `url` field is **CryptoJS AES** with a passphrase that is randomized per
   page load; it is taken from that same page's obfuscated string table
6. the resulting `https://driveNN.supercloud2.space/<file>?token=…` URL is
   verified with a ranged GET (`206`, **0 redirects**, `video/mp4`,
   size ≥ `--min-gb`) before being reported

## Tests

```bash
npm test
```

Offline suite (no network): AES/CryptoJS vector from a real captured response,
protobuf parsing, size parsing, decoy-URL mapping, and full movie-page parsing
against a saved fixture (`test/fixtures/movie.html`).

## Caveats

- Token URLs are issued per session — **resolve a fresh link right before
  downloading** rather than caching it for days.
- CineSubz rotates decoy hosts/payloads periodically; if the site changes its
  scheme, update `mapZtHref` / `resolveOne` in `index.js`.
- The site serves pirated content; you are responsible for only downloading
  material you have the right to download.

## License

MIT
