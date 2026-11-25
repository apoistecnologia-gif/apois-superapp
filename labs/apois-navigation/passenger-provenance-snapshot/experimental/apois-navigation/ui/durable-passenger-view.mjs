import {mountPassengerPanel} from './passenger-panel-view.mjs'
import {createDurableRideHost} from './durable-ride-host.mjs'
import {createCreationInterlock} from './creation-interlock.mjs'
import {openRideJournal} from './ride-journal.mjs'
import {createVerifiedHostTransport} from './verified-host-transport.mjs'

// Dedicated opt-in container. Existing Google route/price/dispatch components
// are not imported or rewritten. The trusted host provides a MapLibre map,
// verified account, active catalog, Supabase client adapter and tracker callback.
export async function mountDurablePassengerHost(root,{enabled=false,account,auth,invoke,map,catalog,onReturn,onTrack,locks,journalFactory=openRideJournal,allowSelection=true,signal}={}){
 if(enabled!==true||signal?.aborted)return null
 if(!root?.ownerDocument||(allowSelection&&(!map||typeof map.on!=='function'||typeof map.off!=='function'))||typeof onReturn!=='function'||typeof onTrack!=='function')throw Error('Missing host dependency')
 const transport=createVerifiedHostTransport({enabled:true,account,auth,invoke,controlFunction:'apois-navigation-control'})
 const journal=await journalFactory()
 if(signal?.aborted){journal.close?.();return null}
 const interlock=createCreationInterlock({enabled:true,journal,verifyIdentity:transport.verifyIdentity,activeRide:transport.activeRide,locks})
 const host=createDurableRideHost({enabled:true,journal,...transport})
 const doc=root.ownerDocument
 const el=(tag,text)=>{const x=doc.createElement(tag);if(text)x.textContent=text;return x}
 const shell=el('section'),selectionRoot=el('div'),status=el('p'),reviewRoot=el('div'),controls=el('div')
 status.setAttribute('role','status');shell.append(el('h2','APOIS GPS próprio • piloto'),status,selectionRoot,reviewRoot,controls);root.append(shell)
 let panel=null,disposed=false,busy=false,errorText=''
 const button=(label,fn)=>{const b=el('button',label);b.type='button';b.addEventListener('click',()=>{if(disposed||busy)return;void act(fn)});return b}
 const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
 const dispose=()=>{if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);panel?.dispose();host.invalidate();journal.close?.();shell.remove()}
 async function act(fn){if(disposed||busy)return;busy=true;errorText='';render();try{await fn()}catch{errorText='Não foi possível confirmar a operação.'}finally{busy=false;render()}}
 async function returnLegacy(){
  if(!host.canReturnToLegacy()||!await interlock.canReturn())return false
  dispose();onReturn();return true
 }
 function mountSelection(){
  panel=mountPassengerPanel(selectionRoot,{enabled:true,map,catalog,confirm:transport.confirm,onReturn:()=>{panel=null;void act(async()=>{if(!await returnLegacy()&&!disposed&&allowSelection)mountSelection()})}})
 }
 function render(){
  if(disposed)return
  const s=host.snapshot(),r=s.review
  status.textContent=busy?'Verificando…':({closed:'Preparando…',checking:'Verificando conta e corrida atual…',ready:allowSelection?'Selecione os pontos no mapa próprio. Piloto: carros, dinheiro, sem paradas.':'Mapa indisponível ou novas solicitações desativadas.',active:'Corrida existente. Continue no acompanhamento.',recovery:'A solicitação precisa ser recuperada. Nenhuma nova corrida será criada automaticamente.',blocked:'Não foi possível verificar a situação da corrida.', 'ready-to-reopen':'Tentativa encerrada pelo servidor.'})[s.state]
  if(!busy&&errorText)status.textContent+=' '+errorText
  reviewRoot.replaceChildren()
  if(s.state==='ready'&&r?.quote){
   reviewRoot.append(el('p','Valor confirmado pelo servidor: '+currency.format(r.quote.estimated_price)),el('p',r.quote.distance_km+' km • '+r.quote.duration_min+' min • Dinheiro'))
   if(s.pending)reviewRoot.append(el('p','Confira o valor atualizado ou encerre a tentativa.'))
  }
  controls.replaceChildren()
  if(s.state==='ready'){
   if(s.pending)controls.append(button('Encerrar tentativa que não criou corrida',()=>host.recover({seal:true})))
   if(panel)controls.append(button('Revisar valor',async()=>{const selected=panel.confirmedInput();if(!selected||!host.begin(selected))return;panel.dispose();panel=null;await host.quote()}))
   else if(r?.state==='review')controls.append(button('Confirmar corrida',async()=>{const ride=await interlock.experimental(()=>host.submit(true));if(ride&&!disposed)onTrack(ride.rideId)}))
   else if(r?.state==='selected')controls.append(button('Consultar valor novamente',()=>host.quote()))
  }
  if(['recovery','blocked','active'].includes(s.state)){
   controls.append(button('Verificar solicitação existente',()=>host.recover()))
   if(s.state!=='active')controls.append(button('Encerrar tentativa que não criou corrida',()=>host.recover({seal:true})))
  }
  if(s.state==='active'&&s.ride)controls.append(button('Acompanhar corrida',async()=>{if(await transport.verifyIdentity()===account&&!disposed)onTrack(s.ride.rideId)}))
  if(host.canReturnToLegacy())controls.append(button('Voltar ao fluxo atual',returnLegacy))
  for(const b of controls.children)b.disabled=busy
 }
 try{
  signal?.addEventListener('abort',dispose,{once:true})
  if(signal?.aborted){dispose();return null}
  await host.open()
  if(disposed)return null
  if(host.snapshot().state==='ready'&&allowSelection)mountSelection()
  render()
  return {dispose,host,interlock}
 }catch(e){dispose();throw e}
}
