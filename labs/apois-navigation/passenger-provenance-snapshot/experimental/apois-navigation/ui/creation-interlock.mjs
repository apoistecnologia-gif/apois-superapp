// Same-origin browser interlock between legacy and experimental submission.
// Server constraints remain authoritative across devices / lost local storage.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
export function createCreationInterlock({enabled=false,journal,verifyIdentity,activeRide,locks=globalThis.navigator?.locks}={}){
 if(enabled!==true)return {legacy:work=>work(),experimental:work=>work(),canReturn:async()=>true}
 if(typeof locks?.request!=='function'||typeof journal?.read!=='function'||typeof verifyIdentity!=='function'||typeof activeRide!=='function')throw Error('Interlock unavailable')
 async function exclusive(work){
  const account=await verifyIdentity()
  if(!uuid(account))throw Error('Identidade não confirmada.')
  return locks.request('apois-ride-submit-v1:'+account,{mode:'exclusive'},async()=>{
   if(await verifyIdentity()!==account)throw Error('Conta alterada.')
   return work(account)
  })
 }
 async function check(account){
  const pending=await journal.read(account)
  if(pending!==null)throw Error('Existe uma solicitação experimental pendente. Recupere a corrida antes de continuar.')
  const result=await activeRide(account)
  if(await verifyIdentity()!==account||result?.verified!==true||!Object.hasOwn(result,'ride'))throw Error('Não foi possível verificar a corrida atual.')
  if(result.ride!==null)throw Error('Já existe uma corrida ativa. Acompanhe a corrida existente.')
  if(await journal.read(account)!==null)throw Error('Existe uma solicitação pendente.')
 }
 return {
  legacy:work=>exclusive(async account=>{await check(account);return work()}),
  // Must wrap host.submit(), not only the transport: reservation is inside
  // the same Web Lock as conventional creation, prior to network send.
  experimental:work=>exclusive(async()=>work()),
  canReturn:async()=>{try{return await exclusive(async account=>{await check(account);return true})}catch{return false}}
 }
}
