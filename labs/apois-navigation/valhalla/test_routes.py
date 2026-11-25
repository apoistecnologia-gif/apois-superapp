"""Offline lab routing fixtures; no user/driver data, no Google content."""
import json, math, pathlib, statistics, sys, time, urllib.request, concurrent.futures
OUT=pathlib.Path(sys.argv[1])
URL="http://127.0.0.1:8002/route"
# Approximate, manually selected public geographic test points, not validated addresses.
# Petrolina Centro point based on OSM-derived reference: https://guiamapa.com/pe/petrolina/centro/avenida-presidente-dutra
P=(-9.403901,-40.5040233)
J=(-9.4165,-40.5035)
N=(-9.3800,-40.5020)
W=(-9.3990,-40.5220)
cases=[("petrolina_urban",P,N,0.5,20),("juazeiro_urban",J,(-9.4250,-40.4980),0.3,15),("crossing_pe_ba",P,J,0.5,15),("crossing_ba_pe",J,P,0.5,15),("alternate_origin",W,J,0.5,25)]
def route(case):
    name,a,b,lo,hi=case
    req={"locations":[{"lat":a[0],"lon":a[1],"type":"break"},{"lat":b[0],"lon":b[1],"type":"break"}],"costing":"auto","units":"kilometers","language":"pt-BR","directions_type":"instructions"}
    started=time.monotonic()
    with urllib.request.urlopen(urllib.request.Request(URL,data=json.dumps(req).encode(),headers={"Content-Type":"application/json"}),timeout=15) as response:
        data=json.load(response)
    ms=round((time.monotonic()-started)*1000,2)
    trip=data["trip"]; summary=trip["summary"]
    assert trip.get("status")==0,(name,trip.get("status"))
    assert trip.get("language")=="pt-BR",(name,trip.get("language"))
    assert trip.get("units")=="kilometers",(name,trip.get("units"))
    assert lo<=summary["length"]<=hi,(name,summary)
    assert summary["time"]>0,(name,summary)
    maneuvers=[m for leg in trip["legs"] for m in leg["maneuvers"]]
    assert len(maneuvers)>=2 and all(m.get("instruction") for m in maneuvers),(name,"missing instructions")
    assert all(leg.get("shape") for leg in trip["legs"]),(name,"missing geometry")
    # Geometry is Valhalla encoded polyline precision 6. Validate that crossings
    # actually pass near the public bridge corridor (not a guarantee of safe/legal routing).
    points=[]
    for leg in trip["legs"]:
        enc=leg["shape"]; i=0; lat=lon=0
        while i<len(enc):
            pair=[]
            for _ in range(2):
                v=shift=0
                while True:
                    c=ord(enc[i])-63;i+=1;v|=(c&31)<<shift;shift+=5
                    if c<32:break
                pair.append(~(v>>1) if v&1 else v>>1)
            lat+=pair[0];lon+=pair[1];points.append((lat/1e6,lon/1e6))
    if "crossing" in name:
        assert any(-9.414<lat<-9.405 and -40.509<lon<-40.499 for lat,lon in points),(name,"bridge corridor not found")
    return {"case":name,"km":summary["length"],"seconds_estimated":summary["time"],"latency_ms":ms,"maneuvers":len(maneuvers),"first_instruction":maneuvers[0]["instruction"],"last_instruction":maneuvers[-1]["instruction"],"geometry_points":len(points)},data
results=[]
for case in cases:
    result,data=route(case);results.append(result)
    (OUT/(case[0]+".json")).write_text(json.dumps(data,ensure_ascii=False,indent=2))
    print(json.dumps(result,ensure_ascii=False),flush=True)
# Verify actual regional OSRM responses including pt-BR voice/banner data.
def sdk_route(case):
    name,a,b,lo,hi=case
    req={"locations":[{"lat":lat,"lon":lon,"type":"break"} for lat,lon in (a,b)],
        "costing":"auto","units":"kilometers","language":"pt-BR","format":"osrm",
        "voice_instructions":True,"banner_instructions":True,"shape_format":"polyline6"}
    with urllib.request.urlopen(urllib.request.Request(URL,data=json.dumps(req).encode(),headers={"Content-Type":"application/json"}),timeout=15) as response:
        data=json.load(response)
    assert data.get("code")=="Ok",(name,data)
    route=data["routes"][0]
    assert lo*1000<=route["distance"]<=hi*1000 and route["duration"]>0,(name,route["distance"])
    steps=[step for leg in route["legs"] for step in leg["steps"]]
    voice=[v["announcement"] for step in steps for v in step.get("voiceInstructions",[]) if v.get("announcement")]
    banners=[b for step in steps for b in step.get("bannerInstructions",[])]
    assert voice and banners,(name,"missing SDK guidance")
    import re
    assert any(re.search(r"\b(vire|siga|continue|chegou|destino|direita|esquerda|metros|pegue|mantenha|dirija)\b",v,re.I) for v in voice),(name,voice)
    (OUT/("sdk_"+name+".json")).write_text(json.dumps(data,ensure_ascii=False))
    return {"case":name,"distance_m":route["distance"],"voice_count":len(voice),"banner_count":len(banners),"example_voice":voice[0]}
sdk=[sdk_route(case) for case in cases]
(OUT/"sdk-report.json").write_text(json.dumps(sdk,ensure_ascii=False,indent=2))
print("APOIS_REGIONAL_SDK_OK",json.dumps(sdk,ensure_ascii=False),flush=True)
# Small reproducible local load test, not a production capacity certification.
start=time.monotonic()
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    latencies=list(pool.map(lambda i:route(cases[i%len(cases)])[0]["latency_ms"],range(100)))
elapsed=time.monotonic()-start
report={"cases":results,"load":{"requests":100,"concurrency":4,"duration_seconds":round(elapsed,2),"requests_per_second":round(100/elapsed,2),"median_ms":statistics.median(latencies),"p95_ms":sorted(latencies)[math.ceil(.95*len(latencies))-1],"max_ms":max(latencies)},"limits":"Local routing only; no traffic feed, no address search, no live field validation, no tile rendering, no TTS measurement."}
(OUT/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
