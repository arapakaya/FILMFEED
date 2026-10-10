#!/usr/bin/env node
/**
 * cinesubz CLI
 *
 *   cinesubz <movie-url> [--min-gb N] [--limit N] [--no-verify] [-o FILE]
 *
 * JSON goes to stdout, progress logs to stderr (so `cinesubz URL > out.json`
 * works cleanly).
 */

'use strict';

const fs = require('fs');
const { scrape } = require('../index.js');

function usage(code) {
  const txt = [
    'Usage: cinesubz <movie-url> [options]',
    '',
    'Scrape a CineSubz movie page for banner, details, description and',
    'ONE-CLICK direct download links (no redirects, files >= min size).',
    '',
    'Options:',
    '  --min-gb N      minimum file size in GB (default: 1)',
    '  --limit N       resolve at most N qualifying links (0 = all, default)',
    '  --no-verify     skip the ranged-GET verification of the final URLs',
    '  -o, --out FILE  also write the JSON result to FILE',
    '  -h, --help      show this help',
  ].join('\n');
  console.error(txt);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { url: null, minGb: 1, limit: 0, verify: true, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') usage(0);
    else if (a === '--min-gb') opts.minGb = parseFloat(argv[++i]);
    else if (a.startsWith('--min-gb=')) opts.minGb = parseFloat(a.split('=')[1]);
    else if (a === '--limit') opts.limit = parseInt(argv[++i], 10);
    else if (a.startsWith('--limit=')) opts.limit = parseInt(a.split('=')[1], 10);
    else if (a === '--no-verify') opts.verify = false;
    else if (a === '-o' || a === '--out') opts.out = argv[++i];
    else if (a.startsWith('--out=')) opts.out = a.split('=')[1];
    else if (a.startsWith('-')) {
      console.error(`Unknown option: ${a}`);
      usage(1);
    } else opts.url = a;
  }
  if (!opts.url) usage(1);
  if (Number.isNaN(opts.minGb) || opts.minGb < 0) {
    console.error('--min-gb must be a number >= 0');
    process.exit(1);
  }
  return opts;
}

(async () => {
  const opts = parseArgs(process.argv.slice(2));
  try {
    const result = await scrape(opts.url, {
      minGb: opts.minGb,
      limit: opts.limit,
      verify: opts.verify,
      log: (m) => console.error(m),
    });
    const json = JSON.stringify(result, null, 2);
    if (opts.out) {
      fs.writeFileSync(opts.out, json, 'utf8');
      console.error(`written: ${opts.out}`);
    }
    process.stdout.write(json + '\n');
    process.exit(result.directDownloads.length ? 0 : 2);
  } catch (e) {
    console.error('error:', e.message);
    process.exit(1);
  }
})();
