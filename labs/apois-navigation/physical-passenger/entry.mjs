import maplibregl from 'maplibre-gl'
import {PMTiles} from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import {mountDurablePassengerHost} from './snapshot/experimental/apois-navigation/ui/durable-passenger-view.mjs'
import {openRideJournal} from './snapshot/experimental/apois-navigation/ui/ride-journal.mjs'
import {prepareApprovedPilotMap} from './snapshot/experimental/apois-navigation/ui/approved-map-provider.mjs'
import policy from './policy.json'
import catalog from './catalog.json'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const account=id(891),token='local-synthetic-test-only',key='apois-physical-passenger-fixture-v1'
const auth={getSession:async()=>({data:{session:{user:{id:account},access_token:token}}}),getUser:async t=>({data:{user:t===token?{id:account}:null}})}
// The synthetic backend must survive force-stop independently of the client journal.
// localStorage can acknowledge a write before the WebView process flushes it.
const db=new Promise((resolve,reject)=>{
 const request=indexedDB.open(key,1)
 request.onupgradeneeded=()=>request.result.createObjectStore('fixture')
 request.onsuccess=()=>resolve(request.result)
 request.onerror=()=>reject(request.error)
 request.onblocked=()=>reject(Error('Fixture database blocked'))
})
async function fixture(action,value){
 const database=await db
 return new Promise((resolve,reject)=>{
  let tx,result
  try{
   tx=database.transaction('fixture',action==='write'?'readwrite':'readonly',action==='write'?{durability:'strict'}:undefined)
   if(action==='write'&&tx.durability!=='strict'){tx.abort();throw Error('Strict fixture durability unavailable')}
   const store=tx.objectStore('fixture')
   if(action==='write')store.put(value,'state')
   else {const r=store.get('state');r.onsuccess=()=>{result=r.result??{selection:null,ride:null,creates:0}}}
  }catch(error){reject(error);return}
  tx.oncomplete=()=>resolve(result)
  tx.onabort=()=>reject(tx.error??Error('Fixture transaction aborted'))
  tx.onerror=()=>reject(tx.error??Error('Fixture transaction failed'))
 })
}
const state=()=>fixture('read')
const store=s=>fixture('write',s)
const done=r=>r?.status==='finalizada'
const error=(code,status=409)=>({error:{context:new Response(JSON.stringify({ok:false,error_code:code}),{status})}})
const response=data=>({data})
const status=document.getElementById('fixture-status'),counter=document.getElementById('count')
async function update(){const s=await state();counter.textContent='Criações simuladas neste aparelho: '+s.creates;document.getElementById('finish').disabled=!s.ride||done(s.ride)}
const fixtureLock=task=>navigator.locks.request(key+'-transaction',{mode:'exclusive'},task)
function invoke(name,options){return fixtureLock(()=>invokeLocked(name,options))}
async function invokeLocked(name,{body:b,headers}){
 if(headers.Authorization!=='Bearer '+token)throw Error('fixture token')
 const request=['apois_navigation_quote','apois_navigation_create'].includes(b.action)
 if(name!==(request?'request-ride':'apois-navigation-control'))throw Error('fixture endpoint')
 const s=await state()
 if(b.action==='apois_navigation_catalog')return response({ok:true,catalog})
 if(b.action==='apois_navigation_active')return response({verified:true,ride:s.ride&&!done(s.ride)?s.ride:null})
 if(b.action==='apois_navigation_confirm'){
  if(s.ride&&!done(s.ride))return error('active')
  const p=catalog.rows.find(r=>r.id===b.pickup?.id&&r.version===b.pickup?.version),d=catalog.rows.find(r=>r.id===b.destination?.id&&r.version===b.destination?.version)
  if(!p||!d||p.id===d.id)return error('points')
  if(s.selection?.requestKey===b.requestKey&&!s.selection.sealed)return response({ok:true,...s.selection.value})
  const point=r=>({label:r.label,lat:r.lat,lng:r.lng})
  const value={selectionId:crypto.randomUUID(),requestKey:b.requestKey,origin:point(p),destination:point(d),expiresAt:new Date(Date.now()+300000).toISOString()}
  s.selection={requestKey:b.requestKey,value,sealed:false};s.ride=null;await store(s);return response({ok:true,...value})
 }
 const v=s.selection?.value
 if(!v||v.selectionId!==b.selectionId||v.requestKey!==b.requestKey)return error('missing_selection')
 if(b.action==='apois_navigation_recover'||b.action==='apois_navigation_seal'){
  if(s.ride)return response({ok:true,selectionId:v.selectionId,requestKey:v.requestKey,state:'ride',ride:s.ride})
  if(b.action==='apois_navigation_seal'){s.selection.sealed=true;await store(s)}
  return response({ok:true,selectionId:v.selectionId,requestKey:v.requestKey,state:s.selection.sealed?'sealed':'pending'})
 }
 if(s.selection.sealed||Date.parse(v.expiresAt)<=Date.now())return error('selection_expired')
 if(b.action==='apois_navigation_quote')return response({ok:true,estimated_price:10,fare_amount_cents:1000,distance_km:1.25,duration_min:2,expiresAt:v.expiresAt})
 if(b.action==='apois_navigation_create'){
  if(b.expected_price_cents!==1000)return error('price_changed')
  if(!s.ride){s.ride={rideId:crypto.randomUUID(),status:'procurar_motorista'};s.creates++;await store(s);await update();if(document.getElementById('lost').checked){status.textContent='Resposta perdida simulada após criar a corrida fictícia. Recupere a solicitação.';throw Error('simulated response lost')}}
  return response({ok:true,...s.ride})
 }
 throw Error('unexpected synthetic action')
}
const ctrl=new AbortController()
window.addEventListener('pagehide',()=>ctrl.abort(),{once:true})
document.getElementById('reload').onclick=()=>location.reload()
document.getElementById('finish').onclick=async()=>{
 const button=document.getElementById('finish');button.disabled=true
 try{await fixtureLock(async()=>{const s=await state();if(s.ride){s.ride.status='finalizada';await store(s);await update();status.textContent='Corrida fictícia encerrada. Toque em Verificar solicitação existente.'}})}
 catch{status.textContent='Falha ao persistir encerramento fictício.';await update().catch(()=>{})}
}
async function boot(){
 if(!globalThis.isSecureContext||!navigator.locks||!globalThis.indexedDB){status.textContent='WebView sem suporte à recuperação segura (Web Locks/IndexedDB). Atualize o Android System WebView.';return}
 const journal=await openRideJournal();let pending
 try{pending=await journal.read(account)}finally{journal.close()}
 const active=(await state()).ride
 const allowSelection=!pending&&(!active||done(active))
 let prepared=null
 if(allowSelection)prepared=await prepareApprovedPilotMap(document.getElementById('map'),{enabled:true,account,auth,invoke,maplibre:maplibregl,PMTiles,base:'/apois-regional/',origin:location.origin,policy,signal:ctrl.signal})
 if(!prepared)document.getElementById('map').hidden=true
 const host=await mountDurablePassengerHost(document.getElementById('host'),{enabled:true,account,auth,invoke,map:prepared?.map,catalog:prepared?.catalog,allowSelection:allowSelection&&!!prepared,signal:ctrl.signal,onReturn:()=>{prepared?.dispose();location.reload()},onTrack:()=>{status.textContent='Corrida fictícia localizada. Use o botão de encerramento simulado para testar a liberação.'}})
 status.textContent=host?(prepared?'Mapa local verificado. Escolha os pontos abaixo.':'Modo de recuperação; nenhuma criação automática.'):'Falha ao montar o laboratório.'
 await update()
}
boot().catch(()=>{status.textContent='Falha no mapa ou na recuperação local. Envie uma captura de tela.'})
