/**
 * cinesubz-scraper
 * =================
 * Scrapes a CineSubz movie page (cinesubz.co / .net / .lk all work - they
 * redirect to the live domain) and returns:
 *
 *   banner      - wide backdrop image + poster image
 *   details     - title, year, quality, IMDb, duration, rating, genres,
 *                 directors, countries, languages, cast, tagline
 *   description - the movie synopsis
 *   direct_downloads - ONE-CLICK direct file URLs (no redirects) for every
 *                 option whose file is >= minGb (default 1 GB)
 *
 * How the direct URL is produced (reverse engineered from the site):
 *   movie page -> /zt-links/<id>/ page (70s timer + ad interstitial)
 *              -> the page embeds the real href: a decoy
 *                 https://google.com/serverN/... URL
 *              -> inline JS rewrites decoys to https://drive.csplayer2.space/...
 *              -> loader page + GET /api/download-data   (session cookie)
 *              -> POST the page's obfuscated hex payload -> protobuf
 *                 DownloadData{url, error}
 *              -> url field is CryptoJS AES (per-page passphrase, taken from
 *                 the same page's obfuscated string table)
 *              -> final https://driveNN.supercloud2.space/<file>?token=...
 *                 verified with a ranged GET: 206, 0 redirects, video/mp4
 *
 * Zero dependencies: Node >= 18 (global fetch + node:crypto).
 */

'use strict';

const crypto = require('crypto');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT_MS = 45000;

const noop = () => {};

/* ------------------------------------------------------------------ *
 * HTML helpers
 * ------------------------------------------------------------------ */

function decodeEntities(s) {
  if (!s) return s;
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
    nbsp: ' ', rsquo: '\u2019', lsquo: '\u2018',
    rdquo: '\u201d', ldquo: '\u201c', bull: '\u2022',
    hellip: '\u2026', mdash: '\u2014',
  };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in named ? named[n.toLowerCase()] : m));
}

function stripTags(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

/** Extract the full body of the div whose opening tag starts at `from`. */
function extractDivBody(html, from) {
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = from;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0].toLowerCase() === '</div>') {
      depth -= 1;
      if (depth === 0) return html.slice(from, m.index);
    } else {
      depth += 1;
    }
  }
  return html.slice(from);
}

function segAfter(html, marker, until) {
  const i = html.search(marker);
  if (i < 0) return null;
  const j = until ? html.indexOf(until, i) : -1;
  return j > i ? html.slice(i, j) : html.slice(i);
}

function attr(tag, name) {
  const m = tag.match(new RegExp('\\b' + name + '\\s*=\\s*["\']([^"\']*)["\']', 'i'));
  return m ? decodeEntities(m[1]) : null;
}

function parseSizeBytes(text) {
  const m = /([\d.]+)\s*(TB|GB|MB|KB)/i.exec(text || '');
  if (!m) return null;
  const mult = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  return Math.round(parseFloat(m[1]) * mult[m[2].toUpperCase()]);
}

/* ------------------------------------------------------------------ *
 * crypto: CryptoJS-compatible passphrase AES
 * ------------------------------------------------------------------ */

function evpKdf(password, salt, keyLen = 32, ivLen = 16) {
  let total = Buffer.alloc(0);
  let d = Buffer.alloc(0);
  while (total.length < keyLen + ivLen) {
    d = crypto.createHash('md5').update(Buffer.concat([d, password, salt])).digest();
    total = Buffer.concat([total, d]);
  }
  return { key: total.subarray(0, keyLen), iv: total.subarray(keyLen, keyLen + ivLen) };
}

/** CryptoJS.AES.decrypt(b64, passphrase).toString(Utf8) - throws on bad key. */
function cryptojsDecrypt(b64, passphrase) {
  const raw = Buffer.from(b64, 'base64');
  const isSalted = raw.length > 16 && raw.subarray(0, 8).toString('latin1') === 'Salted__';
  const { key, iv } = evpKdf(
    Buffer.from(passphrase, 'utf8'),
    isSalted ? raw.subarray(8, 16) : Buffer.alloc(0)
  );
  const body = isSalted ? raw.subarray(16) : raw;
  const dec = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([dec.update(body), dec.final()]).toString('utf8');
}

