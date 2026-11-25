// Test fixture only: genuine local Valhalla, TLS endpoint, persistent
// quote admission and no remote network. Key/certificate are ephemeral.
import assert from 'node:assert/strict'
import {createServer} from 'node:https'
import {request} from 'node:http'
import {readFileSync,mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomBytes} from 'node:crypto'
import {createPrivateQuoteGateway} from '../remote-quote/private-quote-gateway.mjs'
import {createQuoteSigner,quoteBody} from '../remote-quote/quote-protocol.mjs'
import {pilotRemoteQuoteMetrics} from './pilot-remote-quote.mjs'
const listen=(s,host)=>new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,host,resolve)})
const close=s=>{s.closeAllConnections();return new Promise(r=>s.close(r))}
export async function startRegionalQuoteTls({authUserId,certificate,keyFile,origin,destination}){
 const dir=mkdtempSync(join(tmpdir(),'apois-real-quote-tls-'))
 const key={keyId:'regional-ci',secret:randomBytes(32).toString('base64url')}
 let privateGateway,proxy,calls=0
 const cleanup=async()=>{if(proxy)await close(proxy);if(privateGateway)await privateGateway.close();rmSync(dir,{recursive:true,force:true})}
 try{
  privateGateway=await createPrivateQuoteGateway({keys:[key],path:join(dir,'quote.sqlite'),initialize:true,upstreamPort:8002})
  await listen(privateGateway.server,'127.0.0.1')
  proxy=createServer({key:readFileSync(keyFile),cert:readFileSync(certificate),minVersion:'TLSv1.2'},(req,res)=>{
   if(req.method!=='POST'||req.url!=='/quote/route'){res.writeHead(404);res.end();return}
   const upstream=request({host:'127.0.0.1',port:privateGateway.server.address().port,path:'/route',method:'POST',headers:{'content-type':req.headers['content-type'],'content-length':req.headers['content-length'],...(req.headers.authorization?{authorization:req.headers.authorization}:{})}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)})
   upstream.on('error',()=>{res.writeHead(502);res.end()});req.pipe(upstream)
  })
  await listen(proxy,'localhost')
  const endpoint='https://localhost:'+proxy.address().port+'/quote/route'
  const signer=await createQuoteSigner({...key,authUserId})
  const body=quoteBody(origin,destination),token=await signer(body)
  const send=async(authorization,payload=body)=>{const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(authorization?{authorization}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(7000)});await r.body?.cancel();return r.status}
  assert.equal(await send(null),401)
  assert.equal(await send(token,quoteBody(destination,origin)),403)
  const env={APOIS_NAVIGATION_QUOTE_ENDPOINT:endpoint,APOIS_NAVIGATION_QUOTE_KEY_ID:key.keyId,APOIS_NAVIGATION_QUOTE_SECRET:key.secret}
  const metrics=pilotRemoteQuoteMetrics({authUserId,readEnv:name=>env[name],fetcher:async(url,opts)=>{calls++;return fetch(url,opts)}})
  return {metrics,stats:()=>({realValhalla:true,tls:true,unauthenticatedDenied:true,tamperedBodyDenied:true,metricRequests:calls}),close:cleanup}
 }catch(e){await cleanup();throw e}
}
