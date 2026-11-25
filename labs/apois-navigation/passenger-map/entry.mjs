import maplibregl from 'maplibre-gl'
import {PMTiles} from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import {mountLocalPassengerMap,localPackReader} from './local-map.mjs'
window.startMap=async()=>{
 const read=localPackReader({base:'/apois-regional/',origin:location.origin})
 const result=await mountLocalPassengerMap(document.getElementById('map'),{maplibre:maplibregl,PMTiles,read,expectedPackId:'8b27746f727f258c8180c0d3a1c917c62f14a94c083025767eef4ec7682dba40',expectedManifestSha256:'367c0104a8a5de7f11bdf2c965eb91a73e1cf21b5a3809f78f53e7170b7cdebb'})
 window.apoisMap=result
 return result.metrics()
}

import {mountDurablePassengerHost} from './snapshot/experimental/apois-navigation/ui/durable-passenger-view.mjs'
import {openRideJournal} from './snapshot/experimental/apois-navigation/ui/ride-journal.mjs'
import {prepareApprovedPilotMap} from './snapshot/experimental/apois-navigation/ui/approved-map-provider.mjs'
const policy={"packId":"8b27746f727f258c8180c0d3a1c917c62f14a94c083025767eef4ec7682dba40","manifestSha256":"367c0104a8a5de7f11bdf2c965eb91a73e1cf21b5a3809f78f53e7170b7cdebb","mapExtractHash":"c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238","catalog":{"version":1,"extractHash":"c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238"}}
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const account=id(791),token='synthetic-local-browser-token'
const auth={getSession:async()=>({data:{session:{user:{id:account},access_token:token}}}),getUser:async value=>({data:{user:value===token?{id:account}:null}})}
window.startHost=async(allowSelection)=>{
 const prepared=allowSelection?await prepareApprovedPilotMap(document.getElementById('map'),{
  enabled:true,account,auth,invoke:async(name,opts)=>window.labRpc(name,opts),maplibre:maplibregl,PMTiles,base:'/apois-regional/',origin:location.origin,policy
 }):null
 window.apoisMap=prepared
 const catalog=prepared?.catalog
 window.trackedRide=null;window.returned=0
 const mounted=await mountDurablePassengerHost(document.getElementById('host'),{
  enabled:true,account,auth,allowSelection:allowSelection&&prepared!==null,map:prepared?.map,catalog,
  invoke:async(name,opts)=>window.labRpc(name,opts),onTrack:id=>{window.trackedRide=id},onReturn:()=>{prepared?.dispose();window.returned++}
 })
 window.passengerHost=mounted
 return mounted.host.snapshot()
}
window.readJournal=async()=>{const journal=await openRideJournal();try{return await journal.read(account)}finally{journal.close()}}
