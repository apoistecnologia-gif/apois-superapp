import {openRideJournal} from './ride-journal.mjs'
import {createCreationInterlock} from './creation-interlock.mjs'
import {createVerifiedHostTransport} from './verified-host-transport.mjs'
// Default path remains byte-for-byte behavior at the invocation boundary.
// Installed pilot builds must retain this guard even when new selection is disabled.
export function createPilotRuntime({installed=false,auth,invoke,journalFactory=openRideJournal,locks}={}){
 async function context(expected){
  const r=await auth.getUser()
  const account=r?.data?.user?.id
  if(r?.error||!account||(expected&&account!==expected))throw Error('Conta não confirmada.')
  const adapter=createVerifiedHostTransport({enabled:true,account,auth,invoke,controlFunction:'apois-navigation-control'})
  if(await adapter.verifyIdentity()!==account)throw Error('Conta alterada.')
  return {account,adapter}
 }
 async function legacy(work,expected){
  if(!installed)return work(undefined)
  const {account,adapter}=await context(expected)
  const journal=await journalFactory()
  try{
   const guard=createCreationInterlock({enabled:true,journal,...adapter,locks})
   return await guard.legacy(async()=>{
    const headers=await adapter.verifiedAuthorization()
    if(await adapter.verifyIdentity()!==account)throw Error('Conta alterada.')
    return work(headers)
   })
  }finally{journal.close?.()}
 }
 async function pending(expected){
  if(!installed)return false
  const {account,adapter}=await context(expected)
  const journal=await journalFactory()
  try{
   const entry=await journal.read(account)
   if(await adapter.verifyIdentity()!==account)throw Error('Conta alterada.')
   return entry!==null
  }finally{journal.close?.()}
 }
 return {legacy,pending}
}
