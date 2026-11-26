import sys,json,math,os,pathlib,urllib.request,urllib.error
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
secret=os.environ["APOIS_FIELD_DYNAMIC_SECRET"]
def body(a,b):
    return dict(locations=[dict(lat=p[0],lon=p[1],type="break") for p in (a,b)],costing="auto",units="kilometers",language="pt-BR",format="osrm",voice_instructions=True,banner_instructions=True,shape_format="polyline6")
def request(a,b,token=secret):
    headers={"Content-Type":"application/json"}
    if token:headers["Authorization"]="Bearer "+token
    try:
        with urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8003/route",data=json.dumps(body(a,b)).encode(),headers=headers),timeout=15) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:return e.code,json.load(e)
def decode(s):
    i=0;lat=lon=0;points=[]
    while i<len(s):
        delta=[]
        for _ in range(2):
            v=shift=0
            while True:
                assert i<len(s) and shift<=30
                b=ord(s[i])-63;i+=1;assert 0<=b<=63
                v|=(b&31)<<shift;shift+=5
                if b<32:break
            delta.append(~(v>>1) if v&1 else v>>1)
        lat+=delta[0];lon+=delta[1];points.append((lat/1e6,lon/1e6))
    return points
def distance(a,b):
    x,y=map(math.radians,a);u,v=map(math.radians,b)
    return 6371000*2*math.asin(min(1,math.sqrt(math.sin((u-x)/2)**2+math.cos(x)*math.cos(u)*math.sin((v-y)/2)**2)))
# Public reference coordinates only, not the user's device location.
a=(-7.4475,-41.4786);b=(-7.4415,-41.4726);c=(-7.0769,-41.4669);d=(-7.0709,-41.4609)
assert request(a,b,None)[0]==401
assert request(a,b,"0"*64)[0]==401
assert request((-9.4,-40.5),b)[0]==400
assert request(a,(-9.4,-40.5))[0]==400
cases=[("urban_initial",a,b),("urban_changed_origin",b,a),("picos_initial",c,d),("picos_changed_origin",d,c),("intercity",a,c),("intercity_changed_origin",b,c)]
report=[];geoms={}
for name,origin,target in cases:
    status,data=request(origin,target);assert status==200,(name,status,data)
    r=data["routes"][0];p=decode(r["geometry"]);assert len(p)>=2
    assert all(-7.75<=x<=-6.85 and -41.85<=y<=-41.15 for x,y in p),name
    assert distance(origin,p[0])<=150 and distance(target,p[-1])<=150,name
    steps=[s for leg in r["legs"] for s in leg["steps"]]
    assert r["distance"]>0 and r["duration"]>0
    assert any(s.get("voiceInstructions") for s in steps) and any(s.get("bannerInstructions") for s in steps)
    geoms[name]=r["geometry"]
    report.append(dict(case=name,distance_m=r["distance"],duration_s=r["duration"],origin_snap_m=round(distance(origin,p[0]),2),target_snap_m=round(distance(target,p[-1]),2)))
    (out/(name+".json")).write_text(json.dumps(data,ensure_ascii=False))
assert geoms["intercity"]!=geoms["intercity_changed_origin"]
(out/"report.json").write_text(json.dumps({"routes":report,"rejections":4,"scope":"public synthetic endpoints, real local Valhalla, not actual user GPS or production"},indent=2))
print("APOIS_DYNAMIC_OK routes=6 rejections=4 changed_origin=true")
