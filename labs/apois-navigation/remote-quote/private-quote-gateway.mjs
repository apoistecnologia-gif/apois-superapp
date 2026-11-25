import {createRouteGateway,createBudget} from '../valhalla/route-gateway.mjs'
import {openRouteReplayStore} from '../valhalla/route-replay-store.mjs'
import {createQuoteVerifier} from './quote-protocol.mjs'
// Separate quote-only listener and dedicated persistent DB. Never expose
// the unauthenticated CLI or share this key/store with driver permits.
export async function createPrivateQuoteGateway({keys,path,initialize=false,upstreamPort=8002,now=Date.now}){
 const store=openRouteReplayStore({path,initialize,perMinute:6,parallel:1,globalPerMinute:60,globalParallel:4})
 try{
  const authorize=await createQuoteVerifier({keys,admit:(claim,t)=>store.admit(claim,t),now})
  const server=createRouteGateway({upstreamPort,budget:createBudget({limit:60,parallel:4}),authorize,timeout:5000})
  return {server,close(){server.closeAllConnections();return new Promise(resolve=>server.close(()=>{store.close();resolve()}))}}
 }catch(e){store.close();throw e}
}
