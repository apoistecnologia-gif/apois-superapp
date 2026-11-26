"""Validate the uncompressed Valhalla 3.6.3 tar/index without extracting files."""
import hashlib,json,pathlib,re,struct,sys,tarfile
def inspect(path):
    size=path.stat().st_size
    assert 1024<=size<=128*1024*1024 and size%512==0
    with tarfile.open(path,"r:") as tar:
        entries=tar.getmembers()
        assert 2<=len(entries)<=1025
        assert entries[0].name=="index.bin" and all(m.isfile() for m in entries)
        assert len({m.name for m in entries})==len(entries)
        expected={}
        for m in entries[1:]:
            assert re.fullmatch(r"[012](?:/[0-9]{3}){2,3}\.gph",m.name),m.name
            level,idx=m.name[:-4].split("/",1)
            tileid=int(level)|(int(idx.replace("/",""))<<3)
            assert tileid not in expected and m.size>0 and m.offset_data+m.size<=size
            expected[tileid]=(m.offset_data,m.size)
        idx=tar.extractfile(entries[0]).read()
        assert len(idx)==16*len(expected)
        actual={}
        for offset,tileid,n in struct.iter_unpack("<QLL",idx):
            assert tileid not in actual
            actual[tileid]=(offset,n)
        assert actual==expected
    with path.open("rb") as f:
        sha=hashlib.file_digest(f,"sha256").hexdigest()
    return {"bytes":size,"sha256":sha,"tiles":len(expected)}
if __name__=="__main__":
    out=pathlib.Path(sys.argv[1]); graph=inspect(out/"valhalla_tiles.tar")
    manifest={"schema":1,"active":False,"region":"itainopolis-picos-lab","bounds":[-41.85,-7.75,-41.15,-6.85],"engine_version":"3.6.3","mobile_wrapper":"0.6.3","mobile_valhalla_commit":"e2f017b16080f49203de245a211b09efab09cf72","source_sha256":(out/"source.sha256").read_text().split()[0],"extract_sha256":(out/"extract.sha256").read_text().split()[0],"image":(out/"image-digest.txt").read_text().strip(),"graph":graph,"license":"ODbL-1.0"}
    (out/"graph-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    print("APOIS_GRAPH_OK",json.dumps(graph))
