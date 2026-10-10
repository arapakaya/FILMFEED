// Load obfuscated script with minimal stubs so its string-array rotation runs,
// then dump the rotated string table.
const fs = require('fs');
const src = fs.readFileSync('work/script_4.js', 'utf8');

const noop = () => {};
const stubEl = new Proxy(function () {}, {
  get: (t, p) => (p === 'style' || p === 'classList' || p === 'textContent' || p === 'innerHTML' || p === 'href' ? stubEl : typeof p === 'string' ? (() => stubEl) : undefined),
  apply: () => stubEl,
  set: () => true,
});

global.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 0, language: 'en-US', webdriver: false };
global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
global.TextDecoder = TextDecoder;
global.Uint8Array = Uint8Array;
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: noop,
  removeEventListener: noop,
  createElement: () => ({ setAttribute: noop, appendChild: noop, style: {}, click: noop }),
  head: { appendChild: noop },
  body: { appendChild: noop },
  cookie: '',
  title: 'x',
  documentElement: { style: {} },
  referrer: '',
  visibilityState: 'visible',
};
global.window = {
  location: { href: 'https://drive.csplayer2.space/server6/f.mp4', pathname: '/server6/f.mp4', search: '', reload: noop, assign: noop, replace: noop, protocol: 'https:', hostname: 'drive.csplayer2.space' },
  addEventListener: noop,
  removeEventListener: noop,
  navigator: global.navigator,
  innerWidth: 1200, innerHeight: 800,
  screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
  open: noop,
  CryptoJS: undefined,
};
global.crypto = { subtle: {} };
global.fetch = () => Promise.reject(new Error('no network'));
global.alert = noop;
global.alart = noop;
global.XMLHttpRequest = function () { this.open = noop; this.send = noop; };

try {
  eval(src);
  console.error('script executed cleanly');
} catch (e) {
  console.error('runtime err (expected):', e.message);
}

const out = [];
for (let i = 0; i < 500; i++) {
  try {
    const v = _0x4f1a(0x140 + i);
    if (v !== undefined) out.push([i, String(v)]);
  } catch (e) {}
}
fs.writeFileSync('work/strings.json', JSON.stringify(out));
console.error('dumped', out.length, 'strings');
