"""Extract only required open glyph ranges from the pinned archive, no TTF files."""
import gzip, json, pathlib, re, sys, zipfile, io
archive, out, points = pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]),pathlib.Path(sys.argv[3])
font="Open Sans Regular"
out.mkdir(parents=True,exist_ok=True)
required=set(json.loads(points.read_text()))
# Require accented Portuguese letters plus common map punctuation.
portuguese={ord(c) for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ .,-–ºª"}
required|=portuguese
ranges=sorted({c//256*256 for c in required if c<=65535})
assert len(ranges)<=32,"Unexpected glyph range count"
def varint(stream):
    value=0
    for shift in range(0,70,7):
        b=stream.read(1)
        if not b: raise EOFError()
        n=b[0]; value|=(n&127)<<shift
        if n<128:return value
    raise ValueError("invalid varint")
def fields(data):
    stream=io.BytesIO(data)
    while stream.tell()<len(data):
        tag=varint(stream); field,wire=tag>>3,tag&7
        if wire==0: v=varint(stream)
        elif wire==2:
            n=varint(stream);v=stream.read(n);assert len(v)==n
        elif wire in (1,5):
            n=8 if wire==1 else 4;v=stream.read(n);assert len(v)==n
        else: raise ValueError("unsupported protobuf wire type")
        yield field,wire,v
def ids(data):
    result=set()
    for field,wire,stack in fields(data):
        if field!=1 or wire!=2:continue
        for f,w,g in fields(stack):
            if f!=3 or w!=2:continue
            for gf,gw,v in fields(g):
                if gf==1 and gw==0:result.add(v)
    return result
available=set(); written=[]; total=0
with zipfile.ZipFile(archive) as z:
    for start in ranges:
        basename=f"{start}-{start+255}.pbf"
        matches=[i for i in z.infolist() if i.filename.endswith("/"+font+"/"+basename) or i.filename==font+"/"+basename]
        if not matches:continue
        assert len(matches)==1 and matches[0].file_size<=2_000_000
        raw=z.read(matches[0])
        data=gzip.decompress(raw) if raw[:2]==b"\x1f\x8b" else raw
        assert len(data)<=2_000_000
        chars=ids(data)
        assert chars and all(start<=c<=start+255 for c in chars)
        dest=out/font/basename;dest.parent.mkdir(exist_ok=True);dest.write_bytes(data)
        available|=chars;written.append(basename);total+=len(data)
missing=required-available
assert not (portuguese-available),sorted(portuguese-available)
print(json.dumps({"font":font,"ranges":written,"glyph_bytes":total,"required_codepoints":len(required),
    "missing_codepoints":sorted(missing),"portuguese_coverage":True,
    "limits":"Missing non-Portuguese characters may require a licensed fallback; no native rendering tested"},indent=2))
