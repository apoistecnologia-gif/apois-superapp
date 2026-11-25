#!/usr/bin/env python3
"""Offline, deterministic regional OSM POI catalog. No queries to Google or
live clients. Input hash must be supplied by the trusted extract pipeline."""
import argparse
import hashlib
import json
import math
import pathlib
import shutil
import subprocess
import tempfile
import unicodedata
import uuid
import xml.etree.ElementTree as ET

NAMESPACE = uuid.UUID("a5a0d359-70e1-4d7e-8c39-b0370471b677")
AMENITIES = {"hospital","clinic","pharmacy","school","university","library","bus_station",
             "police","fire_station","townhall","marketplace","theatre","cinema","community_centre"}
TOURISM = {"museum","attraction","gallery"}
LEISURE = {"park","sports_centre","stadium"}
MAX_INPUT = 128 * 1024 * 1024
MAX_XML = 512 * 1024 * 1024
MAX_POINTS = 20000

def sha(path):
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()

def parse_nodes(path, digest, version):
    result = []
    seen = set()
    root = None
    for event, elem in ET.iterparse(path, events=("start", "end")):
        if root is None:
            root = elem
            if root.tag != "osm":
                raise ValueError("not OSM XML")
        if event != "end":
            continue
        if elem.tag == "node":
            tags = {tag.get("k"): tag.get("v") for tag in elem.findall("tag")}
            public = (tags.get("amenity") in AMENITIES or tags.get("tourism") in TOURISM
                      or tags.get("leisure") in LEISURE or tags.get("public_transport") == "station")
            if public and tags.get("access") not in {"private","no","customers"}:
                label = unicodedata.normalize("NFC", tags.get("name") or "").strip()
                if 1 <= len(label) <= 120 and not any(unicodedata.category(c).startswith("C") for c in label):
                    osm_id = int(elem.attrib["id"])
                    lat, lng = float(elem.attrib["lat"]), float(elem.attrib["lon"])
                    if osm_id > 0 and math.isfinite(lat) and math.isfinite(lng) and -9.65 <= lat <= -9.10 and -40.80 <= lng <= -40.20:
                        if osm_id in seen:
                            raise ValueError("duplicate OSM node")
                        seen.add(osm_id)
                        result.append({"id":str(uuid.uuid5(NAMESPACE, f"osm:node:{osm_id}")),
                            "version":version,"osm_kind":"node","osm_id":osm_id,
                            "extract_sha256":digest,"label":label,"lat":lat,"lng":lng,"active":False})
                        if len(result)>MAX_POINTS:
                            raise ValueError("catalog capacity exceeded")
            root.clear()
        elif elem.tag in {"way","relation","bounds"}:
            root.clear()
    return sorted(result,key=lambda r:r["osm_id"])

def build(source, expected, version, output, fixture=False):
    if not isinstance(version,int) or isinstance(version,bool) or not 1<=version<=2147483647:
        raise ValueError("invalid catalog version")
    if len(expected)!=64 or any(c not in "0123456789abcdef" for c in expected):
        raise ValueError("expected trusted lowercase SHA-256")
    if not source.is_file() or source.stat().st_size>MAX_INPUT:
        raise ValueError("invalid regional extract")
    if output.exists():
        raise ValueError("refusing to overwrite catalog")
    with tempfile.TemporaryDirectory(prefix="apois-independent-") as work:
        work=pathlib.Path(work)
        snapshot=work/("source.osm" if fixture else "source.osm.pbf")
        shutil.copyfile(source,snapshot)
        if snapshot.stat().st_size>MAX_INPUT or sha(snapshot)!=expected:
            raise ValueError("extract digest mismatch")
        if fixture:
            xml=snapshot
        else:
            # Select node candidates before converting to XML, without
            # fetching referenced ways or relations. All output remains local.
            filtered=work/"nodes.osm.pbf"
            subprocess.run(["osmium","tags-filter","-R",str(snapshot),"n/amenity","n/tourism","n/leisure","n/public_transport","-o",str(filtered)],check=True,timeout=120)
            xml=work/"nodes.osm"
            subprocess.run(["osmium","cat",str(filtered),"-f","osm","-o",str(xml)],check=True,timeout=120)
        if xml.stat().st_size>MAX_XML:
            raise ValueError("expanded extract exceeds bound")
        rows=parse_nodes(xml,expected,version)
        if not rows:
            raise ValueError("no eligible regional points")
        manifest={"format":"apois-independent-catalog-v1","source":"SYNTHETIC_XML_FIXTURE" if fixture else "OSM_PBF",
                  "extract_sha256":expected,"version":version,"count":len(rows),
                  "license":"ODbL-1.0","attribution":"© OpenStreetMap contributors","rows":rows}
        with output.open("x",encoding="utf-8") as f:
            json.dump(manifest,f,ensure_ascii=False,sort_keys=True,separators=(",",":"))
            f.write("\n")
        return manifest

if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--extract",required=True,type=pathlib.Path)
    p.add_argument("--expected-sha256",required=True)
    p.add_argument("--version",required=True,type=int)
    p.add_argument("--out",required=True,type=pathlib.Path)
    p.add_argument("--fixture-xml",action="store_true")
    args=p.parse_args()
    report=build(args.extract,args.expected_sha256,args.version,args.out,args.fixture_xml)
    print("APOIS_CATALOG_OK",json.dumps({k:v for k,v in report.items() if k!="rows"}))
