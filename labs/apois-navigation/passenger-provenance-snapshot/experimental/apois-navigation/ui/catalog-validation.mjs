const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k))
export const validCatalogPolicy=p=>Number.isSafeInteger(p?.version)&&p.version>0&&p.version<=2147483647&&typeof p.extractHash==='string'&&/^[a-f0-9]{64}$/.test(p.extractHash)
export function validateCatalog(value,policy){
 if(!validCatalogPolicy(policy)||!exact(value,['source','version','extract_sha256','rows'])||value.source!=='OSM_PBF'||value.version!==policy.version||value.extract_sha256!==policy.extractHash||!Array.isArray(value.rows)||value.rows.length<2||value.rows.length>1000)return null
 const ids=new Set(),rows=[]
 for(const row of value.rows){
  if(!exact(row,['id','version','extract_sha256','label','lat','lng','active'])||!uuid(row.id)||ids.has(row.id.toLowerCase())||row.version!==policy.version||row.extract_sha256!==policy.extractHash||row.active!==true||
   typeof row.label!=='string'||row.label.trim().length<1||row.label.length>120||/[\x00-\x1f\x7f]/.test(row.label)||
   !Number.isFinite(row.lat)||!Number.isFinite(row.lng)||row.lat< -9.65||row.lat> -9.10||row.lng< -40.80||row.lng> -40.20)return null
  ids.add(row.id.toLowerCase());rows.push(Object.freeze({...row}))
 }
 if(new TextEncoder().encode(JSON.stringify(value)).byteLength>512*1024)return null
 return Object.freeze({source:'OSM_PBF',version:policy.version,extract_sha256:policy.extractHash,rows:Object.freeze(rows)})
}
