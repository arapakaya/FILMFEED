import json, re, codecs

strings = json.load(open('work/strings.json', encoding='utf-8'))
m = {int(i): v for i, v in strings}
s = open('work/script_4.js', encoding='utf-8').read()

BS = chr(92)

def unescape(v):
    if BS + 'x' in v or BS + 'u' in v:
        try:
            return codecs.decode(v, 'unicode_escape')
        except Exception:
            return v
    return v

def repl(mo):
    idx = int(mo.group(2), 16) - 0x140
    if idx in m:
        v = unescape(m[idx])
        v = v.replace(BS, BS + BS).replace("'", "\\'")
        return "'" + v + "'"
    return mo.group(0)

out = re.sub(r'(_0x[0-9a-f]+)\((0x[0-9a-f]+)\)', repl, s)
open('work/script_4_deob.js', 'w', encoding='utf-8').write(out)
print("written", len(out))

for kw in ['fetch(', 'decrypt', 'fordev', 'hexToBytes', 'dl-links', 'automate']:
    i = out.find(kw)
    print(f"===== {kw} @{i} =====")
    if i >= 0:
        print(out[max(0, i - 800):i + 1000].replace('\n', ' '))
        print()
