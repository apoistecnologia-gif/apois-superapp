"""Verify actual Nginx byte ranges on loopback only. No production traffic."""
import json, pathlib, sys, time, urllib.request, urllib.error, urllib.parse
path=pathlib.Path(sys.argv[1])
url=sys.argv[2]
assert urllib.parse.urlsplit(url).hostname=="127.0.0.1"
size=path.stat().st_size
def request(headers=None, method="GET"):
    return urllib.request.urlopen(urllib.request.Request(url,headers=headers or {},method=method),timeout=5)
for attempt in range(20):
    try:
        with request(method="HEAD") as r:
            assert r.status==200 and int(r.headers["Content-Length"])==size
            etag=r.headers["ETag"]
            assert etag and not etag.startswith("W/")
            assert "immutable" in r.headers["Cache-Control"]
            assert r.headers.get("Content-Encoding") in (None,"identity")
        break
    except (OSError,urllib.error.URLError):
        if attempt==19: raise
        time.sleep(.25)
ranges=[(0,126),(127,min(16383,size-1)),(max(0,size-1024),size-1)]
total=0
for start,end in ranges:
    assert start<=end
    with request({"Range":f"bytes={start}-{end}","If-Range":etag,"Accept-Encoding":"identity"}) as r:
        assert r.status==206
        assert r.headers["Content-Range"]==f"bytes {start}-{end}/{size}"
        assert r.headers["ETag"]==etag
        assert r.headers.get("Content-Encoding") in (None,"identity")
        with path.open("rb") as f:
            f.seek(start)
            assert r.read(end-start+2)==f.read(end-start+1)
        total+=end-start+1
try:
    with request({"Range":f"bytes={size}-"}) as r:
        raise AssertionError(f"Unexpected range status {r.status}")
except urllib.error.HTTPError as e:
    assert e.code==416
try:
    with request({"If-None-Match":etag}) as r:
        raise AssertionError(f"Unexpected conditional status {r.status}")
except urllib.error.HTTPError as e:
    assert e.code==304
print(json.dumps({"archive_bytes":size,"sample_range_bytes":total,"ranges_checked":len(ranges),"status_checks":[206,416,304],"etag_stable":True,"limits":"Loopback static delivery only; no CDN/TLS/mobile bandwidth test"},indent=2))
