import json,math,pathlib,sys,time,urllib.request
out=pathlib.Path(sys.argv[1])
assert json.loads((out/"status.json").read_text())["version"]=="3.6.3"
cases=[("Petrolina",(-9.403901,-40.5040233),(-9.397901,-40.4980233)),
       ("Juazeiro",(-9.4165,-40.5035),(-9.4225,-40.5095)),
       ("PE-BA",(-9.403901,-40.5040233),(-9.4165,-40.5035)),
       ("BA-PE",(-9.4165,-40.5035),(-9.403901,-40.5040233))]
def decode(s):
    i=0;lat=lon=0;points=[]
    while i<len(s):
        vals=[]
        for _ in range(2):
            n=shift=0
            while True:
                assert i<len(s) and shift<=30
                c=ord(s[i])-63;i+=1
                assert 0<=c<=63
                n|=(c&31)<<shift
                if c<32:break
                shift+=5
            vals.append(~(n>>1) if n&1 else n>>1)
        lat+=vals[0];lon+=vals[1];points.append((lat/1e6,lon/1e6))
    return points
def distance(a,b):
    la,lo=map(math.radians,a);lb,lob=map(math.radians,b)
    h=math.sin((lb-la)/2)**2+math.cos(la)*math.cos(lb)*math.sin((lob-lo)/2)**2
    return 12742000*math.asin(math.sqrt(min(1,max(0,h))))
result=[]
for label,a,b in cases:
    body={"locations":[{"lat":p[0],"lon":p[1],"type":"break"} for p in (a,b)],"costing":"auto","units":"kilometers","language":"pt-BR","format":"osrm","shape_format":"polyline6","voice_instructions":True,"banner_instructions":True}
    start=time.monotonic()
    req=urllib.request.Request("http://127.0.0.1:8002/route",data=json.dumps(body).encode(),headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=45) as r: raw=r.read(2_000_001)
    assert len(raw)<=2_000_000
    data=json.loads(raw);assert data["code"]=="Ok"
    route=data["routes"][0];assert route["distance"]>0 and route["duration"]>0
    points=decode(route["geometry"])
    assert 2<=len(points)<=100000 and all(-9.65<=lat<=-9.10 and -40.80<=lon<=-40.20 for lat,lon in points)
    snaps=[distance(points[0],a),distance(points[-1],b)]
    steps=[s for leg in route["legs"] for s in leg["steps"]]
    voice=sum(len(s.get("voiceInstructions",[])) for s in steps);banners=sum(len(s.get("bannerInstructions",[])) for s in steps)
    assert voice>0 and banners>0
    result.append({"case":label,"distance_m":route["distance"],"duration_s":route["duration"],"snap_m":snaps,"snap_accepted":max(snaps)<=150,"voice":voice,"banners":banners,"ms":round((time.monotonic()-start)*1000,2)})
(out/"launch-vale-routes.json").write_text(json.dumps(result,indent=2)+"\n")
print("APOIS_VALE_ROUTE_REPORT",json.dumps(result))
assert all(r["snap_accepted"] for r in result), "At least one reference fails existing 150m gate"
