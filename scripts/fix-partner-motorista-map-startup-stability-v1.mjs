// APOIS_DRIVER_MAP_STARTUP_STABILITY_V1. Updates disposable partner Motorista only.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
function one(src,before,after,label){
  const hits=src.split(before).length-1;
  if(hits!==1)throw Error("[FAIL] map startup "+label+" count="+hits);
  return src.replace(before,after);
}
function update(path,patch){
  const file=resolve(root,path),old=readFileSync(file,"utf8");
  const next=patch(old);
  if(next===old)throw Error("[FAIL] unchanged "+path);
  writeFileSync(file,next,"utf8");
}
const componentFile=resolve(root,"src/components/routing/DriverMapErrorBoundary.tsx");
mkdirSync(dirname(componentFile),{recursive:true});
writeFileSync(componentFile,"import { Component, type ReactNode } from \"react\";\n\n// APOIS_MOTORISTA_MAP_ERROR_BOUNDARY_V1\n// A Google Maps rendering error must not replace the driver's operational screen.\ntype Props = { children: ReactNode };\ntype State = { failed: boolean };\nexport class DriverMapErrorBoundary extends Component<Props, State> {\n  state: State = { failed: false };\n  static getDerivedStateFromError(): State { return { failed: true }; }\n  componentDidCatch(error: unknown) {\n    if (import.meta.env.DEV) console.warn(\"[APOIS Motorista] erro local do mapa\", error);\n  }\n  render() {\n    if (this.state.failed) {\n      return (\n        <div role=\"alert\" data-apois-driver-map-contained-error=\"true\"\n             className=\"flex h-full min-h-[260px] w-full flex-col items-center justify-center gap-3 bg-[#F4F6F8] px-6 text-center text-[#202A35]\">\n          <p className=\"text-sm font-bold\">O mapa não carregou corretamente.</p>\n          <p className=\"text-xs text-[#536170]\">A tela de corridas continua disponível. Tente iniciar o mapa novamente.</p>\n          <button type=\"button\" onClick={() => this.setState({ failed: false })}\n                  className=\"min-h-11 rounded-xl bg-[#C9141B] px-5 text-sm font-bold text-white\">\n            Reabrir mapa\n          </button>\n        </div>\n      );\n    }\n    return this.props.children;\n  }\n}\n","utf8");
update("src/components/MovviMap.tsx",s=>{
  s=one(s,"useCallback, useEffect, useMemo, useRef, type ReactNode",
            "useCallback, useEffect, useMemo, useRef, useState, type ReactNode","hooks");
  s=one(s,'  themeOverride?: "light" | "dark";',
            '  themeOverride?: "light" | "dark";\n  navigationMode?: boolean;',"prop type");
  s=one(s,"  themeOverride,\n}: MovviMapProps)",
            "  themeOverride,\n  navigationMode = false,\n}: MovviMapProps)","navigation prop");
  s=one(s,"  const mapRef = useRef<google.maps.Map | null>(null);",
            "  const mapRef = useRef<google.maps.Map | null>(null);\n"+
            "  const [tileTimeout, setTileTimeout] = useState(false);\n"+
            "  const [mapAttempt, setMapAttempt] = useState(0);\n"+
            "  const tileTimerRef = useRef<number | null>(null);\n"+
            "  const tileListenerRef = useRef<google.maps.MapsEventListener | null>(null);","tile state");
  const loaded="      map.setOptions({ styles, backgroundColor: bgColor });";
  s=one(s,loaded,loaded+"\n"+
      '      // APOIS_DRIVER_MAP_TILES_WATCHDOG_V1: failed map tiles are visible, not a blank panel.\n'+
      '      if(tileTimerRef.current != null) window.clearTimeout(tileTimerRef.current);\n'+
      '      tileListenerRef.current?.remove();\n'+
      '      setTileTimeout(false);\n'+
      '      tileTimerRef.current=window.setTimeout(()=>setTileTimeout(true),12000);\n'+
      '      tileListenerRef.current=google.maps.event.addListenerOnce(map,"tilesloaded",()=>{\n'+
      '        if(tileTimerRef.current != null) window.clearTimeout(tileTimerRef.current);\n'+
      '        tileTimerRef.current=null;\n'+
      '        setTileTimeout(false);\n'+
      '      });',"tiles status");
  s=one(s,"    if (mapRef.current === map) mapRef.current = null;",
      "    if(tileTimerRef.current != null) window.clearTimeout(tileTimerRef.current);\n"+
      "    tileTimerRef.current=null;\n"+
      "    tileListenerRef.current?.remove();\n"+
      "    tileListenerRef.current=null;\n"+
      "    if (mapRef.current === map) mapRef.current = null;","map unmount cleanup");
  s=one(s,'    <div className={shellClass} style={containerStyle} aria-label="Mapa APOIS">\n      <GoogleMap',
      '    <div className={shellClass + " relative"} style={containerStyle} aria-label="Mapa APOIS">\n      <GoogleMap\n        key={mapAttempt}',"map retry key");
  s=one(s,
      '          renderingType: isDriverRole ? google.maps.RenderingType.VECTOR : undefined,\n          tiltInteractionEnabled: isDriverRole,\n          headingInteractionEnabled: isDriverRole,',
      '          // APOIS_DRIVER_MAP_STARTUP_STABILITY_V1: raster home, vector only during route.\n'+
      '          renderingType: isDriverRole && navigationMode && typeof google !== "undefined"\n'+
      '            ? google.maps?.RenderingType?.VECTOR : undefined,\n'+
      '          tiltInteractionEnabled: isDriverRole && navigationMode,\n'+
      '          headingInteractionEnabled: isDriverRole && navigationMode,',
      "defer risky vector map");
  s=one(s,"      </GoogleMap>\n    </div>",
      "      </GoogleMap>\n"+
      '      {tileTimeout && <div role="alert" data-apois-driver-map-tile-timeout="true" className="absolute inset-x-4 top-24 z-20 rounded-2xl bg-white/95 p-4 text-center text-[#202A35] shadow-lg">\n'+
      '        <p className="text-sm font-bold">O mapa não carregou.</p>\n'+
      '        <p className="mt-1 text-xs">Verifique a conexão e a disponibilidade do Google Maps.</p>\n'+
      '        <button type="button" onClick={()=>{setTileTimeout(false);setMapAttempt(n=>n+1);}}\n'+
      '          className="mt-2 min-h-11 rounded-xl bg-[#C9141B] px-4 text-sm font-bold text-white">Reabrir mapa</button>\n'+
      '      </div>}\n'+
      "    </div>","visible tile failure");
  return s;
});
update("src/routes/motorista.app.tsx",s=>{
  s=one(s,'import { MovviMap } from "@/components/MovviMap";',
          'import { MovviMap } from "@/components/MovviMap";\n'+
          'import { DriverMapErrorBoundary } from "@/components/routing/DriverMapErrorBoundary";',"boundary import");
  s=one(s,'        <MovviMap center={stableMapCenter} zoom={stableMapZoom} height="100%"\n          themeOverride="dark"',
          '        <DriverMapErrorBoundary>\n'+
          '        <MovviMap center={stableMapCenter} zoom={stableMapZoom} height="100%"\n'+
          '          navigationMode={inNavigationMode}\n          themeOverride="dark"',"boundary open");
  s=one(s,"        </MovviMap>\n      </div>",
          "        </MovviMap>\n        </DriverMapErrorBoundary>\n      </div>","boundary close");
  return s;
});
console.log("[OK] Motorista idle raster, vector navigation only; map failure contained; timeout actionable.");
