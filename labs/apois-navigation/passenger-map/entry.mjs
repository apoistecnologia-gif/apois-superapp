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
