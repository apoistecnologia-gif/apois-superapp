"""Assemble an inactive, content-addressed candidate from exact CI artifacts."""
import hashlib,json,pathlib,shutil,sys
mapdir,searchdir,out=map(pathlib.Path,sys.argv[1:])
out.mkdir(parents=True,exist_ok=False)
source="49cad6d647ad887d95c56677bd0c02e732ef9984b1aa6ac92b0dfe018eb08835"
extract="c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238"
m=json.loads((mapdir/"launch-vale-manifest.json").read_text())
s=json.loads((searchdir/"search-report.json").read_text())
assert m["source_sha256"]==source and m["extract_sha256"]==s["extract_sha256"]==extract
assert m["engine_version"]=="3.6.3" and not m["active"] and not s["active"]
def verify(path,expected,size):
    assert path.is_file() and path.stat().st_size==size
    with path.open("rb") as f: assert hashlib.file_digest(f,"sha256").hexdigest()==expected
files=[]
for src,name,n,sha in [
    (mapdir/"vale.pmtiles","map.pmtiles",3422737,"18dc74cfea6ab6a8365b48df0731173b794825b108ed1f72db740ed16c3490fe"),
    (mapdir/"graph.tar","graph.tar",8263680,"38cf6df5fdd080ac4feb5c053a417fb4b814119765bc8214ad7593da985a1433"),
    (searchdir/"search-candidates.json","search.json",1433158,"9864919ce496184b917818f56d00406ef367c1987cdf37f24cc524c324bc08fa")]:
    verify(src,sha,n)
    shutil.copyfile(src,out/name)
    verify(out/name,sha,n)
    files.append({"name":name,"bytes":n,"sha256":sha})
assert s["sha256"]==files[-1]["sha256"] and s["bytes"]==files[-1]["bytes"]
files.sort(key=lambda x:x["name"])
# Same canonical identity as OfflinePackSpec in Kotlin. The field sourceSha
# identifies the exact regional extract, not merely its parent PBF.
canonical="\n".join(["vale-pe-ba",extract,"3.6.3"]+[f"{x['name']}:{x['bytes']}:{x['sha256']}" for x in files])
identity=hashlib.sha256(canonical.encode()).hexdigest()
manifest={"schema":1,"active":False,"signed":False,"region":"vale-pe-ba","source_sha256":source,"extract_sha256":extract,"engine":"3.6.3","identity":identity,"files":files,
"license":"ODbL-1.0","attribution":"© OpenStreetMap contributors","source_runs":[45748506856,45748780382],"limits":"Three data files only. Style/glyphs, production signing, authenticated distribution and license release gates remain separate."}
(out/"candidate.json").write_text(json.dumps(manifest,indent=2)+"\n")
(out/"OSM-NOTICE.txt").write_text("© OpenStreetMap contributors\nODbL 1.0 https://www.openstreetmap.org/copyright\nRegional extract "+extract+"\nParent source "+source+"\nLaboratory candidate; not authorized for distribution.\n")
print("APOIS_VALE_PACK",json.dumps(manifest))
