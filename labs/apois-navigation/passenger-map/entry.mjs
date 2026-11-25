import maplibregl from 'maplibre-gl'
import {PMTiles} from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import {mountLocalPassengerMap,localPackReader} from './local-map.mjs'
window.startMap=async()=>{
 const read=localPackReader({base:'/apois-regional/',origin:location.origin})
 const result=await mountLocalPassengerMap(document.getElementById('map'),{maplibre:maplibregl,PMTiles,read,expectedPackId:'8b27746f727f258c8180c0d3a1c917c62f14a94c083025767eef4ec7682dba40'})
 window.apoisMap=result
 return result.metrics()
}

import {mountDurablePassengerHost} from './snapshot/experimental/apois-navigation/ui/durable-passenger-view.mjs'
import {openRideJournal} from './snapshot/experimental/apois-navigation/ui/ride-journal.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const account=id(791),token='synthetic-local-browser-token'
const auth={getSession:async()=>({data:{session:{user:{id:account},access_token:token}}}),getUser:async value=>({data:{user:value===token?{id:account}:null}})}
window.startHost=async(allowSelection)=>{
 const hash=window.apoisMap?.extractHash??'a'.repeat(64)
 const common={active:true,version:1,extract_sha256:hash}
 const catalog={source:'OSM_PBF',version:1,extract_sha256:hash,rows:[
  {...common,id:id(792),lat:-9.41,lng:-40.504,label:'Embarque sintético'},
  {...common,id:id(793),lat:-9.414,lng:-40.51,label:'Destino sintético'}
 ]}
 window.trackedRide=null;window.returned=0
 const mounted=await mountDurablePassengerHost(document.getElementById('host'),{
  enabled:true,account,auth,allowSelection,map:window.apoisMap?.map,catalog,
  invoke:async(name,opts)=>window.labRpc(name,opts),onTrack:id=>{window.trackedRide=id},onReturn:()=>{window.returned++}
 })
 window.passengerHost=mounted
 return mounted.host.snapshot()
}
window.readJournal=async()=>{const journal=await openRideJournal();try{return await journal.read(account)}finally{journal.close()}}
