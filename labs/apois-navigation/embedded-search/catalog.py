"""Offline pilot search candidates from OSM only. No activation of passenger catalog."""
import argparse, collections, hashlib, json, math, pathlib, re, subprocess, tempfile, unicodedata, xml.etree.ElementTree as ET

EXTRACT_SHA = "fd9182eb0bd8c7c10ee9e1ae493b9b4e7c1b69055e05b6ea5e6ca81a5718273d"
BOUNDS = (-41.85, -7.75, -41.15, -6.85)
MAX_ROWS = 50000
MAX_NODES = 500000
MAX_BYTES = 16 * 1024 * 1024

def clean(s):
    s = unicodedata.normalize("NFC", s or "")
    if any(unicodedata.category(c).startswith("C") for c in s): return ""
    s = " ".join(s.split())
    return s if len(s)<=120 else ""

def inside(lat, lon):
    return math.isfinite(lat) and math.isfinite(lon) and BOUNDS[1]<=lat<=BOUNDS[3] and BOUNDS[0]<=lon<=BOUNDS[2]

def key(s):
    return " ".join(re.findall(r"[a-z0-9]+", "".join(c for c in unicodedata.normalize("NFKD",s.casefold()) if not unicodedata.combining(c))))

def read_xml(path):
    nodes,rows={},[]
    parser=ET.iterparse(path,events=("start","end"))
    _,root=next(parser)
    if root.tag!="osm": raise ValueError("invalid OSM root")
    def add(kind, osm_id, label, point, tags, source_type, number=""):
        if not label or len(label)>240 or not inside(*point): return
        if len(rows)>=MAX_ROWS: raise ValueError("candidate count exceeds pilot capacity")
        rows.append({"id":f"{source_type}:{osm_id}:{kind}","kind":kind,"label":label,
                     "lat":point[0],"lon":point[1],"number":number,
                     "locality":clean(tags.get("addr:city")) or clean(tags.get("addr:suburb")),
                     "requires_confirmation":True})
    for event,e in parser:
        if event!="end" or e.tag not in ("node","way","relation"):continue
        osm_id=int(e.attrib["id"])
        if osm_id<=0: raise ValueError("invalid source ID")
        tags={t.get("k"):t.get("v") for t in e.findall("tag")}
        name=clean(tags.get("name"))
        if e.tag=="node":
            point=(float(e.attrib["lat"]),float(e.attrib["lon"]))
            if len(nodes)>=MAX_NODES or osm_id in nodes:raise ValueError("node capacity or duplicate")
            nodes[osm_id]=point
            number=clean(tags.get("addr:housenumber"))
            street=clean(tags.get("addr:street")) or clean(tags.get("addr:place"))
            if number and street:add("address",osm_id,f"{street}, {number}",point,tags,"node",number)
            if name and tags.get("place") in {"city","town","village","hamlet","suburb","neighbourhood","quarter"}:
                add("place",osm_id,name,point,tags,"node")
        elif e.tag=="way" and name and tags.get("highway") in {"motorway","trunk","primary","secondary","tertiary","unclassified","residential","living_street","service","road"}:
            refs=[int(n.attrib["ref"]) for n in e.findall("nd")]
            if any(r not in nodes for r in refs):raise ValueError("missing referenced node")
            points=[nodes[r] for r in refs if inside(*nodes[r])]
            if points:
                # Existing road vertex, not a fabricated house number or geocoded address.
                add("street",osm_id,name,points[len(points)//2],tags,"way")
        root.clear()
    ids={r["id"] for r in rows}
    if len(ids)!=len(rows):raise ValueError("duplicate candidate IDs")
    return sorted(rows,key=lambda r:r["id"])

def search(rows, query, limit=12):
    terms=key(query).split()
    if len(query)>120 or not terms or len("".join(terms))<2:return []
    numeric={t for t in terms if t.isdigit()}
    found=[]
    for r in rows:
        label=key(r["label"]+" "+r["locality"]).split()
        nums=set(key(r["number"]).split())
        if numeric and (r["kind"]!="address" or not numeric<=nums):continue
        if all(any(word.startswith(t) for word in label) for t in terms):
            score=(0 if key(r["label"])==key(query) else 1, {"address":0,"place":1,"street":2}[r["kind"]],r["label"],r["id"])
            found.append((score,r))
    return [r for _,r in sorted(found,key=lambda x:x[0])[:max(0,min(limit,20))]]

def main():
    p=argparse.ArgumentParser();p.add_argument("extract",type=pathlib.Path);p.add_argument("out",type=pathlib.Path);a=p.parse_args()
    with a.extract.open("rb") as f: digest=hashlib.file_digest(f,"sha256").hexdigest()
    if digest!=EXTRACT_SHA:raise ValueError("OSM source differs from V4.1; cannot combine catalog with approved pilot")
    with tempfile.TemporaryDirectory() as d:
        filtered=pathlib.Path(d)/"filtered.osm.pbf"; xml=pathlib.Path(d)/"filtered.osm"
        subprocess.run(["osmium","tags-filter",str(a.extract),"w/highway","n/addr:housenumber","n/place","-o",str(filtered)],check=True,timeout=180)
        subprocess.run(["osmium","cat",str(filtered),"-f","osm","-o",str(xml)],check=True,timeout=180)
        rows=read_xml(xml)
    counts=dict(collections.Counter(r["kind"] for r in rows))
    assert counts.get("street",0)>0 and counts.get("place",0)>0
    for q in ("Itainopolis","Picos"):
        assert any(r["kind"]=="place" and key(r["label"])==key(q) for r in search(rows,q,20)),q
    manifest={"schema":1,"active":False,"extract_sha256":digest,"license":"ODbL-1.0","attribution":"© OpenStreetMap contributors","bounds":BOUNDS,"rows":rows}
    data=(json.dumps(manifest,ensure_ascii=False,separators=(",",":"))+"\n").encode()
    if len(data)>MAX_BYTES:raise ValueError("catalog byte capacity exceeded")
    a.out.mkdir(parents=True,exist_ok=True)
    (a.out/"search-candidates.json").write_bytes(data)
    report={"counts":counts,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),"extract_sha256":digest,"active":False,"limits":"OSM candidates, not unique roads or verified routable addresses"}
    (a.out/"search-report.json").write_text(json.dumps(report,indent=2)+"\n")
    print("APOIS_PILOT_SEARCH_OK",json.dumps(report))
if __name__=="__main__":main()
