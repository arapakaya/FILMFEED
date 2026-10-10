"""Dump raw POST responses for every payload to files for inspection."""
import json, re, urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
HOST = "https://drive.csplayer2.space"
PATH = "/server6/202601/Avatar%20Fire%20and%20Ash%20(2025)%20English%20WEB-%5BCineSubz.co%5D-480p.mp4"

jar = urllib.request.HTTPCookieProcessor()
op = urllib.request.build_opener(jar)
op.addheaders = [("User-Agent", UA)]

r = op.open(HOST + PATH, timeout=30); r.read()
r = op.open(urllib.request.Request(f"{HOST}/api/download-data{PATH}",
                                   headers={"Accept": "application/json"}), timeout=30)
print("api:", r.read()[:160])
r = op.open(urllib.request.Request(HOST + PATH), timeout=30)
html = r.read().decode('utf-8', 'replace')
print("page len:", len(html))
open('work/page_fresh.html', 'w', encoding='utf-8').write(html)

payloads = []
for mo in re.finditer(r"'([0-9a-f]{300,})'", html):
    if mo.group(1) not in payloads:
        payloads.append(mo.group(1))
print("payloads:", len(payloads))

for n, hp in enumerate(payloads, 1):
    req = urllib.request.Request(HOST + PATH, data=bytes.fromhex(hp), method="POST",
                                 headers={"Content-Type": "application/octet-stream",
                                          "Referer": HOST + PATH, "Origin": HOST})
    try:
        raw = op.open(req, timeout=30).read()
    except urllib.error.HTTPError as e:
        print(n, "HTTP", e.code); continue
    open(f'work/resp_{n}.bin', 'wb').write(raw)
    head = raw[:80]
    print(n, "len", len(raw), "head", head[:60])
