"""Decode actual regional MVT data and inspect public OSM geometry/labels."""
import collections, gzip, json, math, pathlib, sys, unicodedata
import mapbox_vector_tile
from pmtiles.reader import Reader, MemorySource, all_tiles
from pmtiles.tile import Compression
archive=pathlib.Path(sys.argv[1])
output=pathlib.Path(sys.argv[2])
source=MemorySource(archive.read_bytes())
reader=Reader(source)
header=reader.header()
counts=collections.Counter()
names=set()
cities=set()
bridges=set()
by_zoom=collections.Counter()
def decode(raw):
    if header["tile_compression"]==Compression.GZIP: raw=gzip.decompress(raw)
    else: assert header["tile_compression"]==Compression.NONE
    return mapbox_vector_tile.decode(raw)
def normalized(s):
    return "".join(c for c in unicodedata.normalize("NFD",s.lower()) if not unicodedata.combining(c))
def xy(lat,lon,z):
    n=2**z
    return int((lon+180)/360*n),int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
# Decode all addressed tiles, not only metadata or sample headers.
for (z,x,y),raw in all_tiles(source):
    by_zoom[z]+=1
    for layer,data in decode(raw).items():
        for feature in data["features"]:
            counts[layer]+=1
            props=feature["properties"]
            name=props.get("name")
            if layer in ("roads","places") and isinstance(name,str) and name.strip():
                names.add(name)
                if layer=="places" and props.get("class") in ("city","town"): cities.add(normalized(name))
            if layer=="roads" and props.get("bridge") not in (None,"no",False,""):
                bridges.add(name or props.get("class","unknown"))
assert sum(by_zoom.values())==header["addressed_tiles_count"]
assert all(counts[k]>0 for k in ("roads","water","waterway","green","buildings","places")),counts
assert len(names)>100,(len(names),counts)
assert "petrolina" in cities and "juazeiro" in cities,cities
assert bridges,"No bridge attribute in decoded road tiles"
# Public approximate city centres and crossing corridor. Nearby tiles, not exact address validation.
samples={}
for label,lat,lon in [("petrolina",-9.403901,-40.5040233),("juazeiro",-9.4165,-40.5035),("bridge_corridor",-9.410,-40.504)]:
    x,y=xy(lat,lon,15)
    local=collections.Counter(); named=0; bridge=0
    for dx in (-1,0,1):
        for dy in (-1,0,1):
            raw=reader.get(15,x+dx,y+dy)
            if not raw: continue
            for layer,data in decode(raw).items():
                local[layer]+=len(data["features"])
                if layer=="roads":
                    for f in data["features"]:
                        named+=bool(f["properties"].get("name"))
                        bridge+=f["properties"].get("bridge") not in (None,"no",False,"")
    assert local["roads"]>0 and named>0,(label,local,named)
    if label=="bridge_corridor":
        assert bridge>0 and (local["water"]+local["waterway"])>0,(label,local,bridge)
    samples[label]={"features":dict(local),"named_road_features":named,"bridge_road_features":bridge}
codepoints=sorted({ord(c) for name in names for c in name if not c.isspace()})
(output/"label-codepoints.json").write_text(json.dumps(codepoints))
print(json.dumps({"tiles_decoded":sum(by_zoom.values()),"tiles_by_zoom":dict(sorted(by_zoom.items())),
    "feature_counts_with_zoom_duplicates":dict(counts),"distinct_road_and_place_names":len(names),
    "bridge_names_or_classes":len(bridges),"samples":samples,
    "limits":"OSM content, not completeness or real-world road legality; features counted across zooms"},ensure_ascii=False,indent=2))
