#!/usr/bin/env node
/**
 * Offline test suite for cinesubz-scraper.
 *
 * No network needed: fixtures are saved copies of real site pages
 * (test/fixtures/movie.html, test/fixtures/zt.html) and a real encrypted
 * response blob captured during reverse engineering.
 *
 *   npm test
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  cryptojsDecrypt,
  parseDownloadData,
  parseSizeBytes,
  mapZtHref,
  parseMovieHtml,
} = require('../index.js');

const FIX = path.join(__dirname, 'fixtures');
let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok - ${name}`);
  } catch (e) {
    failures.push({ name, e });
    console.log(`  FAIL - ${name}\n        ${e.message}`);
  }
}

/* Real CryptoJS "Salted__" blob captured from the live site; passphrase 'kasun'.
   It decrypts to base64 of a .proto schema (verified during reverse engineering). */
const KASUN_BLOB =
  'U2FsdGVkX18o2Ubm5nZNfRVDH7fCRO7Bl5ennwsh1aWznIvg+QKG3XN5IL5LQ+nSK7qpgUmNRNuYYBF3+' +
  'SRpg4l2uWuEDqowtCglbgMU86xTThW4SK29WIKBE+O/qd3n37VUH5tC42SAr3alXoCeWMDqJD/kI7yO1z' +
  'SRPvomXvJGmI0ETpyHF5fLM3J6CaamZy1rINyN7kl3jCU+eA0jqA==';

console.log('cinesubz-scraper tests\n');

test('AES/CryptoJS passphrase decrypt recovers the known schema', () => {
  const plain = cryptojsDecrypt(KASUN_BLOB, 'kasun');
  const schema = Buffer.from(plain, 'base64').toString('utf8').trim();
  assert.ok(schema.startsWith('syntax = "proto3"'), `got: ${schema.slice(0, 40)}`);
  assert.ok(schema.includes('message DownloadData'));
  assert.ok(schema.includes('string url = 1'));
});

test('wrong passphrase does not produce valid plaintext', () => {
  let leaked = false;
  try {
    leaked = cryptojsDecrypt(KASUN_BLOB, 'ektebtaj-wrong').includes('proto3');
  } catch (_) {
    leaked = false;
  }
  assert.strictEqual(leaked, false);
});

test('protobuf DownloadData parse', () => {
  const buf = Buffer.concat([
    Buffer.from([0x0a, 0x05]), Buffer.from('hello'),
    Buffer.from([0x12, 0x03]), Buffer.from('bad'),
  ]);
  const out = parseDownloadData(buf);
  assert.strictEqual(out.url, 'hello');
  assert.strictEqual(out.error, 'bad');
  assert.deepStrictEqual(parseDownloadData(Buffer.from([0x12, 0x03, 0x62, 0x61, 0x64])),
    { url: '', error: 'bad' });
});

test('size parsing: GB / MB', () => {
  assert.strictEqual(parseSizeBytes('WEB-DL 1080p \u2022 7.2 GB \u2022 English'),
    Math.round(7.2 * 1024 ** 3));
  assert.strictEqual(parseSizeBytes('WEB-DL 480p \u2022 800 MB \u2022 English'),
    800 * 1024 ** 2);
  assert.ok(parseSizeBytes('800 MB') < 1024 ** 3);
  assert.ok(parseSizeBytes('2.3 GB') >= 1024 ** 3);
  assert.strictEqual(parseSizeBytes('no size here'), null);
});

test('zt-links decoy mapping (fixture)', () => {
  const zt = fs.readFileSync(path.join(FIX, 'zt.html'), 'utf8');
  const original =
    'https://google.com/server6/202601/Avatar%20Fire%20and%20Ash%20(2025)%20English%20WEB-%5BCineSubz.co%5D-480p.mp4';
  const mapped = mapZtHref(original, zt);
  assert.ok(mapped.startsWith('https://drive.csplayer2.space/server6/'), mapped);
  assert.ok(mapped.includes('?ext=mp4'), mapped);
  // a non-matching URL passes through untouched
  assert.strictEqual(mapZtHref('https://t.me/somechannel', zt), 'https://t.me/somechannel');
});

test('movie page parsing (fixture): banner/details/description/links', () => {
  const html = fs.readFileSync(path.join(FIX, 'movie.html'), 'utf8');
  const m = parseMovieHtml(html, 'https://cinesubz.lk/movies/avatar-fire-and-ash-2025-sinhala-subtitles/');

  // banner
  assert.strictEqual(m.banner.backdrop,
    'https://image.tmdb.org/t/p/original/sdZSjtGUTSN8B3al5o0f2WoQfQQ.jpg');
  assert.strictEqual(m.banner.poster,
    'https://cinesubz.lk/wp-content/uploads/2026/03/Avatar-Fire-and-Ash-2025-WEB.jpg');

  // details
  assert.ok(m.details.title.startsWith('Avatar: Fire and Ash (2025)'));
  assert.strictEqual(m.details.year, 2025);
  assert.strictEqual(m.details.quality, 'WEB');
  assert.strictEqual(m.details.imdb, 7.4);
  assert.strictEqual(m.details.duration, '198 min');
  assert.strictEqual(m.details.siteRating, 4.6);
  assert.strictEqual(m.details.siteVotes, 143);
  assert.ok(m.details.genres.includes('Adventure'), 'genres');
  assert.ok(m.details.languages.includes('English'), 'languages');
  assert.ok(m.details.directors.includes('James Cameron'), 'directors');
  assert.ok(m.details.countries.includes('United States of America'), 'countries');
  assert.ok(m.details.cast.length >= 8, `cast=${m.details.cast.length}`);
  assert.ok(m.details.cast[0].name.length > 0, 'cast name');
  assert.ok(m.details.tagline && m.details.tagline.length > 5, 'tagline');

  // description
  assert.ok(m.description && m.description.length > 300, `desc len=${m.description && m.description.length}`);
  assert.ok(m.description.includes('ජේම්ස්') || m.description.includes('James'),
    'sinhala description text');

  // download entries
  assert.strictEqual(m.downloads.length, 3, 'download entries');
  const sizes = m.downloads.map((d) => d.sizeBytes);
  assert.ok(sizes.every((s) => s >= 1024 ** 3), 'all entries >= 1GB by stated size');
  assert.ok(m.downloads.every((d) => d.ztUrl.includes('/zt-links/')), 'zt urls');
  assert.ok(m.downloads.every((d) => d.language === 'English'), 'language field');
  const q = m.downloads.map((d) => d.quality);
  assert.ok(q.includes('WEB-DL 1080p') && q.includes('WEB-DL 720p') && q.includes('WEB-DL 480p'),
    `qualities: ${q.join(', ')}`);
});

test('min-size filtering logic (>= 1GB)', () => {
  const minBytes = Math.round(1 * 1024 ** 3);
  assert.ok(parseSizeBytes('7.2 GB') >= minBytes);
  assert.ok(parseSizeBytes('1.5 GB') >= minBytes);
  assert.ok(!(parseSizeBytes('800 MB') >= minBytes));
});

/* ------------------------------------------------------------------ */
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
