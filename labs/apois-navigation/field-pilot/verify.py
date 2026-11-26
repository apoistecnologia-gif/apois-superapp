"""Check actual map tiles and fixed public routes for a foreground GPS pilot."""
import pathlib,sys,json,math,gzip,urllib.request
from collections import Counter
out=pathlib.Path(sys.argv[2]); mode=sys.argv[1]
points={"itainopolis":(-7.4475,-41.4786),"picos":(-7.0769,-41.4669)}
if mode=="map":
    from pmtiles.reader import Reader,all_tiles
    from pmtiles.tile import Compression
    import mapbox_vector_tile
    p=out/"pilot.pmtiles"
    with p.open("rb") as f:
        def read(offset,length):f.seek(offset);return f.read(length)
        reader=Reader(read);h=reader.header()
        assert h["min_zoom"]==8 and h["max_zoom"]==15
        assert "OpenStreetMap" in json.dumps(reader.metadata())
        names=set(); counts=Counter(); n=0
        def decode(b):
            if h["tile_compression"]==Compression.GZIP:b=gzip.decompress(b)
            else: assert h["tile_compression"]==Compression.NONE
            return mapbox_vector_tile.decode(b)
        for _,raw in all_tiles(read):
            n+=1
            for layer,data in decode(raw).items():
                counts[layer]+=len(data["features"])
                for feature in data["features"]:
                    name=feature["properties"].get("name")
                    if isinstance(name,str) and name.strip(): names.add(name)
        assert n==h["addressed_tiles_count"] and n>0
        assert counts["roads"]>0 and counts["places"]>0
        samples={}
        for name,(lat,lon) in points.items():
            z=15;m=2**z;x=int((lon+180)/360*m);y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*m)
            roads=0
            for dx in (-1,0,1):
                for dy in (-1,0,1):
                    b=reader.get(z,x+dx,y+dy)
                    if b:roads+=len(decode(b).get("roads",{}).get("features",[]))
            assert roads>0
            samples[name]=roads
    (out/"label-codepoints.json").write_text(json.dumps(sorted({ord(c) for name in names for c in name if not c.isspace()})))
    report={"source":"OSM France Piauí; bounded extract","tiles_decoded":n,"archive_bytes":p.stat().st_size,"samples":samples,"feature_counts":dict(counts)}
    (out/"content-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))
elif mode=="route":
    cases=[("itainopolis",points["itainopolis"],(-7.4415,-41.4726),300,10000),("picos",points["picos"],(-7.0709,-41.4609),300,10000),("corridor",points["itainopolis"],points["picos"],20000,100000)]
    report=[]
    for name,a,b,lo,hi in cases:
        req={"locations":[{"lat":lat,"lon":lon,"type":"break"} for lat,lon in (a,b)],"costing":"auto","units":"kilometers","language":"pt-BR","format":"osrm","voice_instructions":True,"banner_instructions":True,"shape_format":"polyline6"}
        with urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8002/route",data=json.dumps(req).encode(),headers={"Content-Type":"application/json"}),timeout=45) as r:data=json.load(r)
        assert data["code"]=="Ok"
        route=data["routes"][0];assert lo<=route["distance"]<=hi and route["duration"]>0 and route["geometry"]
        steps=[s for l in route["legs"] for s in l["steps"]]
        voice=sum(len(s.get("voiceInstructions",[])) for s in steps);banner=sum(len(s.get("bannerInstructions",[])) for s in steps)
        assert voice>0 and banner>0
        (out/(name+"-route.json")).write_text(json.dumps(data,ensure_ascii=False))
        report.append({"case":name,"distance_m":route["distance"],"duration_s":route["duration"],"voice":voice,"banners":banner})
    (out/"route-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False))
else:raise SystemExit("invalid mode")
