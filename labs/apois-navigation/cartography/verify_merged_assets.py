"""Verify the actual Gradle merged assets, not just source pack existence."""
import hashlib,json,pathlib,sys
pack=pathlib.Path(sys.argv[1]); build=pathlib.Path(sys.argv[2])
candidates=[p.parent for p in build.rglob("manifest.json") if p.parent.name=="apois-regional"]
assert candidates,"Gradle merged regional assets missing"
def verify(root):
    manifest=json.loads((root/"manifest.json").read_text())
    assert manifest==json.loads((pack/"manifest.json").read_text())
    expected={x["path"] for x in manifest["files"]}|{"manifest.json"}
    assert {str(p.relative_to(root)) for p in root.rglob("*") if p.is_file()}==expected
    for entry in manifest["files"]:
        f=root/entry["path"]
        assert f.stat().st_size==entry["bytes"]
        assert hashlib.sha256(f.read_bytes()).hexdigest()==entry["sha256"]
for root in candidates: verify(root)
print(json.dumps({"verified_merged_asset_directories":len(candidates),"files_including_manifest":len(json.loads((pack/"manifest.json").read_text())["files"])+1,"limits":"Gradle asset merge only, no APK or native rendering"},indent=2))
