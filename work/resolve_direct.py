"""Resolve a CineSubz drive page URL to the final one-click direct file URL.

Protocol (reverse engineered from the page's JS):
  1. GET  /api/download-data<path>      -> JSON {redirect} + session cookie
  2. GET  <host><redirect>              -> download page HTML (contains hex payloads)
  3. POST <host><redirect>  body=bytes  -> protobuf DownloadData{url, error}
  4. url field is CryptoJS AES (passphrase) -> base64 -> final URL
"""
import base64
import hashlib
import json
import re
import ssl
import urllib.error
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


# ---------- CryptoJS passphrase AES ----------
def _evp(password: bytes, salt: bytes, key_len=32, iv_len=16):
    dtot, d = b'', b''
    while len(dtot) < key_len + iv_len:
        d = hashlib.md5(d + password + salt).digest()
        dtot += d
    return dtot[:key_len], dtot[key_len:key_len + iv_len]


def cryptojs_decrypt(b64: str, passphrase: str) -> str:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    raw = base64.b64decode(b64)
    if raw[:8] == b'Salted__':
        salt = raw[16 - 8:16]
        key, iv = _evp(passphrase.encode(), salt)
        body = raw[16:]
    else:
        key, iv = _evp(passphrase.encode(), b'')
        body = raw
    pt = Cipher(algorithms.AES(key), modes.CBC(iv)).decryptor().update(body)
    # cryptojs may not pad when output is block aligned; strip PKCS7 only if valid
    pad = pt[-1]
    if 1 <= pad <= 16 and pt.endswith(bytes([pad]) * pad):
        pt = pt[:-pad]
    return pt.decode('utf-8')


def decrypt_final_url(blob: str) -> str:
    plain = cryptojs_decrypt(blob, 'ektebtaj')
    # plain is base64 of the utf-8 url
    try:
        return base64.b64decode(plain).decode('utf-8')
    except Exception:
        return plain


# ---------- protobuf ----------
def _varint(b, i):
    n = s = 0
    while True:
        c = b[i]; i += 1
        n |= (c & 0x7f) << s
        if not c & 0x80:
            return n, i
        s += 7


def parse_download_data(buf: bytes):
    i, out = 0, {}
    while i < len(buf):
        tag, i = _varint(buf, i)
        fn, wt = tag >> 3, tag & 7
        if wt == 2:
            ln, i = _varint(buf, i)
            val = buf[i:i + ln].decode('utf-8', 'replace'); i += ln
        elif wt == 0:
            val, i = _varint(buf, i)
        else:
            break
        out[fn] = val
    return out.get(1, ''), out.get(2, '')


# ---------- HTTP ----------
def _open(req, jar, timeout=30):
    return urllib.request.urlopen(req, timeout=timeout)


def resolve(drive_url: str, log=print) -> dict:
    """drive_url: e.g. https://drive.csplayer2.space/server6/202601/file.mp4"""
    parts = urllib.request.urlparse(drive_url)
    host = f"{parts.scheme}://{parts.netloc}"
    path = parts.path + (f"?{parts.query}" if parts.query else "")

    jar = urllib.request.HTTPCookieProcessor()
    opener = urllib.request.build_opener(jar)
    opener.addheaders = [("User-Agent", UA)]

    # step 0: visit the loader page first (registers the file in the session)
    req = urllib.request.Request(host + path, headers={"User-Agent": UA})
    with opener.open(req, timeout=30) as r:
        r.read()

    # step 1: API (registers session, returns redirect target)
    api = f"{host}/api/download-data{path}"
    req = urllib.request.Request(api, headers={"User-Agent": UA, "Accept": "application/json",
                                               "Referer": host + path})
    with opener.open(req, timeout=30) as r:
        data = json.loads(r.read().decode())
    if not data.get("success"):
        return {"ok": False, "stage": "api", "error": data}
    target = host + data["redirect"]
    log(f"  [api] redirect -> {target[:110]}")

    # step 2: download page HTML
    req = urllib.request.Request(target, headers={"User-Agent": UA, "Referer": host + "/"})
    with opener.open(req, timeout=30) as r:
        html = r.read().decode('utf-8', 'replace')
    if 'id="dl-links"' not in html and 'dl-links' not in html:
        return {"ok": False, "stage": "page", "error": "download page not returned", "len": len(html)}

    payloads = []
    for mo in re.finditer(r"'([0-9a-f]{300,})'", html):
        h = mo.group(1)
        if h not in payloads:
            payloads.append(h)
    log(f"  [page] {len(html)} bytes, {len(payloads)} distinct payloads")

    # step 3/4: POST each payload until we get a url
    attempts = []
    for n, hex_payload in enumerate(payloads, 1):
        body = bytes.fromhex(hex_payload)
        req = urllib.request.Request(
            target, data=body, method="POST",
            headers={"User-Agent": UA, "Content-Type": "application/octet-stream",
                     "Referer": target, "Origin": host, "Accept": "*/*"})
        try:
            with opener.open(req, timeout=30) as r:
                raw = r.read()
        except urllib.error.HTTPError as e:
            attempts.append({"payload": n, "status": e.code})
            log(f"  [post {n}] HTTP {e.code}")
            continue
        if raw[:1] == b'{':
            attempts.append({"payload": n, "json": raw[:120].decode('utf-8', 'replace')})
            log(f"  [post {n}] json: {raw[:120]!r}")
            continue
        url, err = parse_download_data(raw)
        attempts.append({"payload": n, "url": url, "error": err, "bytes": len(raw)})
        log(f"  [post {n}] err={err!r} url={url[:100]!r}")
        if url:
            try:
                final = decrypt_final_url(url)
            except Exception as e:
                return {"ok": False, "stage": "decrypt", "error": str(e), "attempts": attempts}
            return {"ok": True, "direct_url": final, "attempts": attempts}
    return {"ok": False, "stage": "post", "attempts": attempts}


if __name__ == "__main__":
    import sys
    u = sys.argv[1]
    print(json.dumps(resolve(u), indent=2))
