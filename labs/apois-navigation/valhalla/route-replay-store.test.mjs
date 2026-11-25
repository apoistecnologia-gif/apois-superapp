import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawn} from "node:child_process";
import {generateKeyPairSync,sign} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {openRouteReplayStore} from "./route-replay-store.mjs";
import {createRouteAuthorization,routeDigest} from "./route-authorization.mjs";
const claim=(n,sub="a",time=100000)=>({jti:String(n).padStart(24,"0"),sub:sub.repeat(64),exp:time+30000});
function fixture(t,options={}){
  const dir=mkdtempSync(join(tmpdir(),"apois-replay-"));
  const path=join(dir,"replay.sqlite"),opened=[];
  let initialize=true;
  const open=()=>{const s=openRouteReplayStore({path,...options,initialize});initialize=false;opened.push(s);return s;};
  t.after(()=>{for(const s of opened)s.close();rmSync(dir,{recursive:true,force:true});});
  return {path,open};
}
test("replay and quota survive closing and reopening connections",t=>{
  const {open}=fixture(t,{perMinute:2});
  const a=open(),p=claim(1),g=a.admit(p,100000);
  assert.equal(g.status,200);g.release();a.close();
  const b=open();
  assert.equal(b.admit(p,100001).status,403);
  const second=b.admit(claim(2),100002);assert.equal(second.status,200);second.release();
  assert.equal(b.admit(claim(3),100003).status,429);
  const later=b.admit(claim(4,"a",160002),160002);assert.equal(later.status,200);later.release();
});
test("separate connections share global and per-driver concurrency and rate limits",t=>{
  const {open}=fixture(t,{globalParallel:2,globalPerMinute:3});
  const a=open(),b=open(),g=a.admit(claim(1),100000);
  assert.equal(g.status,200);
  assert.equal(b.admit(claim(2),100000).status,429);
  const h=b.admit(claim(3,"b"),100000);assert.equal(h.status,200);
  assert.equal(a.admit(claim(4,"c"),100000).status,429);
  g.release();g.release();
  const k=a.admit(claim(5,"c"),100000);assert.equal(k.status,200);
  k.release();h.release();
  assert.equal(b.admit(claim(6,"d"),100000).status,429);
});
test("crashed connection keeps active lease until bounded expiry and retains replay",t=>{
  const {open}=fixture(t);
  const a=open(),g=a.admit(claim(1),100000);
  assert.equal(g.status,200);a.close();
  const b=open();assert.equal(b.admit(claim(2,"a",129999),129999).status,429);
  const h=b.admit(claim(3,"a",130000),130000);assert.equal(h.status,200);
  g.release();assert.equal(b.admit(claim(4,"a",130001),130001).status,429);
  h.release();
});
test("late release cannot clear new lease after an old ID is cleaned up",t=>{
  const {open}=fixture(t);
  const a=open(),old=a.admit(claim(1),100000);assert.equal(old.status,200);
  const b=open(),next=b.admit(claim(1,"a",160001),160001);assert.equal(next.status,200);
  old.release();assert.equal(b.admit(claim(2,"a",160001),160001).status,429);
  next.release();
});
test("capacity and clock regression are persisted, mismatched configurations rejected",t=>{
  const {open,path}=fixture(t,{maxEntries:1});
  const a=open(),g=a.admit(claim(1),100000);assert.equal(g.status,200);g.release();
  assert.equal(a.admit(claim(2),100001).status,429);a.close();
  assert.throws(()=>openRouteReplayStore({path,maxEntries:2}));
  const b=open();
  // The first claim has an overlong remaining lifetime at the regressed
  // clock and must be rejected before storage. The second is structurally
  // valid, so it independently exercises the persisted clock guard.
  assert.equal(b.admit(claim(3),99999).status,403);
  assert.equal(b.admit(claim(3,"a",99999),99999).status,503);
  assert.equal(b.admit(claim(3),100002).status,429);
  const h=b.admit(claim(4,"a",160002),160002);assert.equal(h.status,200);h.release();
});
test("two concurrent OS processes cannot admit the same credential",async t=>{
  const {open,path}=fixture(t);open().close();
  const module=new URL("./route-replay-store.mjs",import.meta.url).href;
  const source=`import {openRouteReplayStore} from ${JSON.stringify(module)};
    const s=openRouteReplayStore({path:process.argv[1]});
    const r=s.admit(JSON.parse(process.argv[2]),100000);console.log(r.status);s.close();`;
  const run=()=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,["--input-type=module","-e",source,path,JSON.stringify(claim(1))],{stdio:["ignore","pipe","pipe"]});
    let out="",err="";child.stdout.on("data",x=>out+=x);child.stderr.on("data",x=>err+=x);
    child.once("error",reject);child.once("close",code=>code===0?resolve(Number(out.trim())):reject(Error(err)));
  });
  const results=await Promise.all([run(),run()]);
  assert.equal(results.filter(x=>x===200).length,1);
  assert.ok(results.every(x=>x===200||x===403||x===503));
  assert.equal(open().admit(claim(1),100000).status,403);
});
test("signed gateway verification uses shared store and never falls back on failure",t=>{
  const {open}=fixture(t);
  const {publicKey,privateKey}=generateKeyPairSync("ed25519"),body={fixture:true};
  const p=claim(1),raw=Buffer.from(JSON.stringify({aud:"lab",iat:100000,...p,route:routeDigest(body)}));
  const header="Bearer "+raw.toString("base64url")+"."+sign(null,raw,privateKey).toString("base64url");
  const a=open(),b=open(),auth=s=>createRouteAuthorization({publicKey,audience:"lab",now:()=>100000,store:s});
  const g=auth(a)(header,body);assert.equal(g.status,200);g.release();
  assert.equal(auth(b)(header,body).status,403);
  b.close();assert.equal(auth(b)(header,body).status,503);
  assert.equal(auth({admit(){throw Error("unavailable");}})(header,body).status,503);
});

