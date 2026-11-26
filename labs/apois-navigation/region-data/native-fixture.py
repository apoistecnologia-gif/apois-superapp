"""Convert the exact pinned IBGE lab candidate into a strict native fixture."""
import hashlib,json,pathlib,struct,sys
root=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
raw=(root/"nordeste-candidate.geojson").read_bytes()
assert hashlib.sha256(raw).hexdigest()=="f1a9e0ed64b711981fdda17b45e8b838836eda812d13da6e03e69aed3e6837c3"
geo=json.loads(raw);polys=[geo["coordinates"]] if geo["type"]=="Polygon" else geo["coordinates"]
data=bytearray(struct.pack(">II",0x41505231,len(polys)))
for poly in polys:
    data.extend(struct.pack(">I",len(poly)))
    for ring in poly:
        data.extend(struct.pack(">I",len(ring)))
        for x,y in ring:data.extend(struct.pack(">dd",x,y))
(out/"region.apr").write_bytes(data)
(out/"region.sha256").write_text(hashlib.sha256(data).hexdigest()+"\n")
s=json.loads((pathlib.Path(__file__).parent.parent/"northeast/samples.json").read_text())
rows=[(name,lat,lon,1) for _,name,lat,lon in s["cities"]]
rows.extend([("Belém",-1.4558,-48.5039,0),("Brasília",-15.7939,-47.8828,0),("Belo Horizonte",-19.9167,-43.9345,0),("São Paulo",-23.5505,-46.6333,0),("Atlântico",-10,-30,0),("Exterior",0,0,0)])
assert len(rows)==17
(out/"samples.tsv").write_text("".join("\t".join(map(str,row))+"\n" for row in rows))
print("Native fixture bytes",len(data),"SHA-256",hashlib.sha256(data).hexdigest())
