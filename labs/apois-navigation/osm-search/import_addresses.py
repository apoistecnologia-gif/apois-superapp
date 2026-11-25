#!/usr/bin/env python3
"""Build a disabled address catalog from verified regional OSM node data."""
import argparse
import hashlib
import json
import math
import pathlib
import subprocess
import tempfile
import unicodedata
import uuid
import xml.etree.ElementTree as ET

NAMESPACE = uuid.UUID("a5a0d359-70e1-4d7e-8c39-b0370471b677")
MAX_POINTS = 100_000


def clean(value):
    value = " ".join(unicodedata.normalize("NFC", value or "").split())
    if len(value) > 120 or any(unicodedata.category(c).startswith("C") for c in value):
        return ""
    return value


def read_addresses(source, digest, version):
    rows = {}
    parser = ET.iterparse(source, events=("start", "end"))
    _, root = next(parser)
    if root.tag != "osm":
        raise ValueError("Expected OSM XML")
    for event, element in parser:
        if event != "end" or element.tag != "node":
            continue
        tags = {tag.get("k"): tag.get("v") for tag in element.findall("tag")}
        number = clean(tags.get("addr:housenumber"))
        street = clean(tags.get("addr:street"))
        place = clean(tags.get("addr:place"))
        neighborhood = clean(tags.get("addr:suburb")) or clean(tags.get("addr:neighbourhood"))
        lat, lng = float(element.attrib["lat"]), float(element.attrib["lon"])
        osm_id = int(element.attrib["id"])
        label = f"{street or place}, {number}"
        if (
            len(label) <= 120 and number and (street or place) and osm_id > 0
            and math.isfinite(lat) and math.isfinite(lng)
            and -9.65 <= lat <= -9.10 and -40.80 <= lng <= -40.20
        ):
            if osm_id in rows or len(rows) >= MAX_POINTS:
                raise ValueError("Duplicate OSM node or address catalog capacity exceeded")
            rows[osm_id] = {
                "id": str(uuid.uuid5(NAMESPACE, f"osm:address-node:{osm_id}")),
                "version": version, "extract_sha256": digest, "osm_kind": "node",
                "osm_id": osm_id, "label": label, "lat": lat, "lng": lng,
                "active": False, "street": street, "house_number": number,
                "neighborhood": neighborhood or (place if street else ""),
            }
        root.clear()
    return [rows[key] for key in sorted(rows)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verified-extract", required=True, type=pathlib.Path)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--version", required=True, type=int)
    parser.add_argument("--out", required=True, type=pathlib.Path)
    args = parser.parse_args()
    if args.version < 1:
        parser.error("--version must be positive")
    with args.verified_extract.open("rb") as source:
        if hashlib.file_digest(source, "sha256").hexdigest() != args.sha256:
            raise ValueError("OSM extract digest mismatch")
    with tempfile.TemporaryDirectory(prefix="apois-osm-address-") as work:
        work = pathlib.Path(work)
        filtered = work / "address-nodes.osm.pbf"
        xml = work / "address-nodes.osm"
        subprocess.run([
            "osmium", "tags-filter", "-R", str(args.verified_extract),
            "n/addr:housenumber", "-o", str(filtered),
        ], check=True, timeout=120)
        subprocess.run(["osmium", "cat", str(filtered), "-f", "osm", "-o", str(xml)],
                       check=True, timeout=120)
        rows = read_addresses(xml, args.sha256, args.version)
    manifest = {
        "format": "apois-independent-catalog-v1", "source": "OSM_PBF",
        "extract_sha256": args.sha256, "version": args.version, "count": len(rows),
        "license": "ODbL-1.0", "attribution": "© OpenStreetMap contributors", "rows": rows,
    }
    with args.out.open("x", encoding="utf8") as out:
        json.dump(manifest, out, ensure_ascii=False, separators=(",", ":"))
        out.write("\n")
    print(f"APOIS_OSM_ADDRESS_CATALOG: {len(rows)} disabled address nodes")


if __name__ == "__main__":
    main()
