"""Self-contained one-click direct URL resolver for CineSubz drive pages.

Everything (payloads + AES passphrase candidates) is extracted from the SAME
download page HTML that we POST to, so per-page randomized obfuscation is handled.
"""
import base64
import hashlib
import json
import re
import urllib.error
import urllib.parse
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


# ---------------- CryptoJS AES (passphrase, "Salted__") ----------------
def _evp(pw: bytes, salt: bytes, klen=32, ilen=16):
    total, d = b'', b''
    while len(total) < klen + ilen:
        d = hashlib.md5(d + pw + salt).digest()
        total += d
    return total[:klen], total[klen:klen + ilen]


def _aes_cbc(key, iv, body):
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    return Cipher(algorithms.AES(key), modes.CBC(iv)).decryptor().update(body)


def cryptojs_decrypt(b64: str, passphrase: str) -> str:
    raw = base64.b64decode(b64)
    if raw[:8] == b'Salted__':
        key, iv = _evp(passphrase.encode(), raw[8:16])
        body = raw[16:]
    else:
        key, iv = _evp(passphrase.encode(), b'')
        body = raw
    pt = _aes_cbc(key, iv, body)
    pad = pt[-1]
    if 1 <= pad <= 16 and pt.endswith(bytes([pad]) * pad):
        pt = pt[:-pad]
    return pt.decode('utf-8')


def try_unwrap_url(blob: str, candidates):
    """Return final URL if some candidate passphrase decrypts blob to base64 url."""
    for pw in candidates:
        try:
            plain = cryptojs_decrypt(blob, pw)
        except Exception:
            continue
        plain = plain.strip()
        try:
            decoded = base64.b64decode(plain, validate=True).decode('utf-8')
        except Exception:
            continue
        if decoded.startswith('http'):
            return decoded, pw
    return None, None


# ---------------- protobuf ----------------
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
            out[fn] = buf[i:i + ln].decode('utf-8', 'replace'); i += ln
        elif wt == 0:
            out[fn], i = _varint(buf, i)
        else:
            break
    return out.get(1, ''), out.get(2, '')


# ---------------- main ----------------
def resolve(drive_url: str, log=print) -> dict:
    parts = urllib.parse.urlsplit(drive_url)
    host = f"{parts.scheme}://{parts.netloc}"
    path = parts.path + (f"?{parts.query}" if parts.query else "")

    jar = urllib.request.HTTPCookieProcessor()
    op = urllib.request.build_opener(jar)
    op.addheaders = [("User-Agent", UA)]

    def get(url, headers=None, timeout=40):
        h = {"User-Agent": UA}
        h.update(headers or {})
        return op.open(urllib.request.Request(url, headers=h), timeout=timeout)

    # 1) loader page  (registers file into session)
    get(host + path).read()

    # 2) API -> redirect target
    with get(f"{host}/api/download-data{path}", {"Accept": "application/json"}) as r:
        data = json.loads(r.read().decode())
    if not data.get("success"):
        return {"ok": False, "stage": "api", "error": data}
    target = host + data["redirect"]
    log(f"  [api] {data['redirect'][:100]}")

    # 3) download page
    with get(target, {"Referer": host + "/"}) as r:
        page = r.read().decode('utf-8', 'replace')
    if "dl-links" not in page:
        return {"ok": False, "stage": "page", "error": "no download page", "len": len(page)}
    log(f"  [page] {len(page)} bytes")

    payloads, seen = [], set()
    for mo in re.finditer(r"'([0-9a-f]{300,})'", page):
        if mo.group(1) not in seen:
            seen.add(mo.group(1)); payloads.append(mo.group(1))
    # passphrase candidates: short literals inside the page's obfuscated scripts
    candidates = sorted({s for s in re.findall(r"'([A-Za-z0-9_\-]{4,24})'", page)
                         if not s.startswith(('http', 'div', 'span', 'imag', 'butt'))},
                        key=len)
    log(f"  [page] {len(payloads)} payloads, {len(candidates)} passphrase candidates")

    attempts = []
    for n, hp in enumerate(payloads, 1):
        try:
            req = urllib.request.Request(
                target, data=bytes.fromhex(hp), method="POST",
                headers={"User-Agent": UA, "Content-Type": "application/octet-stream",
                         "Referer": target, "Origin": host})
            with op.open(req, timeout=40) as r:
                raw = r.read()
        except urllib.error.HTTPError as e:
            attempts.append({"n": n, "http": e.code}); log(f"  [post {n}] HTTP {e.code}")
            continue
        except Exception as e:
            attempts.append({"n": n, "err": str(e)}); log(f"  [post {n}] {e}"); continue

        if raw[:1] == b'{':
            attempts.append({"n": n, "json": raw[:100].decode('utf-8', 'replace')})
            log(f"  [post {n}] json {raw[:80]!r}")
            continue
        url_field, err = parse_download_data(raw)
        if not url_field:
            attempts.append({"n": n, "error": err or "empty", "bytes": len(raw)})
            log(f"  [post {n}] empty (err={err!r}, {len(raw)}B)")
            continue
        final, pw = try_unwrap_url(url_field, candidates)
        attempts.append({"n": n, "err": err, "decrypted": bool(final)})
        if final:
            log(f"  [post {n}] DECRYPTED with {pw!r}")
            return {"ok": True, "direct_url": final, "passphrase": pw,
                    "error_field": err, "attempts": attempts}
        log(f"  [post {n}] got blob but no passphrase matched")
    return {"ok": False, "stage": "post", "attempts": attempts}


if __name__ == "__main__":
    import sys
    print(json.dumps(resolve(sys.argv[1]), indent=2))
