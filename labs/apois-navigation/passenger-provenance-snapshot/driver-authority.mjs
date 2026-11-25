// Server-only authority adapter. No default session verifier, remote DB,
// HTTP listener, credentials or deployment. Dependencies must be trusted.
// Never take the authentication ID, source or assignment from the client.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id=v=>typeof v==="string"&&uuid.test(v);
const phases=new Set(["PICKUP","TRIP"]);
const exact=(o,keys)=>o!==null&&typeof o==="object"&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
export function createDriverAuthority({verifySession,readDriverProof}={}){
  if(typeof verifySession!=="function"||typeof readDriverProof!=="function")throw Error("Trusted dependencies required");
  return async (session,request,signal)=>{
    if(!(signal instanceof AbortSignal)||signal.aborted||typeof session!=="string"||!session.length||
       session.length>8192||/\s|[\x00-\x1f\x7f]/.test(session)||
       !exact(request,["rideId","phase"])||!id(request.rideId)||!phases.has(request.phase))return null;
    const rideId=request.rideId,phase=request.phase;
    // Expected verifier result is a server-verified auth user UUID or null.
    // A decoded, unverified JWT is NOT a verifier.
    const authUserId=await verifySession(session,signal);
    if(signal.aborted||!id(authUserId))return null;
    const proof=await readDriverProof(Object.freeze({authUserId,rideId,phase}),signal);
    if(signal.aborted||!proof||proof.authUserId!==authUserId||proof.rideId!==rideId||
       proof.targetEvidence?.phase!==phase)return null;
    // Issuer independently validates phase, freshness, assigned driver,
    // category, source, evidence and exact destination before signing.
    return proof;
  };
}
