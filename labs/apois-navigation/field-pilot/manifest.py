import hashlib,pathlib,json,sys
out=pathlib.Path(sys.argv[1])
source=(out/"source-sha256.txt").read_text().strip()
extract=(out/"extract.sha256").read_text().split()[0]
notice=out/"OSM-NOTICE.txt"
notice.write_text("© OpenStreetMap contributors\nODbL 1.0 https://www.openstreetmap.org/copyright\nSource: OpenStreetMap France Piauí\nSource SHA-256 "+source+"\nExtract SHA-256 "+extract+"\n",encoding="utf-8")
files=[]
for p in sorted([out/"pilot.pmtiles",out/"style.json",notice,*out.glob("*-route.json"),*out.glob("glyphs/**/*.pbf"),out/"glyphs/LICENSE-Open-Sans.txt"]):
    with p.open("rb") as f:h=hashlib.file_digest(f,"sha256").hexdigest()
    files.append({"path":str(p.relative_to(out)),"bytes":p.stat().st_size,"sha256":h})
assert len(files)>=8 and sum(f["bytes"] for f in files)<=16*1024*1024
m={"schema":1,"region":"itainopolis-picos-lab","source_sha256":source,"extract_sha256":extract,"files":files,"active":False,"limits":"Fixed public test routes only, not on-device dynamic routing; no backend or deploy"}
(out/"manifest.json").write_text(json.dumps(m,indent=2,ensure_ascii=False)+"\n")
print(json.dumps(m,ensure_ascii=False))