/** The protobuf url field is base64 of the real URL. Try every passphrase. */
function unwrapUrl(blob, candidates) {
  for (const pw of candidates) {
    try {
      const plain = cryptojsDecrypt(blob, pw).trim();
      const decoded = Buffer.from(plain, 'base64').toString('utf8');
      if (/^https?:\/\//.test(decoded) && !decoded.includes('\uFFFD')) return [decoded, pw];
    } catch (_) {
      /* wrong passphrase - keep trying */
    }
  }
  return [null, null];
}

/* ------------------------------------------------------------------ *
 * protobuf: message DownloadData { string url = 1; string error = 2; }
 * ------------------------------------------------------------------ */

function readVarint(buf, i) {
  let n = 0, s = 0, c;
  do {
    c = buf[i++];
    n |= (c & 0x7f) << s;
    s += 7;
  } while (c & 0x80);
  return [n, i];
}

function parseDownloadData(buf) {
  const out = {};
  let i = 0;
  while (i < buf.length) {
    let tag;
    [tag, i] = readVarint(buf, i);
    const fn = tag >> 3, wt = tag & 7;
    if (wt === 2) {
      let ln;
      [ln, i] = readVarint(buf, i);
      out[fn] = buf.subarray(i, i + ln).toString('utf8');
      i += ln;
    } else if (wt === 0) {
      [out[fn], i] = readVarint(buf, i);
    } else {
      break;
    }
  }
  return { url: out[1] || '', error: out[2] || '' };
}

/* ------------------------------------------------------------------ *
 * HTTP (fetch + a tiny same-host cookie jar)
 * ------------------------------------------------------------------ */

class Jar {
  constructor() { this.map = new Map(); }
  store(res) {
    let list = [];
    if (typeof res.headers.getSetCookie === 'function') {
      list = res.headers.getSetCookie();
    } else {
      const raw = res.headers.get('set-cookie');
      if (raw) {
        const skip = /^(path|expires|max-age|domain|secure|httponly|samesite)$/i;
        list = raw.split(/,(?=[^;,]+=)/).filter((c) => {
          const name = /^\s*([^=;]+)=/.exec(c);
          return name && !skip.test(name[1].trim());
        });
      }
    }
    for (const c of list) {
      const m = /^\s*([^=;]+)=([^;]*)/.exec(c);
      if (m) this.map.set(m[1].trim(), m[2]);
    }
  }
  header() {
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

function headers(extra, jar) {
  const h = { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' };
  if (jar && jar.map.size) h.cookie = jar.header();
  return Object.assign(h, extra || {});
}

async function fetchRead(url, { jar, hdr, timeout = TIMEOUT_MS } = {}) {
  const res = await fetch(url, {
    headers: headers(hdr, jar),
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout),
  });
  if (jar) jar.store(res);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status} for ${url}`);
    e.status = res.status;
    throw e;
  }
  return { buf, text: buf.toString('utf8'), res };
}

/** Ranged GET that never downloads the body; counts redirects (0 = one click). */
async function probe(url, timeout = TIMEOUT_MS) {
  let current = url, redirects = 0;
  for (let hop = 0; hop < 8; hop++) {
    const res = await fetch(current, {
      headers: headers({
        range: 'bytes=0-1023',
        'accept-encoding': 'identity',
      }),
      redirect: 'manual',
      signal: AbortSignal.timeout(timeout),
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (res.body) await res.body.cancel().catch(() => {});
      if (!loc) return { status: res.status, redirects: redirects + 1 };
      redirects += 1;
      current = new URL(loc, current).toString();
      continue;
    }
    const headersOut = {};
    res.headers.forEach((v, k) => { headersOut[k.toLowerCase()] = v; });
    if (res.body) await res.body.cancel().catch(() => {});
    return { status: res.status, redirects, headers: headersOut };
  }
  return { status: null, redirects };
}

/* ------------------------------------------------------------------ *
 * step 1: movie page
 * ------------------------------------------------------------------ */

async function scrapeMovie(url, { log = noop } = {}) {
  const { text: html, res } = await fetchRead(url);
  const finalUrl = res.url || url;
  const parsed = parseMovieHtml(html, finalUrl);
  log(`  [movie] ${parsed.details.title || '?'} - ${parsed.downloads.length} download entries`);
  return parsed;
}

/** Pure HTML -> movie data (exported so tests can run offline on a fixture). */
function parseMovieHtml(html, finalUrl) {

  // banner / poster
  const banner = {};
  const splash = /<div[^>]*class=["'][^"']*\bsplash-bg\b[^"']*["'][^>]*>\s*<img[^>]*>/i.exec(html);
  if (splash) banner.backdrop = attr(splash[0], 'src');
  const posterTag = /<img[^>]*class=["'][^"']*\bposter-img\b[^"']*["'][^>]*>/i.exec(html);
  if (posterTag) banner.poster = attr(posterTag[0], 'src');
  if (!banner.poster) {
    const og = /<meta[^>]*property=["']og:image["'][^>]*>/i.exec(html);
    if (og) banner.poster = attr(og[0], 'content');
  }
  for (const k of Object.keys(banner)) if (!banner[k]) delete banner[k];

  const details = {};

  const t = /<div[^>]*class=["']details-title["'][^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(html);
  if (t) details.title = stripTags(t[1]);
  const ym = /\((\d{4})\)/.exec(details.title || '');
  if (ym) details.year = parseInt(ym[1], 10);

  const q = /<span[^>]*class=["'][^"']*\bdata-quality\b[^"']*["'][^>]*>([^<]*)</i.exec(html);
  if (q) details.quality = decodeEntities(q[1]).trim();

  const imdbTag = /<span[^>]*class=["'][^"']*\bdata-imdb\b(?:\s[^"']*)?["'][^>]*>/i.exec(html);
  if (imdbTag) {
    const chunk = stripTags(html.slice(imdbTag.index, imdbTag.index + 400));
    const im = /IMDb:\s*([\d.]+)/.exec(chunk);
    if (im) details.imdb = parseFloat(im[1]);
    const vm = /\(([^)]+)\)/.exec(chunk);
    if (vm) details.imdbVotes = vm[1];
  }

  const dur = /<span[^>]*itemprop=["']duration["'][^>]*>([^<]*)</i.exec(html);
  if (dur) details.duration = decodeEntities(dur[1]).trim();

  const rv = /<span[^>]*\bzt_rating_vgs\b[^>]*>([\d.]+)</i.exec(html);
  if (rv) details.siteRating = parseFloat(rv[1]);
  const rc = /<meta[^>]*itemprop=["']ratingCount["'][^>]*content=["'](\d+)["']/i.exec(html) ||
             /<meta[^>]*content=["'](\d+)["'][^>]*itemprop=["']ratingCount["']/i.exec(html);
  if (rc) details.siteVotes = parseInt(rc[1], 10);

  const genSeg = segAfter(html, /class=["'][^"']*\bdetails-genre\b/, '</div>');
  if (genSeg) {
    details.genres = [...genSeg.matchAll(/<a[^>]*>([^<]*)<\/a>/gi)]
      .map((m) => stripTags(m[1])).filter(Boolean);
  }
  const kwSeg = segAfter(html, /class=["'][^"']*\bdata-keywords-inline\b/, '</span>');
  if (kwSeg) {
    details.languages = [...kwSeg.matchAll(/<a[^>]*>([^<]*)<\/a>/gi)]
      .map((m) => stripTags(m[1])).filter(Boolean);
  }

  const labelMap = {
    director: 'directors', country: 'countries',
    language: 'languages', studio: 'studios',
  };
  for (const m of html.matchAll(/<div[^>]*class=["'][^"']*\binfo-col\b[^"']*["'][^>]*>\s*<p>([\s\S]*?)<\/p>/gi)) {
    const p = m[1];
    const st = /<strong>([\s\S]*?)<\/strong>/i.exec(p);
    if (!st) continue;
    const label = stripTags(st[1]).replace(/:$/, '').trim();
    if (!label) continue;
    let vals = [...p.matchAll(/<a[^>]*>([^<]*)<\/a>/gi)].map((x) => stripTags(x[1])).filter(Boolean);
    if (!vals.length) {
      const v = stripTags(p.slice(p.indexOf('</strong>') + 9));
      if (v) vals = [v];
    }
    if (!vals.length) continue;
    const key = labelMap[label.toLowerCase()] || label.toLowerCase();
    if (Array.isArray(details[key])) {
      for (const v of vals) if (!details[key].includes(v)) details[key].push(v);
    } else {
      details[key] = vals;
    }
  }

  const cast = [];
  for (const seg of html.split(/class=["'][^"']*\bzt-cast-card\b[^"']*["']/).slice(1)) {
    const nm = /class=["'][^"']*\bzt-cast-name\b[^"']*["'][^>]*>([^<]*)</i.exec(seg);
    if (!nm) continue;
    const rl = /class=["'][^"']*\bzt-cast-role\b[^"']*["'][^>]*>([^<]*)</i.exec(seg);
    cast.push({ name: stripTags(nm[1]), role: rl ? stripTags(rl[1]) : null });
  }
  if (cast.length) details.cast = cast;

  const tag = /<p[^>]*class=["'][^"']*\btagline-text\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i.exec(html);
  if (tag) details.tagline = stripTags(tag[1]);

  if ('year' in details) {
    const y = /\d{4}/.exec(String(details.year));
    details.year = y ? parseInt(y[0], 10) : null;
  }

  // description
  let description = null;
  const descIdx = html.search(/<div[^>]*class=["'][^"']*\bdetails-desc\b/i);
  if (descIdx >= 0) {
    description = stripTags(extractDivBody(html, descIdx)) || null;
  }

  // download entries
  const entries = [];
  for (const seg of html.split(/class=["']movie-download-link-item["']/).slice(1)) {
    const a = /<a[^>]*href=["']([^"']+)["']/i.exec(seg);
    if (!a) continue;
    const typeM = /movie-download-type["']>([^<]*)</i.exec(seg);
    const metaM = /movie-download-meta["']>([^<]*)</i.exec(seg);
    const meta = metaM ? decodeEntities(metaM[1]).trim() : '';
    const bits = meta.split('\u2022').map((s) => s.trim());
    entries.push({
      label: typeM ? decodeEntities(typeM[1]).trim() : 'Download',
      meta,
      quality: bits[0] || null,
      sizeText: /[\d.]+\s*(TB|GB|MB|KB)/i.exec(meta) ? /[\d.]+\s*(TB|GB|MB|KB)/i.exec(meta)[0] : null,
      sizeBytes: parseSizeBytes(meta),
      language: bits.length > 2 ? bits[bits.length - 1] : null,
      ztUrl: new URL(a[1], finalUrl).toString(),
    });
  }

  return {
    sourceUrl: finalUrl,
    finalUrl,
    banner,
    details,
    description,
    downloads: entries,
  };
}

/* ------------------------------------------------------------------ *
 * step 2: zt-links page -> real (decoy) href -> drive URL
 * ------------------------------------------------------------------ */

function mapZtHref(original, ztHtml) {
  const mappings = [];
  const re = /\{search:\[([^\]]+)\],replace:"([^"]+)"\}/g;
  let m;
  while ((m = re.exec(ztHtml))) {
    mappings.push({ searches: [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]), replace: m[2] });
  }
  let url = original;
  for (const { searches, replace } of mappings) {
    for (const s of searches) {
      if (url.includes(s)) {
        url = url.split(s).join(replace);
        for (const ext of ['mp4', 'mkv', 'zip']) {
          const token = '.' + ext;
          if (url.includes(token) && !url.includes('ext=')) {
            url = url.replace(token, '?ext=' + ext);
            break;
          }
        }
        return url;
      }
    }
  }
  return url;
}

function isTelegram(u) {
  return /^https?:\/\/(www\.)?(telegram\.me|t\.me)\//.test(u || '');
}

async function getDriveInfo(ztUrl, { log = noop } = {}) {
  const { text: html } = await fetchRead(ztUrl);
  const m = /<a id="link" href="([^"]+)"/.exec(html);
  if (!m) {
    if (html.includes('errorContainer')) {
      return { kind: 'error', reason: 'link marked as error by site' };
    }
    return { kind: 'error', reason: 'no #link on zt page' };
  }
  const original = m[1];
  const mapped = mapZtHref(original, html);
  if (isTelegram(mapped)) return { kind: 'telegram', url: mapped, original };
  const u = new URL(mapped);
  const bare = `${u.origin}${u.pathname}`;
  const urls = u.search && u.search !== '?ext=mp4' && !/^\?ext=(mp4|mkv|zip)$/.test(u.search)
    ? [bare, mapped] : [bare];
  return { kind: 'direct', url: bare, urls, original };
}

/* ------------------------------------------------------------------ *
 * step 3: drive page -> one-click direct URLs
 * ------------------------------------------------------------------ */

async function resolveCandidates(driveUrls, { log = noop } = {}) {
  if (typeof driveUrls === 'string') driveUrls = [driveUrls];
  const found = [];
  for (const u of driveUrls) {
    for (const got of await resolveOne(u, log)) {
      if (!found.includes(got)) found.push(got);
    }
    if (found.length) break;
  }
  return found;
}

async function resolveOne(driveUrl, log) {
  const u = new URL(driveUrl);
  const host = u.origin;
  const path = u.pathname; // bare path (query stripped) - verified to work
  const jar = new Jar();

  try {
    // 1) loader page registers the file into the session
    await fetchRead(host + path, { jar });

    // 2) API -> target
    const api = await fetchRead(
      `${host}/api/download-data${path}`,
      { jar, hdr: { accept: 'application/json' } }
    );
    const data = JSON.parse(api.text);
    if (!data.success) {
      log(`  [drive] api: ${JSON.stringify(data).slice(0, 120)}`);
      return [];
    }
    const target = host + data.redirect;
    log('  [drive] target ok');

    // 3) download page
    const pageRes = await fetchRead(target, { jar, hdr: { referer: host + '/' } });
    const page = pageRes.text;
    if (!page.includes('dl-links')) {
      log(`  [drive] unexpected page (${page.length}B)`);
      return [];
    }

    const payloads = [];
    for (const m of page.matchAll(/'([0-9a-f]{300,})'/g)) {
      if (!payloads.includes(m[1])) payloads.push(m[1]);
    }
    const skip = /^(http|div|span|imag|butt)/;
    const candidates = [...new Set(
      [...page.matchAll(/'([A-Za-z0-9_-]{4,24})'/g)]
        .map((m) => m[1]).filter((s) => !skip.test(s))
    )].sort((a, b) => a.length - b.length);
    log(`  [drive] ${payloads.length} payloads, ${candidates.length} key candidates`);

    // 4) POST each payload, keep every URL we can unwrap
    const found = [];
    for (let n = 0; n < payloads.length; n++) {
      let buf;
      try {
        const res = await fetch(target, {
          method: 'POST',
          headers: headers({
            'content-type': 'application/octet-stream',
            referer: target,
            origin: host,
          }, jar),
          body: Buffer.from(payloads[n], 'hex'),
          redirect: 'follow',
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) {
          log(`  [drive] post ${n + 1}: HTTP ${res.status}`);
          continue;
        }
        buf = Buffer.from(await res.arrayBuffer());
      } catch (e) {
        log(`  [drive] post ${n + 1}: ${e.message}`);
        continue;
      }
      if (buf.length && buf[0] === 0x7b) continue; // JSON response
      const { url: blob, error } = parseDownloadData(buf);
      if (!blob) {
        log(`  [drive] post ${n + 1}: empty (${buf.length}B, err=${JSON.stringify(error)})`);
        continue;
      }
      const [final, pw] = unwrapUrl(blob, candidates);
      if (final) {
        log(`  [drive] post ${n + 1}: candidate ${final.slice(0, 100)}`);
        if (!found.includes(final)) found.push(final);
      }
    }
    if (!found.length) log('  [drive] no payload yielded a decryptable URL');
    return found;
  } catch (e) {
    log(`  [drive] failed: ${e.message}`);
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * verification: is it really ONE CLICK?
 * ------------------------------------------------------------------ */

async function verifyDirect(url, minBytes, { log = noop } = {}) {
  let r;
  try {
    r = await probe(url);
  } catch (e) {
    log(`  [verify] unreachable: ${e.message}`);
    return {
      status: null, redirects: null, contentType: null, sizeBytes: null,
      contentDisposition: null, oneClick: false, meetsMinSize: false,
      error: e.message,
    };
  }
  const h = r.headers || {};
  const ctype = (h['content-type'] || '').toLowerCase();
  let total = null;
  if (h['content-range'] && h['content-range'].includes('/')) {
    const t = h['content-range'].split('/').pop();
    if (/^\d+$/.test(t)) total = parseInt(t, 10);
  }
  if (total === null && r.redirects === 0 && /^\d+$/.test(h['content-length'] || '')) {
    total = parseInt(h['content-length'], 10);
  }
  const isFile = r.status !== null && [200, 206].includes(r.status) && !ctype.includes('text/html');
  const out = {
    status: r.status,
    redirects: r.redirects,
    contentType: ctype || null,
    sizeBytes: total,
    contentDisposition: h['content-disposition'] || null,
    oneClick: Boolean(isFile && r.redirects === 0),
    meetsMinSize: Boolean(total && total >= minBytes),
  };
  log(`  [verify] ${out.status} redirects=${out.redirects} type=${out.contentType} ` +
      `size=${total ? (total / 1024 ** 3).toFixed(2) : '?'}GB`);
  return out;
}

/* ------------------------------------------------------------------ *
 * full pipeline
 * ------------------------------------------------------------------ */

async function scrape(url, opts = {}) {
  const log = opts.log || noop;
  const minGb = opts.minGb == null ? 1 : opts.minGb;
  const minBytes = Math.round(minGb * 1024 ** 3);
  const limit = opts.limit || 0;
  const verify = opts.verify !== false;

  log(`Scraping ${url}`);
  const movie = await scrapeMovie(url, { log });

  let qualifying = movie.downloads.filter(
    (e) => e.sizeBytes == null || e.sizeBytes >= minBytes
  );
  qualifying.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
  if (limit) qualifying = qualifying.slice(0, limit);
  const skipped = movie.downloads.length - qualifying.length;
  log(`  [filter] >= ${minGb} GB: ${qualifying.length} link(s), skipped ${skipped}`);

  const resolved = [];
  for (const e of qualifying) {
    log(`Resolving: ${e.meta || e.label} (${e.ztUrl})`);
    const entry = { ...e };
    let got;
    try {
      got = await getDriveInfo(e.ztUrl, { log });
    } catch (err) {
      entry.directUrl = null;
      entry.error = `zt page failed: ${err.message}`;
      resolved.push(entry);
      continue;
    }
    entry.kind = got.kind;
    if (got.kind === 'telegram') {
      entry.directUrl = null;
      entry.telegramUrl = got.url;
      resolved.push(entry);
      continue;
    }
    if (got.kind !== 'direct') {
      entry.directUrl = null;
      entry.error = got.reason;
      resolved.push(entry);
      continue;
    }
    const candidates = await resolveCandidates(got.urls || [got.url], { log });
    if (!candidates.length) {
      entry.directUrl = null;
      entry.error = 'could not resolve a direct URL';
      resolved.push(entry);
      continue;
    }
    entry.candidates = candidates;
    const files = candidates.filter((c) => !isTelegram(c));
    const tgs = candidates.filter((c) => isTelegram(c));
    if (tgs.length) entry.telegramUrl = tgs[0];

    let direct = null, ver = null, err = null;
    for (const cand of files) {
      if (!verify) { direct = cand; break; }
      ver = await verifyDirect(cand, minBytes, { log });
      if (ver.oneClick && (ver.sizeBytes == null || ver.sizeBytes >= minBytes)) {
        direct = cand;
        break;
      }
      err = !ver.oneClick
        ? 'final URL redirects or serves HTML'
        : `verified size below ${minGb} GB`;
    }
    entry.directUrl = direct;
    entry.verify = direct ? ver : null;
    if (direct == null) {
      entry.error = err || (tgs.length ? 'telegram-only link' : 'could not resolve a direct URL');
      if (!tgs.length && files.length) entry.directUrl = files[0];
    }
    resolved.push(entry);
  }

  const good = resolved.filter((e) => {
    if (!e.directUrl) return false;
    if (verify) {
      const v = e.verify;
      if (!v || !v.oneClick) return false;
      if (v.sizeBytes != null && v.sizeBytes < minBytes) {
        e.error = `verified size below ${minGb} GB`;
        return false;
      }
      delete e.error;
    }
    return true;
  });
  good.sort((a, b) =>
    ((b.verify && b.verify.sizeBytes) || b.sizeBytes || 0) -
    ((a.verify && a.verify.sizeBytes) || a.sizeBytes || 0)
  );

  return {
    scrapedFrom: url,
    banner: movie.banner,
    details: movie.details,
    description: movie.description,
    directDownloads: good,
    otherDownloads: resolved.filter((e) => !good.includes(e)),
    recommended: good.length ? good[0].directUrl : null,
    minSizeBytes: minBytes,
  };
}

module.exports = {
  scrape,
  scrapeMovie,
  parseMovieHtml,
  getDriveInfo,
  mapZtHref,
  resolveCandidates,
  verifyDirect,
  cryptojsDecrypt,
  parseDownloadData,
  parseSizeBytes,
  UA,
};
