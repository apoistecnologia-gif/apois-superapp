"""Manifest for explicitly retained candidate. Not a signed update or deploy."""
import hashlib,json,pathlib,re,sys
HEX=re.compile(r"[0-9a-f]{64}")
def digest(p):
    with p.open("rb") as f: return hashlib.file_digest(f,"sha256").hexdigest()
def expected(p):
    v=p.read_text().split()[0]
    if not HEX.fullmatch(v): raise ValueError("invalid hash")
    return v
def build(report,root):
    source=expected(report/"source.sha256")
    map_hash=expected(report/"map.sha256")
    coverage=json.loads((report/"map-coverage.json").read_text())
    routes=json.loads((report/"routing-coverage.json").read_text())
    if len(coverage["samples"])!=11 or len({s["uf"] for s in coverage["samples"]})!=9 or not all(s["roads"]>0 for s in coverage["samples"]): raise ValueError("map gate failed")
    if len(routes["cases"])!=15 or not all(c["ok"] for c in routes["cases"]): raise ValueError("route gate failed")
    status=json.loads((report/"valhalla-status.json").read_text())
    if not status.get("version"): raise ValueError("missing Valhalla version")
    files=[]
    for name in ("nordeste.pmtiles","valhalla_tiles.tar"):
        p=root/name
        if p.is_symlink() or not p.is_file() or p.stat().st_size<=0: raise ValueError("missing archive")
        h=digest(p); n=p.stat().st_size
        if name=="nordeste.pmtiles" and (h!=map_hash or n!=coverage["archive_bytes"]): raise ValueError("map archive mismatch")
        files.append({"path":name,"bytes":n,"sha256":h})
    p=root/"OSM-NOTICE.txt"
    p.write_text("© OpenStreetMap contributors\nData: ODbL 1.0\nhttps://www.openstreetmap.org/copyright\nSource: Geofabrik Nordeste SHA-256 "+source+"\n",encoding="utf-8")
    files.append({"path":p.name,"bytes":p.stat().st_size,"sha256":digest(p)})
    manifest={"schema":1,"region":"br-nordeste","source_sha256":source,"valhalla_version":status["version"],"files":files,"deployable":False,"limits":"candidate only; no signed release, service configuration, style/glyph delivery or public distribution authorization"}
    manifest["bundle_id"]=hashlib.sha256(json.dumps(manifest,sort_keys=True,separators=(",",":")).encode()).hexdigest()
    (root/"manifest.json").write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    return manifest
if __name__=="__main__": print(json.dumps(build(pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2])),indent=2))
