import hashlib,json,pathlib,sys
out=pathlib.Path(sys.argv[1])
source=(out/"source-sha256.txt").read_text().strip()
extract=(out/"extract.sha256").read_text().split()[0]
def info(name):
 p=out/name
 with p.open("rb") as f: sha=hashlib.file_digest(f,"sha256").hexdigest()
 return {"name":name,"bytes":p.stat().st_size,"sha256":sha}
files=[info("vale.pmtiles"),info("graph.tar")]
g=json.loads((out/"graph-index-report.json").read_text())
assert g["sha256"]==files[1]["sha256"] and g["bytes"]==files[1]["bytes"]
assert sum(f["bytes"] for f in files)<=128*1024*1024
manifest={"schema":1,"active":False,"region":"vale-pe-ba","engine_version":"3.6.3","source_sha256":source,"extract_sha256":extract,"files":files,"license":"ODbL-1.0","attribution":"© OpenStreetMap contributors","limits":"candidate map and graph; no search, signature, active host or production authorization"}
(out/"launch-vale-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
print("APOIS_LAUNCH_VALE_CANDIDATE",json.dumps(manifest))
