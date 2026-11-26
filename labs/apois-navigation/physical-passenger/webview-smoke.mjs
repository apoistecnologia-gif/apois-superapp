import assert from 'node:assert/strict'
import {textCheckpoint,exactElementTextCheckpoint} from './webview-checkpoints.mjs'
import {readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {adb,packageName,connectWebView,until,click} from './webview-cdp.mjs'
const out=process.argv[2],catalog=JSON.parse(readFileSync(process.argv[3],'utf8'))
assert.equal(catalog.rows.length,2)
const labels=catalog.rows.map(x=>x.label)
assert.notEqual(labels[0],labels[1],'fixture labels must be distinguishable')
const text=textCheckpoint
const count=n=>exactElementTextCheckpoint('count','Criações simuladas neste aparelho: '+n)
const launch=()=>adb('shell','am','start','-W','-n',packageName+'/.MainActivity')
let view=null
const checks=[]
try{
 launch();view=await connectWebView()
 await until(view,text('Mapa local verificado.'),'local map',60000)
 await until(view,'!!document.querySelector("canvas.maplibregl-canvas") && document.querySelector("canvas.maplibregl-canvas").width>0','map canvas')
 await until(view,'globalThis.isSecureContext && !!navigator.locks && !!indexedDB','WebView storage')
 await until(view,count(0),'initial count')
 checks.push('map-canvas','web-locks-indexeddb')
 for(let i=0;i<2;i++){
  await click(view,i===0?'Escolher embarque':'Escolher destino')
  assert.equal(await view.evalJS('(()=>{const input=document.querySelector("input[type=search]");if(!input)return false;input.value='+JSON.stringify(labels[i])+';input.dispatchEvent(new Event("input",{bubbles:true}));return true})()'),true)
  await click(view,labels[i])
 }
 await click(view,'Confirmar embarque e destino')
 await until(view,text('Seleção confirmada. Nenhuma corrida foi criada.'),'selection confirmation')
 await click(view,'Revisar valor')
 await until(view,text('Valor confirmado pelo servidor:'),'synthetic quote')
 await click(view,'Confirmar corrida')
 await until(view,count(1),'exact one creation')
 await until(view,text('A solicitação precisa ser recuperada.'),'lost response recovery')
 checks.push('synthetic-selection-quote','lost-response-single-create')
 view.close();view=null
 adb('shell','am','force-stop',packageName)
 launch();view=await connectWebView()
 await until(view,text('A solicitação precisa ser recuperada.'),'persistent journal after force stop',60000)
 await until(view,count(1),'no automatic creation')
 await click(view,'Verificar solicitação existente')
 await until(view,text('Corrida existente. Continue no acompanhamento.'),'recovered ride')
 await click(view,'Simular encerramento da corrida')
 await until(view,text('Corrida fictícia encerrada. Toque em Verificar solicitação existente.'),'committed synthetic finish')
 await click(view,'Verificar solicitação existente')
 await until(view,text('Tentativa encerrada pelo servidor.'),'terminal recovery')
 await click(view,'Voltar ao fluxo atual')
 await until(view,text('Mapa local verificado.'),'map restored',60000)
 await until(view,count(1),'count retained after terminal recovery')
 checks.push('process-restart','no-duplicate','terminal-recovery','map-restored')
 const report={packageName,synthetic:true,offlineApk:true,checks,physicalDevice:false,realBackend:false}
 writeFileSync(join(out,'webview-smoke.json'),JSON.stringify(report,null,2)+'\n')
 console.log('APOIS_PASSENGER_WEBVIEW_SMOKE_OK',JSON.stringify(report))
}finally{view?.close()}
