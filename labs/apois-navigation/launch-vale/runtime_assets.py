"""Assemble verified offline runtime assets for a disposable host, not production."""
import hashlib,json,pathlib,re,shutil,sys

EXTRACT="c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238"
SOURCE="49cad6d647ad887d95c56677bd0c02e732ef9984b1aa6ac92b0dfe018eb08835"
MAP_SHA="18dc74cfea6ab6a8365b48df0731173b794825b108ed1f72db740ed16c3490fe"
FILES={"map.pmtiles":(3422737,MAP_SHA),"graph.tar":(8263680,"38cf6df5fdd080ac4feb5c053a417fb4b814119765bc8214ad7593da985a1433"),"search.json":(1433158,"9864919ce496184b917818f56d00406ef367c1987cdf37f24cc524c324bc08fa")}
REQUIRED={"vale.pmtiles","style.json","LICENSE-Open-Sans.txt","OSM-NOTICE.txt","glyphs/Open Sans Regular/0-255.pbf"}
GLYPH=re.compile(r"glyphs/Open Sans Regular/([0-9]{1,5})-([0-9]{1,5})\.pbf")
def sha(p):
    with p.open("rb") as f:return hashlib.file_digest(f,"sha256").hexdigest()
def read_json(p,limit):
    assert p.is_file() and 0<p.stat().st_size<=limit
    return json.loads(p.read_text())
def allowed(name):
    if name in REQUIRED:return True
    m=GLYPH.fullmatch(name)
    if not m:return False
    a,b=map(int,m.groups())
    return 0<=a<=65280 and a%256==0 and b==a+255 and name==f"glyphs/Open Sans Regular/{a}-{b}.pbf"
def verify_file(root,name,size,digest):
    p=root/name
    assert p.resolve()==p.absolute() and p.is_file() and p.stat().st_size==size and sha(p)==digest,name
    return p
def validate_style(s):
    assert s["version"]==8 and set(s["sources"])=={"regional"}
    r=s["sources"]["regional"]
    assert r["type"]=="vector" and r["url"]=="pmtiles://asset://apois-regional/vale.pmtiles"
    assert "tiles" not in r and "sprite" not in s and "imports" not in s
    assert s["glyphs"]=="asset://apois-regional/glyphs/{fontstack}/{range}.pbf"
    # No HTTP strings anywhere in render configuration, including layers.
    # Attribution may be text only; no remote fetch is needed.
    def walk(x):
        if isinstance(x,str):assert not re.search(r"https?://",x,re.I),"remote URI in style"
        elif isinstance(x,dict):
            for v in x.values():walk(v)
        elif isinstance(x,list):
            for v in x:walk(v)
    walk(s)
def assemble(mapdir,packdir,out):
    root=mapdir/"android-assets"/"apois-regional"
    m=read_json(root/"manifest.json",32768);p=read_json(packdir/"candidate.json",32768)
    assert m["schema"]==p["schema"]==1 and m["region"]==p["region"]=="vale-pe-ba"
    assert m["extract_sha256"]==p["extract_sha256"]==EXTRACT and m["source_sha256"]==p["source_sha256"]==SOURCE
    assert p["engine"]=="3.6.3" and p["active"] is False and p["signed"] is False
    rows=m["files"]; names=[x["path"] for x in rows]
    assert 5<=len(rows)<=36 and len(names)==len(set(names)) and REQUIRED<=set(names)
    assert sum(x["bytes"] for x in rows)<=16*1024*1024
    assert m["pack_id"]==hashlib.sha256("".join(x["sha256"] for x in sorted(rows,key=lambda x:x["path"])).encode()).hexdigest()
    for x in rows:
        assert allowed(x["path"]) and 0<x["bytes"]<=16*1024*1024
        verify_file(root,x["path"],x["bytes"],x["sha256"])
    assert sha(root/"vale.pmtiles")==MAP_SHA
    validate_style(read_json(root/"style.json",131072))
    assert len(p["files"])==3 and {x["name"] for x in p["files"]}==set(FILES)
    for x in p["files"]:
        n,h=FILES[x["name"]];assert (x["bytes"],x["sha256"])==(n,h)
        verify_file(packdir,x["name"],n,h)
    assert p["identity"]=="89e4ed84a975713e74e67bcdba4b883caf1b85e1348c2496189c153a2629cfad"
    assert not out.exists()
    # Reuse bundled map format already read by BundledRegionalMap; avoid
    # duplicating map bytes inside the APK. Store graph/search separately.
    for name in names+["manifest.json"]:
        dst=out/"apois-regional"/name;dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(root/name,dst)
    for name in ("graph.tar","search.json","candidate.json","OSM-NOTICE.txt"):
        dst=out/"apois-vale-data"/name;dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(packdir/name,dst)
    report={"active":False,"signed":False,"extract":EXTRACT,"map_sha":MAP_SHA,"pack_identity":p["identity"],"asset_bytes":sum(f.stat().st_size for f in out.rglob("*") if f.is_file()),"files":sum(1 for f in out.rglob("*") if f.is_file())}
    print("APOIS_VALE_RUNTIME_ASSETS",json.dumps(report))
if __name__=="__main__":
    assemble(*(pathlib.Path(x).absolute() for x in sys.argv[1:]))
