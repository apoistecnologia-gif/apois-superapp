"""Package verified regional map as Android assets. No APK, no deployment."""
import hashlib, json, pathlib, re, shutil, sys
out=pathlib.Path(sys.argv[1])
bundle=out/"android-assets"/"apois-regional"
assert not bundle.exists()
bundle.mkdir(parents=True)
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def copy(src,rel):
    dst=bundle/rel
    dst.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(src,dst)
    return dst
assert json.loads((out/"content-report.json").read_text())["tiles_decoded"]>0
glyph=json.loads((out/"glyph-report.json").read_text())
assert glyph["portuguese_coverage"] and not glyph["missing_codepoints"]
copy(out/"vale.pmtiles","vale.pmtiles")
copy(out/"glyphs"/"LICENSE-Open-Sans.txt","LICENSE-Open-Sans.txt")
for name in glyph["ranges"]:
    assert re.fullmatch(r"\d+-\d+\.pbf",name)
    copy(out/"glyphs"/"Open Sans Regular"/name,"glyphs/Open Sans Regular/"+name)
style=json.loads((out/"style-template.json").read_text())
assert list(style["sources"])==["regional"]
style["sources"]["regional"]["url"]="pmtiles://asset://apois-regional/vale.pmtiles"
style["glyphs"]="asset://apois-regional/glyphs/{fontstack}/{range}.pbf"
# No remote source, sprites or tile templates in the bundled style.
assert not any(key in style for key in ("sprite","imports"))
assert "tiles" not in style["sources"]["regional"]
(bundle/"style.json").write_text(json.dumps(style,ensure_ascii=False,indent=2)+"\n")
source_hash=(out/"source-sha256.txt").read_text().strip()
extract_hash=(out/"extract.sha256").read_text().split()[0]
assert re.fullmatch(r"[a-f0-9]{64}",source_hash) and re.fullmatch(r"[a-f0-9]{64}",extract_hash)
(bundle/"OSM-NOTICE.txt").write_text("© OpenStreetMap contributors\nData: Open Database License 1.0 (ODbL)\nhttps://www.openstreetmap.org/copyright\nGeofabrik regional extract, source SHA-256 "+source_hash+"\nRegional extract SHA-256 "+extract_hash+"\n")
files=[{"path":str(f.relative_to(bundle)),"bytes":f.stat().st_size,"sha256":sha(f)} for f in sorted(bundle.rglob("*")) if f.is_file()]
assert len(files)<=36 and sum(f["bytes"] for f in files)<=16*1024*1024
pack_id=hashlib.sha256("".join(f["sha256"] for f in files).encode()).hexdigest()
manifest={"schema":1,"region":"vale-pe-ba","pack_id":pack_id,"source_sha256":source_hash,"extract_sha256":extract_hash,"files":files}
(bundle/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
print(json.dumps({"pack_id":pack_id,"files":len(files),"asset_bytes":sum(f["bytes"] for f in files)+(bundle/"manifest.json").stat().st_size,"map_uri":style["sources"]["regional"]["url"],"limits":"Generated local assets, not installed or rendered by Android"},indent=2))
