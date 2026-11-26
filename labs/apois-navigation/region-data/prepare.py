"""Derive conservative endpoint-only policy from IBGE 2025 regional geometry.
No activation, credentials or production configuration. Keep exact source provenance."""
import hashlib,json,pathlib,sys,unicodedata
import geopandas as gpd
from shapely.geometry import mapping
from shapely.ops import unary_union
def sha(p):
    with p.open("rb") as f: return hashlib.file_digest(f,"sha256").hexdigest()
def norm(s):
    return "".join(c for c in unicodedata.normalize("NFKD",str(s).strip().lower()) if not unicodedata.combining(c))
src=pathlib.Path(sys.argv[1]).resolve(); out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
g=gpd.read_file("zip://"+str(src))
assert g.crs is not None and len(g)==5
assert "NM_REGIAO" in g.columns and "CD_REGIAO" in g.columns, list(g.columns)
ne=g[g["NM_REGIAO"].map(norm)=="nordeste"]
assert len(ne)==1 and str(ne.iloc[0]["CD_REGIAO"])=="2"
assert ne.geometry.notna().all() and ne.geometry.is_valid.all()
original=ne.to_crs(4326).geometry.iloc[0]
assert original.geom_type in ("Polygon","MultiPolygon") and original.is_valid
# Conservative operational test area: remove a 100m strip, simplify 10m
# in metric CRS, and verify the result remains inside the original.
metric=ne.to_crs(5880).geometry.iloc[0]
assert metric.is_valid and metric.area>0
candidate=metric.buffer(-100).simplify(10,preserve_topology=True)
assert candidate.is_valid and not candidate.is_empty and candidate.geom_type in ("Polygon","MultiPolygon")
assert metric.covers(candidate)
fraction=candidate.area/metric.area
assert 0.98<fraction<=1
geo=gpd.GeoSeries([candidate],crs=5880).to_crs(4326).iloc[0]
assert geo.is_valid and original.covers(geo)
polys=[geo] if geo.geom_type=="Polygon" else list(geo.geoms)
vertices=sum(len(p.exterior.coords)+sum(len(r.coords) for r in p.interiors) for p in polys)
assert vertices<=250000 and len(polys)<=4096
raw=json.dumps(mapping(geo),ensure_ascii=False,separators=(",",":")).encode()
assert len(raw)<=8*1024*1024
p=out/"nordeste-candidate.geojson";p.write_bytes(raw)
report={"source":"IBGE Malha Municipal Digital / Grandes Regiões 2025","source_url":"https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2025/Brasil/BR_Regioes_2025.zip","source_sha256":sha(src),"candidate_sha256":sha(p),"region_code":"2","area_fraction":fraction,"vertices":vertices,"polygons":len(polys),"bytes":len(raw),"inset_m":100,"simplify_m":10,"crs":"EPSG:4326","active":False,"limits":"Conservative candidate for endpoints only; excludes border strip and may exclude small islands. No proof of route geometry or road accessibility. Source hash recorded, not independently pinned."}
(out/"region-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(report,ensure_ascii=False))
