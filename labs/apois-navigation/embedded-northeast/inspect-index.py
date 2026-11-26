"""Read-only check of official Valhalla 3.6.3 graph extract; no extraction."""
import hashlib,json,pathlib,re,struct,sys,tarfile
path=pathlib.Path(sys.argv[1]);size=path.stat().st_size
assert 1024<=size<=8*1024**3 and size%512==0
with tarfile.open(path,"r:") as tar:
    entries=tar.getmembers()
    assert 2<=len(entries)<=100001
    assert entries[0].name=="index.bin" and all(m.isfile() for m in entries)
    assert len({m.name for m in entries})==len(entries)
    expected={}
    for m in entries[1:]:
        assert re.fullmatch(r"[012](?:/[0-9]{3}){2,3}\.gph",m.name),m.name
        level,idx=m.name[:-4].split("/",1)
        tileid=int(level)|(int(idx.replace("/",""))<<3)
        assert tileid not in expected and m.size>0 and m.offset_data+m.size<=size
        expected[tileid]=(m.offset_data,m.size)
    assert entries[0].size==16*len(expected)
    raw=tar.extractfile(entries[0]).read()
    actual={}
    for offset,tileid,n in struct.iter_unpack("<QLL",raw):
        assert tileid not in actual
        actual[tileid]=(offset,n)
    assert actual==expected
with path.open("rb") as f: sha=hashlib.file_digest(f,"sha256").hexdigest()
result={"engine_version":"3.6.3","bytes":size,"sha256":sha,"tiles":len(expected),"active":False,"scope":"server graph validation only; Android full-region performance not established"}
pathlib.Path(sys.argv[2]).write_text(json.dumps(result,indent=2)+"\n")
print("APOIS_NORTHEAST_GRAPH_OK",json.dumps(result))
