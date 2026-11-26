import pathlib,sys,json,hashlib,shutil,re
src,dst,kotlin=map(pathlib.Path,sys.argv[1:]);raw=(src/"manifest.json").read_bytes();m=json.loads(raw)
assert m["region"]=="itainopolis-picos-lab" and m["active"] is False
assert m["source_sha256"]=="7a0510393910c0f26b96bb6bd254b4d92890e74cf1db90363e3e801a16ae3379"
assert m["extract_sha256"]=="fd9182eb0bd8c7c10ee9e1ae493b9b4e7c1b69055e05b6ea5e6ca81a5718273d"
expected={"pilot.pmtiles":"42caee4dab60fc7c1669782eb996fd65c2728f75d0390659e09adf55c56ae36c","itainopolis-route.json":"800d3f622c09c304eb3be7d7686280869f4608e3fd5581094c618cc825b5ab61","picos-route.json":"31674dddbea605c931742cd7b1f1d01cda4dadbd6e03996d8615860615550a33","corridor-route.json":"d4f2a038cba4b650c0c901adc373b9cf1e65a1b530551637dd77663321bb254c"}
assert 8<=len(m["files"])<=36 and sum(f["bytes"] for f in m["files"])<=16*1024*1024
seen=set()
for f in m["files"]:
    name=f["path"];assert name not in seen;seen.add(name)
    assert name in set(expected)|{"style.json","OSM-NOTICE.txt","glyphs/LICENSE-Open-Sans.txt"} or re.fullmatch(r"glyphs/Open Sans Regular/[0-9]+-[0-9]+[.]pbf",name)
    data=(src/name).read_bytes();assert len(data)==f["bytes"] and hashlib.sha256(data).hexdigest()==f["sha256"]
    if name in expected:assert f["sha256"]==expected[name]
    p=dst/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
assert set(expected)<=seen
(dst/"manifest.json").write_bytes(raw)
kotlin.write_text('package br.com.apois.navigation.lab\ninternal const val FIELD_MANIFEST_SHA256="'+hashlib.sha256(raw).hexdigest()+'"\n')