test("busy SQLite writer fails closed without consuming or forwarding the credential",t=>{
  const {open,path}=fixture(t);
  const store=open();
  const locked=new DatabaseSync(path);
  try{
    locked.exec("BEGIN IMMEDIATE");
    assert.equal(store.admit(claim(1),100000).status,503);
    locked.exec("ROLLBACK");
    const grant=store.admit(claim(1),100000);
    assert.equal(grant.status,200);grant.release();
    assert.equal(store.admit(claim(1),100001).status,403);
  }finally{locked.close();}
});

test("missing replay database after restart is not silently reprovisioned",t=>{
  const {open,path}=fixture(t);const store=open();
  const grant=store.admit(claim(1),100000);assert.equal(grant.status,200);grant.release();store.close();
  rmSync(path);
  assert.throws(()=>openRouteReplayStore({path}));
  assert.throws(()=>open());
  writeFileSync(path,"");
  assert.throws(()=>openRouteReplayStore({path}));
  assert.throws(()=>openRouteReplayStore({path,initialize:true}));
});
test("existing replay metadata is never recreated or overwritten",t=>{
  const {open,path}=fixture(t);const store=open();
  const grant=store.admit(claim(1),100000);assert.equal(grant.status,200);grant.release();store.close();
  assert.throws(()=>openRouteReplayStore({path,initialize:true}));
  const db=new DatabaseSync(path);db.exec("DELETE FROM route_meta");db.close();
  assert.throws(()=>openRouteReplayStore({path}));
});

