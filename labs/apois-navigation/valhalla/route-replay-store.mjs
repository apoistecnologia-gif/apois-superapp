// Disposable single-host SQLite experiment. No deployment, remote database,
// account tokens, route coordinates or raw user IDs. A database shared by
// multiple machines requires a different, reviewed atomic store.
import {DatabaseSync} from "node:sqlite";
import {randomBytes} from "node:crypto";
import {openSync,closeSync,lstatSync} from "node:fs";
const tokenId=/^[A-Za-z0-9_-]{22,64}$/;
const hash=/^[a-f0-9]{64}$/;
export function openRouteReplayStore({path,initialize=false,requireIssued=false,requireScoped=false,maxRevokedScopes=4096,maxEntries=4096,maxPrincipals=1024,
  perMinute=6,parallel=1,globalPerMinute=60,globalParallel=4,activeMs=30000}){
  if(typeof path!=="string"||!path||path===":memory:"||typeof initialize!=="boolean"||typeof requireIssued!=="boolean"||typeof requireScoped!=="boolean"||
      (requireScoped&&!requireIssued)||![maxRevokedScopes,maxEntries,maxPrincipals,perMinute,parallel,globalPerMinute,globalParallel,activeMs]
      .every(n=>Number.isSafeInteger(n)&&n>0)||activeMs<15000||activeMs>60000)
    throw Error("Invalid local replay store configuration");
  // First provisioning is explicit and exclusive. Reopening a missing or
  // empty file must never silently reset replay and consumption history.
  // The operator must keep this file and its WAL in a private directory.
  if(initialize){const fd=openSync(path,"wx",0o600);closeSync(fd);}
  if(!lstatSync(path).isFile())throw Error("Replay storage must be a regular file");
  const db=new DatabaseSync(path,{timeout:100,allowExtension:false});
  let closed=false;
  const config=JSON.stringify([maxEntries,maxPrincipals,perMinute,parallel,globalPerMinute,globalParallel,activeMs,requireIssued,requireScoped,maxRevokedScopes]);
  function transaction(fn){
    if(closed)return {status:503};
    let begun=false;
    try{
      db.exec("BEGIN IMMEDIATE");begun=true;
      const result=fn();
      db.exec("COMMIT");begun=false;
      return result;
    }catch{
      if(begun)try{db.exec("ROLLBACK");}catch{}
      return {status:503};
    }
  }
  try{
    db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA trusted_schema=OFF;");
    const ready=transaction(()=>{
      if(initialize){
        db.exec(`CREATE TABLE route_meta(
          id INTEGER PRIMARY KEY CHECK(id=1),config TEXT NOT NULL,last_ms INTEGER NOT NULL,
          halted INTEGER NOT NULL CHECK(halted IN (0,1))
        ) STRICT;
        CREATE TABLE route_uses(
          jti TEXT PRIMARY KEY, sub TEXT NOT NULL, expires INTEGER NOT NULL,
          started INTEGER NOT NULL, active_until INTEGER NOT NULL, lease TEXT NOT NULL
        ) STRICT;
        CREATE INDEX route_uses_sub ON route_uses(sub);
        CREATE TABLE route_issued(
          jti TEXT PRIMARY KEY, sub TEXT NOT NULL, expires INTEGER NOT NULL,
          revoked INTEGER NOT NULL CHECK(revoked IN (0,1)), scope TEXT,
          issued_at INTEGER NOT NULL
        ) STRICT;
        CREATE INDEX route_issued_sub_time ON route_issued(sub,issued_at);
        CREATE INDEX route_issued_time ON route_issued(issued_at);
        CREATE TABLE route_revoked_scopes(scope TEXT PRIMARY KEY) STRICT;`);
        db.prepare("INSERT INTO route_meta(id,config,last_ms,halted) VALUES(1,?,0,0)").run(config);
      }
      const meta=db.prepare("SELECT config,last_ms,halted FROM route_meta WHERE id=1").get();
      if(meta?.config!==config||!Number.isSafeInteger(meta.last_ms)||meta.last_ms<0||![0,1].includes(meta.halted))
        throw Error("Replay configuration or metadata mismatch");
      // Refuse incomplete schema; do not repair or initialize on restart.
      db.prepare("SELECT jti,sub,expires,started,active_until,lease FROM route_uses LIMIT 0").all();
      db.prepare("SELECT jti,sub,expires,revoked,scope,issued_at FROM route_issued LIMIT 0").all();
      db.prepare("SELECT scope FROM route_revoked_scopes LIMIT 0").all();
      return {status:200};
    });
    if(ready.status!==200)throw Error("Replay storage unavailable or incompatible");
  }catch(e){db.close();throw e;}
  const count=(sql,...params)=>db.prepare(sql).get(...params).n;
  const validTime=t=>Number.isSafeInteger(t)&&t>=0&&t<=Number.MAX_SAFE_INTEGER-60000;
  const validClaim=(claim,t)=>claim&&typeof claim.jti==="string"&&tokenId.test(claim.jti)&&
    typeof claim.sub==="string"&&hash.test(claim.sub)&&validTime(t)&&
    Number.isSafeInteger(claim.exp)&&claim.exp>t&&claim.exp-t<=30000;
  function advance(t){
    const meta=db.prepare("SELECT last_ms,halted FROM route_meta WHERE id=1").get();
    if(!meta||meta.halted!==0||t<meta.last_ms)return false;
    db.prepare("UPDATE route_meta SET last_ms=? WHERE id=1").run(t);
    // Scoped mode retains even consumed/revoked/expired permits for the full
    // issuance minute. Expiry still denies admission after at most 30s.
    if(requireScoped)db.prepare("DELETE FROM route_issued WHERE expires<=? AND issued_at<=?").run(t,t-60000);
    else db.prepare("DELETE FROM route_issued WHERE expires<=?").run(t);
    return true;
  }
  // Trusted issuer/operator only; never exposed as a client endpoint. The
  // strict mode is immutable for this database and shares the admission lock.
  function register(claim,t){
    if(!requireIssued)return {status:503};
    if(!validClaim(claim,t))return {status:403};
    const {jti,sub,exp}=claim;
    const scope=claim.scope??null;
    if(requireScoped&&(typeof scope!=="string"||!hash.test(scope)))return {status:403};
    if(!requireScoped&&scope!==null)return {status:403};
    return transaction(()=>{
      if(!advance(t))return {status:503};
      if(requireScoped&&db.prepare("SELECT 1 FROM route_revoked_scopes WHERE scope=?").get(scope))return {status:403};
      if(db.prepare("SELECT 1 FROM route_issued WHERE jti=?").get(jti)||
         db.prepare("SELECT 1 FROM route_uses WHERE jti=?").get(jti))return {status:403};
      if(count("SELECT COUNT(*) AS n FROM route_issued")>=maxEntries)return {status:429};
      if(requireScoped){
        if(!db.prepare("SELECT 1 FROM route_issued WHERE sub=? LIMIT 1").get(sub)&&
           count("SELECT COUNT(DISTINCT sub) AS n FROM route_issued")>=maxPrincipals)return {status:429};
        if(count("SELECT COUNT(*) AS n FROM route_issued WHERE sub=? AND issued_at>?",sub,t-60000)>=perMinute||
           count("SELECT COUNT(*) AS n FROM route_issued WHERE issued_at>?",t-60000)>=globalPerMinute)return {status:429};
      }
      db.prepare("INSERT INTO route_issued(jti,sub,expires,revoked,scope,issued_at) VALUES(?,?,?,0,?,?)").run(jti,sub,exp,scope,t);
      return {status:200};
    });
  }
  // A tombstone is never expired automatically: a delayed stale authority
  // read must not reopen a revoked leg. At capacity halt the whole store
  // durably rather than forget a cancellation. No automatic reset path.
  function revokeScope(scope,t){
    if(!requireScoped)return {status:503};
    if(typeof scope!=="string"||!hash.test(scope)||!validTime(t))return {status:403};
    return transaction(()=>{
      if(!advance(t))return {status:503};
      if(db.prepare("SELECT 1 FROM route_revoked_scopes WHERE scope=?").get(scope))return {status:200};
      if(count("SELECT COUNT(*) AS n FROM route_revoked_scopes")>=maxRevokedScopes){
        db.prepare("UPDATE route_meta SET halted=1 WHERE id=1").run();
        return {status:503};
      }
      db.prepare("INSERT INTO route_revoked_scopes(scope) VALUES(?)").run(scope);
      return {status:200};
    });
  }
  function revoke(jti,t){
    if(!requireIssued)return {status:503};
    if(typeof jti!=="string"||!tokenId.test(jti)||!validTime(t))return {status:403};
    return transaction(()=>{
      if(!advance(t))return {status:503};
      // Admission already won the race; no claim of upstream cancellation.
      if(db.prepare("SELECT 1 FROM route_uses WHERE jti=?").get(jti))return {status:409};
      if(!db.prepare("SELECT 1 FROM route_issued WHERE jti=? AND expires>?").get(jti,t))return {status:404};
      db.prepare("UPDATE route_issued SET revoked=1 WHERE jti=?").run(jti);
      return {status:200};
    });
  }
  function admit(claim,t){
    if(!validClaim(claim,t))return {status:403};
    const {jti,sub,exp}=claim;
    const lease=randomBytes(18).toString("base64url");
    const result=transaction(()=>{
      if(!advance(t))return {status:503};
      if(requireIssued){
        const issued=db.prepare("SELECT sub,expires,revoked,scope FROM route_issued WHERE jti=?").get(jti);
        if(!issued||issued.revoked!==0||issued.sub!==sub||issued.expires!==exp)return {status:403};
        if(requireScoped&&(typeof issued.scope!=="string"||!hash.test(issued.scope)||
          db.prepare("SELECT 1 FROM route_revoked_scopes WHERE scope=?").get(issued.scope)))return {status:403};
      }
      // Preserve each row until replay, minute window AND active lease expire.
      db.prepare("DELETE FROM route_uses WHERE expires<=? AND started<=? AND active_until<=?").run(t,t-60000,t);
      if(db.prepare("SELECT 1 FROM route_uses WHERE jti=?").get(jti))return {status:403};
      if(count("SELECT COUNT(*) AS n FROM route_uses")>=maxEntries)return {status:429};
      if(!db.prepare("SELECT 1 FROM route_uses WHERE sub=? LIMIT 1").get(sub)&&
         count("SELECT COUNT(DISTINCT sub) AS n FROM route_uses")>=maxPrincipals)return {status:429};
      if(count("SELECT COUNT(*) AS n FROM route_uses WHERE sub=? AND started>?",sub,t-60000)>=perMinute||
         count("SELECT COUNT(*) AS n FROM route_uses WHERE sub=? AND active_until>?",sub,t)>=parallel||
         count("SELECT COUNT(*) AS n FROM route_uses WHERE started>?",t-60000)>=globalPerMinute||
         count("SELECT COUNT(*) AS n FROM route_uses WHERE active_until>?",t)>=globalParallel)return {status:429};
      db.prepare("INSERT INTO route_uses(jti,sub,expires,started,active_until,lease) VALUES(?,?,?,?,?,?)")
        .run(jti,sub,exp,t,t+activeMs,lease);
      return {status:200};
    });
    if(result.status!==200)return result;
    let released=false;
    return {status:200,release(){
      if(released)return;
      released=true;
      // A delayed release cannot clear a newer lease, even if an ID was
      // reused after the old row expired. Failure leaves a conservative TTL.
      transaction(()=>{
        db.prepare("UPDATE route_uses SET active_until=0 WHERE jti=? AND lease=?").run(jti,lease);
        return {status:200};
      });
    }};
  }
  return {admit,register,revoke,revokeScope,close(){if(!closed){closed=true;db.close();}}};
}
