import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
function update(path,changes){
  const file=resolve(root,path);
  let s=readFileSync(file,"utf8");
  for(const [oldPart,newPart,label] of changes){
    const count=s.split(oldPart).length-1;
    if(count!==1)throw Error("[FAIL] Motorista Google Map V5 "+label+" count="+count);
    s=s.replace(oldPart,newPart);
  }
  writeFileSync(file,s,"utf8");
  console.log("[OK] Motorista Google Map V5: "+path);
}
update("src/components/MovviMap.tsx",[
 ['const styles = useMemo(() => getMapStyleForTheme(theme), [theme]);',
  'const styles = useMemo(() => isDriverRole ? [] : getMapStyleForTheme(theme), [isDriverRole,theme]);',
  "standard Google roadmap with all available street and city labels"],
 ['const bgColor = useMemo(() => getMapBackgroundForTheme(theme), [theme]);',
  'const bgColor = useMemo(() => isDriverRole ? "#F8F9FA" : getMapBackgroundForTheme(theme), [isDriverRole,theme]);',
  "light Google map background"],
 ['          clickableIcons: false,',
  '          clickableIcons: isDriverRole,',
  "Google locations selectable in driver role"],
]);
update("src/routes/motorista.app.tsx",[
 ['const NAVIGATION_ZOOM = 18;','const NAVIGATION_ZOOM = 16;', "practical rural street zoom"],
 ['tilt: nearDestination || heading == null ? 0 : 45,','tilt: 0,', "2D navigation not tilted 45 degrees"],
 ['      navMap.setTilt?.(45);','      navMap.setTilt?.(0);', "disable perspective during follow"],
 ['if ((map.getZoom() ?? 0) < 17 || nearDestination) map.setZoom(targetZoom);',
  'if ((map.getZoom() ?? 0) > 17 || (map.getZoom() ?? 0) < 15 || nearDestination) map.setZoom(targetZoom);',
  "keep map at practical zoom while following"],
]);
console.log("[OK] APOIS Motorista: mapa padrão do Google com ruas/nomes quando disponibilizados; Cliente não alterado.");
