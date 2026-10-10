const CryptoJS = require('./crypto-js.min.js');
const fs = require('fs');
const BLOB = "U2FsdGVkX19ev0670s8Mnlq+wTYrcgHcw9kxVZh/PaedemW0P/MvcNjB1ZhbearuF25jHISyI/8gh63eFB7gyK4yYmMAQZyyzTNrIApNntH+Vo6FKxUxlb1drXSngpwAcx1omsNIke/lh940tw5ULA==";
const lines = fs.readFileSync('./strings_all.txt','utf8').split('\n').filter(Boolean);
const cands = new Set();
for (const l of lines) {
  const v = l.split('\t').slice(1).join('\t');
  if (v && v.length < 40 && !v.startsWith('<')) cands.add(v);
}
// also literals from raw script
const raw = fs.readFileSync('./script_4.js','utf8');
for (const mo of raw.matchAll(/'([A-Za-z0-9_\-]{4,20})'/g)) cands.add(mo[1]);
let found = 0;
for (const pw of cands) {
  try {
    const out = CryptoJS.AES.decrypt(BLOB, pw).toString(CryptoJS.enc.Utf8);
    if (out && out.length > 8) { console.log('MATCH', JSON.stringify(pw), '->', JSON.stringify(out.slice(0,200))); found++; }
  } catch (e) {}
}
console.log('tried', cands.size, 'found', found);
