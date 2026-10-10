import base64, hashlib, re
from pathlib import Path

def evp_bytes_to_key(password: bytes, salt: bytes, key_len=32, iv_len=16):
    dtot = b''
    d = b''
    while len(dtot) < key_len + iv_len:
        d = hashlib.md5(d + password + salt).digest()
        dtot += d
    return dtot[:key_len], dtot[key_len:key_len + iv_len]

def cryptojs_decrypt(b64: str, passphrase: str) -> str:
    raw = base64.b64decode(b64)
    assert raw[:8] == b'Salted__', 'not a CryptoJS Salted blob'
    salt = raw[8:16]
    key, iv = evp_bytes_to_key(passphrase.encode(), salt)
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    dec = cipher.decryptor()
    pt = dec.update(raw[16:]) + dec.finalize()
    pad = pt[-1]
    if pad < 1 or pad > 16:
        raise ValueError('bad padding')
    return pt[:-pad].decode('utf-8')

deob = open('work/script_4_deob.js', encoding='utf-8').read()

# 1) protobuf schema
m = re.search(r"decrypt\('(U2FsdGVkX18[^']+)','kasun'\)", deob)
schema = cryptojs_decrypt(m.group(1), 'kasun')
Path('work/download.proto').write_text(schema, encoding='utf-8')
print('=== PROTO SCHEMA ===')
print(schema)

# 2) button table: find the array of {id, data, ...} objects
print('=== button payload entries ===')
for mo in re.finditer(r"\{\s*'id'\s*:\s*'([a-z]+)'\s*,\s*'data'\s*:\s*'([0-9a-f]{60,})'([^}]*)\}", deob):
    print('id=', mo.group(1), 'data_len=', len(mo.group(2)), 'tail=', mo.group(3)[:120].replace('\n', ' '))
# fallback: looser pattern
if 'id' not in deob:
    pass
