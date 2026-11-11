// APOIS_DRIVER_QA202_CLOUD_VECTOR_READINESS_V1
// Do NOT activate a default Google vector map over the approved Passenger style.
// A cloud-styled Map ID approved for APOIS and WebGL support are BOTH required.
// Driver-only. No Entregador, source-lock, API key, payment, location or route edits.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const file=resolve(root,"src/components/MovviMap.tsx");
let s=readFileSync(file,"utf8");
const marker="APOIS_DRIVER_QA202_CLOUD_VECTOR_READINESS_V1";
if(s.includes(marker))throw Error("[FAIL] QA202 cloud style gate already applied");
function once(oldText,newText,label){
 const n=s.split(oldText).length-1;
 if(n!==1)throw Error("[FAIL] QA202 "+label+" anchors="+n);
 s=s.replace(oldText,newText);
}
// This decision happens only once at component creation. No render-mode
// switching from GPS updates, on new rides, or while the driver is moving.
// Cloud style is explicitly opt-in and independently reviewed/approved.
const config=[
 '  // '+marker+': needs published APOIS Cloud style and valid JavaScript vector Map ID.',
 '  const [cloudVectorConfig] = useState(() => {',
 '    if (!isDriverRole || import.meta.env.VITE_APOIS_PARTNER_CLOUD_STYLE_VERIFIED !== "true") return null;',
 '    const mapId = String(import.meta.env.VITE_APOIS_PARTNER_VECTOR_MAP_ID ?? "").trim();',
 '    if (!/^[0-9a-f]{16,32}$/i.test(mapId)) return null;',
 '    if (typeof document === "undefined") return null;',
 '    try {',
 '      const canvas = document.createElement("canvas");',
 '      const attrs = { failIfMajorPerformanceCaveat: true };',
 '      const gl = (canvas.getContext("webgl2", attrs) as WebGL2RenderingContext | null)',
 '        ?? (canvas.getContext("webgl", attrs) as WebGLRenderingContext | null);',
 '      if (!gl) return null;',
 '      gl.getExtension("WEBGL_lose_context")?.loseContext();',
 '      return { mapId };',
 '    } catch { return null; }',
 '  });',
 '  const useCloudVector = isDriverRole && cloudVectorConfig !== null;'
].join("\n");
once(
 '  const stableMapOptions = useMemo<google.maps.MapOptions>(() => ({',
 config+'\n  const stableMapOptions = useMemo<google.maps.MapOptions>(() => ({',
 "stable settings anchor"
);
once([
 '          renderingType: isLoaded && typeof google !== "undefined" && isDriverRole',
 '            ? google.maps.RenderingType.RASTER : undefined,',
 '          tiltInteractionEnabled: false,',
 '          headingInteractionEnabled: false,',
 '          styles,'
].join("\n"),
 [
 '          // Cloud map styling and inline styles may never be combined.',
 '          mapId: useCloudVector ? cloudVectorConfig?.mapId : undefined,',
 '          renderingType: isLoaded && typeof google !== "undefined" && isDriverRole',
 '            ? (useCloudVector ? google.maps.RenderingType.VECTOR : google.maps.RenderingType.RASTER) : undefined,',
 '          tiltInteractionEnabled: useCloudVector,',
 '          headingInteractionEnabled: useCloudVector,',
 '          styles: useCloudVector ? undefined : styles,'
].join("\n"),
 "fixed, guarded renderer"
);
once(
 '  }), [isLoaded, isDriverRole, styles, bgColor]);',
 '  }), [isLoaded, isDriverRole, useCloudVector, cloudVectorConfig, styles, bgColor]);',
 "stable memo deps"
);
// Never attempt to reapply local JSON styling to a Map ID. WebGL data is
// configured in Google Cloud; the map remains single-instanced until retry.
once(
 '    mapRef.current.setOptions({ styles, backgroundColor: bgColor });',
 '    if (useCloudVector) return; // Google Maps rejects local styles alongside Map ID.\n    mapRef.current.setOptions({ styles, backgroundColor: bgColor });',
 "style sync safeguards"
);
once(
 '  }, [theme, styles, bgColor]);',
 '  }, [theme, styles, bgColor, useCloudVector]);',
 "map style effect dependencies"
);
for(const need of [
 marker,'VITE_APOIS_PARTNER_CLOUD_STYLE_VERIFIED','VITE_APOIS_PARTNER_VECTOR_MAP_ID',
 'useState(() => {','google.maps.RenderingType.VECTOR : google.maps.RenderingType.RASTER',
 'mapId: useCloudVector ? cloudVectorConfig?.mapId : undefined',
 'styles: useCloudVector ? undefined : styles',
 'getMapStyleForTheme("light")','getMapBackgroundForTheme("light")','options={stableMapOptions}'
])if(!s.includes(need))throw Error("[FAIL] QA202 missing "+need);
if(s.includes("options={{"))throw Error("[FAIL] QA202 map options must remain stable");
writeFileSync(file,s,"utf8");
console.log("[OK] QA202 Motorista: published cloud style + valid vector Map ID + WebGL opt-in, otherwise unchanged Passenger raster; no mid-ride switch.");
