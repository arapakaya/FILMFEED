import base64, hashlib
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

BLOB = ("U2FsdGVkX19ev0670s8Mnlq+wTYrcgHcw9kxVZh/PaedemW0P/MvcNjB1ZhbearuF25jHISyI/"
        "8gh63eFB7gyK4yYmMAQZyyzTNrIApNntH+Vo6FKxUxlb1drXSngpwAcx1omsNIke/lh940tw5ULA==")

def evp(pw, salt, klen=32, ilen=16):
    dtotal, d = b'', b''
    while len(dtotal) < klen + ilen:
        d = hashlib.md5(d + pw + salt).digest()
        dtotal += d
    return dtotal[:klen], dtotal[klen:klen+ilen]

def try_decrypt(b64, pw, md5=True, klen=32):
    raw = base64.b64decode(b64)
    assert raw[:8] == b'Salted__'
    salt = raw[8:16]
    if md5:
        key, iv = evp(pw.encode(), salt, klen, 16)
    else:
        # sha256 variant
        import subprocess
        key = hashlib.sha256(pw.encode() + salt).digest()[:klen]
        iv = hashlib.sha256(pw.encode() + salt + key).digest()[:16] if klen == 32 else b'\0'*16
    body = raw[16:]
    pt = Cipher(algorithms.AES(key), modes.CBC(iv)).decryptor().update(body)
    return pt

for pw in ['ektebtaj', 'kasun']:
    for md5 in [True]:
        try:
            pt = try_decrypt(BLOB, pw, md5)
            pad = pt[-1]
            stripped = pt[:-pad] if 1 <= pad <= 16 and pt.endswith(bytes([pad])*pad) else pt
            print(f"pw={pw} md5={md5} pad={pad} plain[:80]={stripped[:80]!r}")
            try:
                print("   as utf8:", stripped.decode('utf-8')[:120])
            except Exception as e:
                print("   utf8 fail:", e)
        except Exception as e:
            print(pw, "ERR", e)
