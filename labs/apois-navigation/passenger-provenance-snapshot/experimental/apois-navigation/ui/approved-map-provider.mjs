import {validCatalogPolicy} from './catalog-validation.mjs'
import {localPackReader,mountLocalPassengerMap} from './local-map.mjs'
import {createVerifiedHostTransport} from './verified-host-transport.mjs'
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
export async function prepareApprovedPilotMap(root,{enabled=false,account,auth,invoke,maplibre,PMTiles,base,origin,policy,signal,fetcher=fetch}={}){
 if(enabled!==true||signal?.aborted)return null
 // Configuration comes exclusively from the reviewed build. A missing or
 // mismatched digest never gets replaced by a value supplied by the server.
 if(!hash(policy?.packId)||!hash(policy?.manifestSha256)||!hash(policy?.mapExtractHash)||!validCatalogPolicy(policy.catalog)||policy.catalog.extractHash!==policy.mapExtractHash)return null
 let result=null
 try{
  const adapter=createVerifiedHostTransport({enabled:true,account,auth,invoke,controlFunction:'apois-navigation-control'})
  const catalog=await adapter.readCatalog(policy.catalog,signal)
  if(!catalog||signal?.aborted)return null
  const read=localPackReader({base,origin,fetcher})
  result=await mountLocalPassengerMap(root,{maplibre,PMTiles,read,expectedPackId:policy.packId,expectedManifestSha256:policy.manifestSha256,signal})
  if(signal?.aborted||result.extractHash!==policy.mapExtractHash||await adapter.verifyIdentity()!==account){result.dispose();return null}
  return {map:result.map,catalog,dispose:result.dispose,metrics:result.metrics,extractHash:result.extractHash}
 }catch{result?.dispose();return null}
}
