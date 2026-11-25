// WebCrypto protocol compatible with Node 24 and the Supabase Edge runtime.
// Dedicated server-to-server secret; never a Supabase or driver bearer token.
const enc=new TextEncoder()
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('')
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
const decode=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0))
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const kidOk=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,32}$/.test(v)
const hashOk=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const envelope=b=>b&&typeof b==='object'&&Object.keys(b).length===2&&uuid(b.authUserId)&&Object.hasOwn(b,'request')
async function key(secret){
 if(typeof secret!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(secret))throw Error('Invalid driver-control key')
 const bytes=decode(secret)
 if(bytes.length!==32||b64(bytes)!==secret)throw Error('Invalid driver-control key')
 return crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])
}
async function sign(k,text){return crypto.subtle.sign('HMAC',k,enc.encode(text))}
async function digest(body){return hex(await crypto.subtle.digest('SHA-256',enc.encode(JSON.stringify(body))))}
const prefix='apois-driver-control-route-v1'
export async function createDriverSigner({keyId,secret,authUserId,now=Date.now}){
 if(!kidOk(keyId)||!uuid(authUserId))throw Error('Invalid driver-control identity')
 const k=await key(secret),sub=hex(await sign(k,'apois-driver-control-principal-v1:'+authUserId.toLowerCase()))
 return async body=>{
  if(!envelope(body)||body.authUserId!==authUserId)throw Error('Invalid driver envelope')
  const iat=now();if(!Number.isSafeInteger(iat)||iat<=0)throw Error('Invalid time')
  const jti=b64(crypto.getRandomValues(new Uint8Array(18))),route=await digest(body)
  const fields=[prefix,keyId,String(iat),jti,sub,route].join('.')
  return 'APOISDriver '+fields+'.'+b64(await sign(k,fields))
 }
}
export async function createDriverVerifier({keys,admit,now=Date.now}){
 if(!Array.isArray(keys)||keys.length<1||keys.length>2||typeof admit!=='function')throw Error('Invalid driver-control verifier')
 const map=new Map()
 for(const {keyId,secret} of keys){if(!kidOk(keyId)||map.has(keyId))throw Error('Invalid driver-control key ID');map.set(keyId,await key(secret))}
 return async(header,body,signal)=>{
  try{
   if(typeof header!=='string'||header.length>512||!header.startsWith('APOISDriver '))return {status:401}
   if(!envelope(body))return {status:403}
   const parts=header.slice(12).split('.')
   if(parts.length!==7)return {status:403}
   const [domain,kid,time,jti,sub,route,signature]=parts
   const k=map.get(kid),iat=Number(time),t=now()
   if(domain!==prefix||!k||!/^\d{13}$/.test(time)||!Number.isSafeInteger(t)||iat>t+1000||iat+15000<=t||
    !/^[A-Za-z0-9_-]{24}$/.test(jti)||!hashOk(sub)||!hashOk(route)||!/^[A-Za-z0-9_-]{43}$/.test(signature))return {status:403}
   if(sub!==hex(await sign(k,'apois-driver-control-principal-v1:'+body.authUserId.toLowerCase())))return {status:403}
   const sig=decode(signature)
   if(b64(sig)!==signature||!await crypto.subtle.verify('HMAC',k,sig,enc.encode(parts.slice(0,6).join('.')))||route!==await digest(body))return {status:403}
   const check=now()
   if(signal?.aborted||!Number.isSafeInteger(check)||check<t||iat+15000<=check)return {status:503}
   return admit({jti,sub,exp:iat+15000},check)
  }catch{return {status:503}}
 }
}