test("strict issuance registry rejects unknown, mismatched and revoked credentials across restart",t=>{
  const {open}=fixture(t,{requireIssued:true});
  const p=claim(1),a=open(),b=open();
  assert.equal(a.admit(p,100000).status,403);
  assert.equal(a.register(p,100000).status,200);
  assert.equal(b.register(p,100000).status,403);
  assert.equal(b.admit({...p,sub:"b".repeat(64)},100000).status,403);
  assert.equal(b.admit({...p,exp:129999},100000).status,403);
  assert.equal(b.revoke(p.jti,100001).status,200);
  assert.equal(a.revoke(p.jti,100001).status,200);
  a.close();b.close();
  const reopened=open();
  assert.equal(reopened.admit(p,100002).status,403);
  assert.equal(reopened.register(p,100002).status,403);
  assert.equal(reopened.revoke(claim(2).jti,100002).status,404);
});
test("strict admission and revocation serialize; admission winner cannot be reported as revoked",t=>{
  const {open}=fixture(t,{requireIssued:true});const a=open(),b=open(),p=claim(1);
  assert.equal(a.register(p,100000).status,200);
  const g=b.admit(p,100001);assert.equal(g.status,200);
  assert.equal(a.revoke(p.jti,100001).status,409);g.release();
  assert.equal(a.revoke(p.jti,100002).status,409);
  assert.equal(a.admit(p,100002).status,403);
});
test("strict registry never evicts live revoked records; expiration releases capacity",t=>{
  const {open}=fixture(t,{requireIssued:true,maxEntries:1});
  const a=open(),p=claim(1);
  assert.equal(a.register(p,100000).status,200);
  assert.equal(a.revoke(p.jti,100001).status,200);
  assert.equal(a.register(claim(2),100002).status,429);
  assert.equal(a.register(claim(3,"a",100000),100000).status,503);
  const q=claim(2,"a",130000);
  assert.equal(a.register(q,130000).status,200);
  assert.equal(a.admit(p,130000).status,403);
  const g=a.admit(q,130000);assert.equal(g.status,200);g.release();
});
test("strict registry fails closed on writer contention, and mode cannot change on reopen",t=>{
  const {open,path}=fixture(t,{requireIssued:true});const a=open(),p=claim(1);
  assert.throws(()=>openRouteReplayStore({path}));
  const locked=new DatabaseSync(path);
  try{
    locked.exec("BEGIN IMMEDIATE");
    assert.equal(a.register(p,100000).status,503);
    assert.equal(a.revoke(p.jti,100000).status,503);
    locked.exec("ROLLBACK");
    assert.equal(a.admit(p,100000).status,403);
    assert.equal(a.register(p,100000).status,200);
  }finally{locked.close();}
});

test("scoped cancellation blocks existing and future credentials for the leg across restart",t=>{
  const {open}=fixture(t,{requireIssued:true,requireScoped:true});
  const a=open(),b=open(),scope="c".repeat(64),other="d".repeat(64);
  const p={...claim(1),scope},q={...claim(2,"b"),scope},r={...claim(3),scope:other};
  assert.equal(a.register(claim(4),100000).status,403);
  assert.equal(a.register(p,100000).status,200);
  assert.equal(a.register(q,100000).status,200);
  assert.equal(a.register(r,100000).status,200);
  assert.equal(b.revokeScope(scope,100001).status,200);
  assert.equal(b.revokeScope(scope,100001).status,200);
  a.close();b.close();const fresh=open();
  assert.equal(fresh.admit(p,100002).status,403);
  assert.equal(fresh.admit(q,100002).status,403);
  const g=fresh.admit(r,100002);assert.equal(g.status,200);g.release();
  assert.equal(fresh.register({...claim(4,"a",200000),scope},200000).status,403);
});
test("scope tombstone capacity durably halts both emission and admission",t=>{
  const {open}=fixture(t,{requireIssued:true,requireScoped:true,maxRevokedScopes:1});
  const a=open(),p={...claim(1),scope:"d".repeat(64)};
  assert.equal(a.register(p,100000).status,200);
  assert.equal(a.revokeScope("c".repeat(64),100001).status,200);
  assert.equal(a.revokeScope("c".repeat(64),100001).status,200);
  assert.equal(a.revokeScope(p.scope,100002).status,503);
  a.close();const b=open();
  assert.equal(b.admit(p,100003).status,503);
  assert.equal(b.register({...claim(2),scope:"e".repeat(64)},100003).status,503);
});
test("revoked scope prevents future issue even if there was no previous token",t=>{
  const {open,path}=fixture(t,{requireIssued:true,requireScoped:true});const a=open(),scope="c".repeat(64);
  assert.equal(a.revokeScope(scope,100000).status,200);
  assert.equal(a.register({...claim(1),scope},100001).status,403);
  assert.throws(()=>openRouteReplayStore({path,requireIssued:true}));
});
