const CryptoJS = require('./crypto-js.min.js');
const BLOB = "U2FsdGVkX19ev0670s8Mnlq+wTYrcgHcw9kxVZh/PaedemW0P/MvcNjB1ZhbearuF25jHISyI/8gh63eFB7gyK4yYmMAQZyyzTNrIApNntH+Vo6FKxUxlb1drXSngpwAcx1omsNIke/lh940tw5ULA==";
for (const pw of ['ektebtaj', 'kasun']) {
  try {
    const out = CryptoJS.AES.decrypt(BLOB, pw).toString(CryptoJS.enc.Utf8);
    console.log(pw, '->', JSON.stringify(out.slice(0,160)));
  } catch (e) { console.log(pw, 'ERR', e.message); }
}
// also confirm kasun blob still decrypts (sanity of env)
const KASUN = "U2FsdGVkX18o2Ubm5nZNfRVDH7fCRO7Bl5ennwsh1aWznIvg+QKG3XN5IL5LQ+nSK7qpgUmNRNuYYBF3+SRpg4l2uWuEDqowtCglbgMU86xTThW4SK29WIKBE+O/qd3n37VUH5tC42SAr3alXoCeWMDqJD/kI7yO1zSRPvomXvJGmI0ETpyHF5fLM3J6CaamZy1rINyN7kl3jCU+eA0jqA==";
console.log('kasun blob ->', JSON.stringify(CryptoJS.AES.decrypt(KASUN, 'kasun').toString(CryptoJS.enc.Utf8).slice(0,80)));
