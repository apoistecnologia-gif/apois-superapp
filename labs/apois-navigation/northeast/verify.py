import json, math, pathlib, sys, gzip, time, urllib.request
from collections import Counter
ROOT=pathlib.Path(__file__).parent
SAMPLES=json.loads((ROOT/"samples.json").read_text())
mode=sys.argv[1]; out=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
def emit(name, data):
    (out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps(data,ensure_ascii=False),flush=True)
if mode=="map":
    from pmtiles.reader import Reader
    from pmtiles.tile import Compression
    import mapbox_vector_tile
    archive=pathlib.Path(sys.argv[3])
    result=[]
    with archive.open("rb") as f:
        def source(offset,length):
            f.seek(offset)
            return f.read(length)
        r=Reader(source); h=r.header()
        assert h["min_zoom"]==8 and h["max_zoom"]==15
        metadata=r.metadata()
        assert "OpenStreetMap" in json.dumps(metadata,ensure_ascii=False)
        assert {"roads","places","water","waterway","green","buildings"} <= {v["id"] for v in metadata["vector_layers"]}
        for uf,name,lat,lon in SAMPLES["cities"]:
            z=15;n=2**z
            x=int((lon+180)/360*n);y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
            counts=Counter();named=0
            for dx in (-1,0,1):
                for dy in (-1,0,1):
                    raw=r.get(z,x+dx,y+dy)
                    if not raw: continue
                    if h["tile_compression"]==Compression.GZIP: raw=gzip.decompress(raw)
                    else: assert h["tile_compression"]==Compression.NONE
                    for layer,data in mapbox_vector_tile.decode(raw).items():
                        counts[layer]+=len(data["features"])
                        if layer=="roads": named+=sum(bool(v["properties"].get("name")) for v in data["features"])
            result.append({"uf":uf,"city":name,"roads":counts["roads"],"named_roads":named,"features":dict(counts)})
        emit("map-coverage.json",{"archive_bytes":archive.stat().st_size,"addressed_tiles":h["addressed_tiles_count"],"samples":result,"limits":"sampled tiles, not complete road/address coverage"})
    assert all(s["roads"]>0 for s in result),result
elif mode=="route":
    cases=[]
    for uf,name,lat,lon in SAMPLES["cities"]:
        cases.append((uf+" "+name,[lat,lon],[lat+0.006,lon+0.006]))
    cases+=SAMPLES["crossings"]
    result=[]
    for name,a,b in cases:
        try:
            body={"locations":[{"lat":p[0],"lon":p[1],"type":"break"} for p in (a,b)],"costing":"auto","units":"kilometers","language":"pt-BR","format":"osrm","voice_instructions":True,"banner_instructions":True,"shape_format":"polyline6"}
            t=time.monotonic()
            with urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8002/route",data=json.dumps(body).encode(),headers={"Content-Type":"application/json"}),timeout=45) as response:
                data=json.load(response)
            assert data["code"]=="Ok"
            route=data["routes"][0]
            assert route["distance"]>0 and route["duration"]>0 and route["geometry"]
            steps=[s for l in route["legs"] for s in l["steps"]]
            voice=sum(len(s.get("voiceInstructions",[])) for s in steps)
            banners=sum(len(s.get("bannerInstructions",[])) for s in steps)
            assert voice>0 and banners>0
            result.append({"case":name,"ok":True,"distance_m":route["distance"],"duration_s":route["duration"],"voice":voice,"banners":banners,"ms":round((time.monotonic()-t)*1000,2)})
        except Exception as e:
            result.append({"case":name,"ok":False,"error":type(e).__name__+": "+str(e)[:200]})
    emit("routing-coverage.json",{"cases":result,"limits":"local direct routing sample, not authenticated gateway or field navigation"})
    assert all(s["ok"] for s in result),result
else: raise SystemExit("unknown mode")
