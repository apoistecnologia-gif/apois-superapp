// Disposable single-host SQLite experiment. No deployment, remote database,
// account tokens, route coordinates or raw user IDs. A database shared by
// multiple machines requires a different, reviewed atomic store.
import {DatabaseSync} from "node:sqlite";
import {randomBytes} from "node:crypto";
import {openSync,closeSync,lstatSync} from "node:fs";
const tokenId=/^[A-Za-z0-9_-]{22,64}$/;
const hash=/^[a-f0-9]{64}$/;
export function openRouteReplayStore({path,initialize=false,maxEntries=4096,maxPrincipals=1024,
  perMinute=6,parallel=1,globalPerMinute=60,globalParallel=4,activeMs=30000}){
  if(typeof path!=="string"||!path||path===":memory:"||typeof initialize!=="boolean"||![maxEntries,maxPrincipals,perMinute,parallel,globalPerMinute,globalParallel,activeMs]
      .every(n=>Number.isSafeInteger(n)&&n>0)||activeMs<15000||activeMs>60000)
    throw Error("Invalid local replay store configuration");
  // First provisioning is explicit and exclusive. Reopening a missing or
  // empty file must never silently reset replay and consumption history.
  // The operator must keep this file and its WAL in a private directory.
  if(initialize){const fd=openSync(path,"wx",0o600);closeSync(fd);}
  if(!lstatSync(path).isFile())throw Error("Replay storage must be a regular file");
  const db=new DatabaseSync(path,{timeout:100,allowExtension:false});
  let closed=false;
  const config=JSON.stringify([maxEntries,maxPrincipals,perMinute,parallel,globalPerMinute,globalParallel,activeMs]);
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
          id INTEGER PRIMARY KEY CHECK(id=1),config TEXT NOT NULL,last_ms INTEGER NOT NULL
        ) STRICT;
        CREATE TABLE route_uses(
          jti TEXT PRIMARY KEY, sub TEXT NOT NULL, expires INTEGER NOT NULL,
          started INTEGER NOT NULL, active_until INTEGER NOT NULL, lease TEXT NOT NULL
        ) STRICT;
        CREATE INDEX route_uses_sub ON route_uses(sub);`);
        db.prepare("INSERT INTO route_meta(id,config,last_ms) VALUES(1,?,0)").run(config);
      }
      const meta=db.prepare("SELECT config,last_ms FROM route_meta WHERE id=1").get();
      if(meta?.config!==config||!Number.isSafeInteger(meta.last_ms)||meta.last_ms<0)
        throw Error("Replay configuration or metadata mismatch");
      // Refuse incomplete schema; do not repair or initialize on restart.
      db.prepare("SELECT jti,sub,expires,started,active_until,lease FROM route_uses LIMIT 0").all();
      return {status:200};
    });
    if(ready.status!==200)throw Error("Replay storage unavailable or incompatible");
  }catch(e){db.close();throw e;}
  const count=(sql,...params)=>db.prepare(sql).get(...params).n;
  function admit(claim,t){
    if(!claim||typeof claim.jti!=="string"||!tokenId.test(claim.jti)||
      typeof claim.sub!=="string"||!hash.test(claim.sub)||
      !Number.isSafeInteger(t)||t<0||t>Number.MAX_SAFE_INTEGER-60000||
      !Number.isSafeInteger(claim.exp)||claim.exp<=t||claim.exp-t>30000)return {status:403};
    const {jti,sub,exp}=claim;
    const lease=randomBytes(18).toString("base64url");
    const result=transaction(()=>{
      const meta=db.prepare("SELECT last_ms FROM route_meta WHERE id=1").get();
      if(!meta||t<meta.last_ms)return {status:503};
      db.prepare("UPDATE route_meta SET last_ms=? WHERE id=1").run(t);
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
  return {admit,close(){if(!closed){closed=true;db.close();}}};
}
