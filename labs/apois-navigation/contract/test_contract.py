"""Use actual pyvalhalla locally to build OSRM guidance for the Ferrostar replay."""
import json,pathlib,sys,subprocess,re
from valhalla import Actor,get_config
work=pathlib.Path(sys.argv[1]).resolve()
tiles=work/"tiles"
tiles.mkdir(exist_ok=True)
config=get_config(tile_dir=str(tiles),tile_extract="")
config["mjolnir"]["concurrency"]=2
# No admin, timezone, elevation or traffic downloads in this fictional grid.
config["mjolnir"]["admin"]=""
config["mjolnir"]["timezone"]=""
cfg=work/"valhalla.json"
cfg.write_text(json.dumps(config))
subprocess.run([sys.executable,"-m","valhalla","valhalla_build_tiles","-c",str(cfg),str(work/"grid.osm.pbf")],check=True,timeout=120)
actor=Actor(config)
dest=(-1.994,-19.994)
def get_route(origin,destination):
    payload={"locations":[{"lat":lat,"lon":lon,"type":"break"} for lat,lon in (origin,destination)],
      "costing":"auto","units":"kilometers","language":"pt-BR","format":"osrm",
      "voice_instructions":True,"banner_instructions":True,"shape_format":"polyline6"}
    data=actor.route(payload)
    if isinstance(data,str): data=json.loads(data)
    assert data.get("code")=="Ok",data
    route=data["routes"][0]
    assert route["distance"]>0 and route["duration"]>0 and route["geometry"]
    steps=[step for leg in route["legs"] for step in leg["steps"]]
    assert len(steps)>=2 and all(step["geometry"] for step in steps)
    voice=[v["announcement"] for step in steps for v in step.get("voiceInstructions",[]) if v.get("announcement")]
    banners=[b for step in steps for b in step.get("bannerInstructions",[])]
    assert voice,"Valhalla failed to return spoken guidance"
    assert banners,"Valhalla failed to return visual guidance"
    assert any(re.search(r"\b(vire|siga|continue|chegou|destino|direita|esquerda|metros|pegue|mantenha)\b",v,re.I) for v in voice),voice
    return data,{"distance_m":route["distance"],"duration_s":route["duration"],"voice":voice,"banners":len(banners)}
initial,first=get_route((-2.0,-20.0),dest)
# Alternate location on a different road; request a fresh route to same destination.
alternate,second=get_route((-1.997,-20.0),dest)
assert initial["routes"][0]["geometry"]!=alternate["routes"][0]["geometry"]
assert initial["waypoints"][-1]["location"]==alternate["waypoints"][-1]["location"]
for name,data in [("initial",initial),("recalculated",alternate)]:
    (work/(name+".json")).write_text(json.dumps(data,ensure_ascii=False))
report={"fixture":"synthetic_grid","language_requested":"pt-BR","initial":first,"recalculated":second,
"same_destination":True,"different_geometry":True,"limits":"No real roads, no live GPS, no traffic, no audible TTS. Recalculation is explicit second local request."}
(work/"contract-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
print("APOIS_VALHALLA_CONTRACT_OK",json.dumps(report,ensure_ascii=False))
