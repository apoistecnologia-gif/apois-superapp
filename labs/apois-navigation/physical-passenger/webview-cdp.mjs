// Disposable debug APK only; localhost ADB forward, no device/user account.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {setTimeout as sleep} from 'node:timers/promises'
export const packageName='br.com.apois.navigation.passenger.lab'
export function adb(...args){return execFileSync('adb',args,{encoding:'utf8',timeout:10000,maxBuffer:1024*1024}).trim()}
export async function connectWebView(){
 const end=Date.now()+60000
 while(Date.now()<end){
  let forward=null,ws=null
  try{
   const pid=adb('shell','pidof',packageName)
   assert.match(pid,/^[1-9][0-9]*$/)
   forward=adb('forward','tcp:0','localabstract:webview_devtools_remote_'+pid)
   assert.match(forward,/^[1-9][0-9]*$/)
   const origin='http://127.0.0.1:'+forward
   const list=await (await fetch(origin+'/json/list',{signal:AbortSignal.timeout(2000)})).json()
   const page=list.find(x=>x.type==='page'&&/^https?:\/\/localhost(?:\/|:|$)/.test(x.url))
   assert.ok(page,'local app page missing')
   const target=new URL(page.webSocketDebuggerUrl)
   assert.equal(target.protocol,'ws:');assert.equal(target.port,forward)
   assert.ok(['127.0.0.1','localhost'].includes(target.hostname))
   ws=new WebSocket(target)
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('CDP open timeout')),2500)
    ws.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true})
    ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('CDP open error'))},{once:true})
   })
   let sequence=0
   const pending=new Map()
   ws.addEventListener('message',event=>{
    const msg=JSON.parse(event.data),task=pending.get(msg.id)
    if(!task)return
    pending.delete(msg.id);clearTimeout(task.timer)
    if(msg.error)task.reject(Error(msg.error.message));else task.resolve(msg.result)
   })
   const call=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},5000)
    pending.set(id,{resolve,reject,timer})
    try{ws.send(JSON.stringify({id,method,params}))}catch(e){clearTimeout(timer);pending.delete(id);reject(e)}
   })
   const evalJS=async expression=>{
    const reply=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})
    if(reply.exceptionDetails){
     const detail=reply.exceptionDetails
     // Synthetic lab only: report exception type/location, not evaluated DOM contents.
     const kind=detail.exception?.className??'Error'
     throw Error(`WebView expression threw (${kind}, line ${detail.lineNumber??'?'}, column ${detail.columnNumber??'?'})`)
    }
    assert.ok(reply.result,'missing CDP evaluation result')
    return reply.result.value
   }
   const close=()=>{try{ws.close()}finally{adb('forward','--remove','tcp:'+forward)}}
   return {evalJS,close}
  }catch{
   try{ws?.close()}catch{}
   if(forward&&/^[1-9][0-9]*$/.test(forward)){try{adb('forward','--remove','tcp:'+forward)}catch{}}
   await sleep(1000)
  }
 }
 throw Error('local WebView debugging unavailable')
}
export async function until(view,expression,label,timeout=25000){
 const end=Date.now()+timeout
 while(Date.now()<end){
  if(await view.evalJS(expression))return
  await sleep(500)
 }
 throw Error('WebView checkpoint not reached: '+label)
}
export async function click(view,label){
 const expression='(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==='+JSON.stringify(label)+'&&!b.disabled&&!b.hidden);if(!b)return false;b.click();return true})()'
 await until(view,expression,'button '+label)
}
