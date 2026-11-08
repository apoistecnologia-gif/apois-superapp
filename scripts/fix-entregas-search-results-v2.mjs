// INV-022/023 — busca Cliente Entregas: conjunto completo de lojistas,
// recorte somente na apresentação de produtos, coordenadas estritas.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(".work/entregas/src/routes/buscar.tsx");
let src=readFileSync(path,"utf8");
const marker="APOIS_ENTREGAS_SEARCH_INTEGRITY_V2";
if(src.includes(marker)){console.log("[OK] busca já protegida");process.exit(0);}
function one(a,b,id){
 const n=src.split(a).length-1;
 if(n!==1)throw Error("[FAIL] "+id+": âncora não única ("+n+")");
 src=src.replace(a,b);
}
one(`  const lat1 = Number(fromLat);
  const lng1 = Number(fromLng);
  const lat2 = Number(toLat);
  const lng2 = Number(toLng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;`,
`  // ${marker}: reject absent, blank, nondecimal, out-of-range coordinates.
  const coord=(value:unknown,limit:number):number|null=>{
    if(typeof value!=="number" && typeof value!=="string")return null;
    if(typeof value==="string" && !/^[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?$/i.test(value.trim()))return null;
    const n=Number(value);
    return Number.isFinite(n)&&Math.abs(n)<=limit?n:null;
  };
  const lat1=coord(fromLat,90),lng1=coord(fromLng,180);
  const lat2=coord(toLat,90),lng2=coord(toLng,180);
  if(lat1===null||lng1===null||lat2===null||lng2===null)return null;`, "distance");
one('      .slice(0, 40);\n  }, [\n    defaultAddress?.latitude,',
'      ;\n  }, [\n    defaultAddress?.latitude,',"premature cutoff");
one('  const filteredMerchants = useMemo(() => {',
`  // A product display cap must not hide a merchant selling the searched term.
  const visibleMatchingProducts = useMemo(() => matchingProducts.slice(0,40),[matchingProducts]);

  const filteredMerchants = useMemo(() => {`,"visible cap");
one('{matchingProducts.map((product) => {','{visibleMatchingProducts.map((product) => {',"list rendering");
for(const key of [marker,"visibleMatchingProducts.map(","matchingProducts.map((product) => product.merchant_id)","lat1===null||lng1===null"])if(!src.includes(key))throw Error("Search fix missing "+key);
writeFileSync(path,src,"utf8");
console.log("[OK] INV-022/023: merchant match is not limited to the first 40 products; distance is validated.");
