import maplibregl from 'maplibre-gl'
import {PMTiles} from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import {createVerifiedRangeSource} from './verified-range-source.mjs'
import {createTileScheduler} from './tile-scheduler.mjs'
import config from './fixture-config.json'
import style from './fixture-style.json'
let occupied=false
window.startMap=async()=>{
 if(occupied)throw Error('Map already starting or open')
 occupied=true
 let source,scheduler,map,registered=false
 const scheme='apoisrange',prefix=scheme+'://map/'
 const dispose=()=>{
  try{map?.remove()}finally{
   if(registered)maplibregl.removeProtocol(scheme)
   scheduler?.close();source?.close();occupied=false;window.lab=null
  }
 }
 try{
 source=await createVerifiedRangeSource({...config,manifestBytes:new TextEncoder().encode(config.manifestText),parallel:8,cacheChunks:8})
 scheduler=createTileScheduler({parallel:4,maxQueued:32})
 const archive=new PMTiles(source)
 const header=await archive.getHeader()
 if(header.specVersion!==3||header.tileType!==1)throw Error('Invalid archive')
 let tiles=0
 maplibregl.addProtocol(scheme,async(params,controller)=>{
  const m=/^apoisrange:\/\/map\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(params.url)
  if(!m)throw Error('Invalid tile')
  const [z,x,y]=m.slice(1).map(Number)
  if(z<8||z>15||x>=2**z||y>=2**z)throw Error('Tile outside archive')
  const tile=await scheduler.run(signal=>archive.getZxy(z,x,y,signal),controller.signal)
  tiles++;return {data:tile?.data??new ArrayBuffer(0)}
 })
 registered=true
 const s=structuredClone(style)
 delete s.sources.regional.url
 s.sources.regional.tiles=[prefix+'{z}/{x}/{y}.pbf']
 s.sources.regional.attribution='© OpenStreetMap contributors'
 s.glyphs=location.origin+'/glyphs/{fontstack}/{range}.pbf'
  map=new maplibregl.Map({container:'map',style:s,center:[-40.504,-9.41],zoom:14,minZoom:8,maxZoom:18,renderWorldCopies:false,maxBounds:[[-40.8,-9.65],[-40.2,-9.1]],transformRequest:url=>{
   if(!url.startsWith(prefix)&&!url.startsWith(location.origin+'/glyphs/'))throw Error('Unexpected map resource')
   return {url}
  }})
  window.lab={map,metrics:()=>({tiles}),dispose:()=>{if(window.lab?.map===map)dispose()}}
 }catch(e){dispose();throw e}
}
