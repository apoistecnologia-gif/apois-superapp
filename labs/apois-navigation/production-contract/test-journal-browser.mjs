import {spawn} from 'node:child_process'
import {readFileSync,existsSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import assert from 'node:assert/strict'
const [browser,profile,url]=process.argv.slice(2)
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function start(){
 const portFile=join(profile,'DevToolsActivePort');rmSync(portFile,{force:true})
 const child=spawn(browser,['--headless','--disable-gpu','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','ignore']})
 const exited=new Promise(r=>child.once('exit',r))
 try{
  for(let n=0;n<100&&!existsSync(portFile)&&child.exitCode===null;n++)await sleep(100)
  const port=Number(readFileSync(portFile,'utf8').split('\n')[0])
  assert.ok(Number.isInteger(port)&&port>0)
  const tab=await (await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent(url),{method:'PUT'})).json()
  const ws=new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})})
  let seq=0;const pending=new Map()
  ws.addEventListener('message',e=>{const msg=JSON.parse(e.data);const p=pending.get(msg.id);if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result)}})
  const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},10000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))})
  const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
  for(let n=0;n<100;n++){
   const state=await evaluate('document.body?.textContent')
   if(state?.includes('APOIS_INDEXEDDB_BROWSER_FAIL'))throw Error(state)
   if(state?.includes('APOIS_INDEXEDDB_BROWSER_OK'))return {evaluate,async close(){try{await Promise.race([command('Browser.close'),exited])}catch{}ws.close();await Promise.race([exited,sleep(3000)]);if(child.exitCode===null)child.kill();await exited}}
   await sleep(100)
  }
  throw Error('Browser journal test did not finish')
 }catch(e){child.kill();await exited;throw e}
}
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const scope=id(97),entry={selectionId:id(2),requestKey:id(3),owner:id(4)}
const load="const {openRideJournal}=await import('./ride-journal.mjs');const j=await openRideJournal();"
let first=await start()
try{assert.equal(await first.evaluate("(async()=>{"+load+"const ok=await j.reserve("+JSON.stringify(scope)+","+JSON.stringify(entry)+");j.close();return ok})()"),true)}finally{await first.close()}
let second=await start()
try{
 const restored=await second.evaluate("(async()=>{"+load+"const r=await j.read("+JSON.stringify(scope)+");j.close();return r})()")
 assert.deepEqual(restored,entry)
 assert.equal(await second.evaluate("(async()=>{"+load+"const ok=await j.clear("+JSON.stringify(scope)+","+JSON.stringify(entry)+");j.close();return ok})()"),true)
 console.log('APOIS_INDEXEDDB_BROWSER_OK',JSON.stringify({strictDurability:true,concurrentConnections:true,reopen:true,browserProcessRestart:true,accountIsolation:true,compareAndSwap:true}))
}finally{await second.close()}
