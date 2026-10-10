import json, urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
HOST = "https://drive.csplayer2.space"
PATH = "/server6/202601/Avatar%20Fire%20and%20Ash%20(2025)%20English%20WEB-%5BCineSubz.co%5D-480p.mp4"

jar = urllib.request.HTTPCookieProcessor()
op = urllib.request.build_opener(jar)

def show(tag, r):
    print(tag, r.status if hasattr(r, 'status') else r.code, "set-cookie:", r.headers.get('Set-Cookie'))
    print("   cookies now:", [(c.name, c.value[:20]) for c in jar.cookiejar])

# 0) loader page first (as a browser would)
r = op.open(urllib.request.Request(HOST + PATH, headers={"User-Agent": UA}), timeout=30)
body = r.read()
print("0) loader GET", len(body))
show("0", r)

# 1) API
r = op.open(urllib.request.Request(f"{HOST}/api/download-data{PATH}",
                                   headers={"User-Agent": UA, "Accept": "application/json"}), timeout=30)
print("1) api:", r.read()[:200])
show("1", r)

# 2) target
req = urllib.request.Request(HOST + PATH, headers={"User-Agent": UA})
try:
    r = op.open(req, timeout=30)
    b = r.read()
    print("2) target", len(b), "dl-links" in b.decode('utf-8', 'replace'))
    show("2", r)
except urllib.error.HTTPError as e:
    print("2) HTTP", e.code, e.headers.get('Location'))
