import test from "node:test";
import assert from "node:assert/strict";
import {createRangeSource} from "./range-source.mjs";
const sha256="a".repeat(64),origin="https://maps.example.invalid",url=origin+"/maps/nordeste-"+sha256+".pmtiles",etag='"v1"',bytes=200000;
const config={url,authorizedOrigin:origin,sha256,bytes,etag};
function fixture(overrides={}){
 const requests=[];
 const fetcher=async(u,opts)=>{
  requests.push({u,opts});
  const [start,end]=opts.headers.Range.slice(6).split("-").map(Number),len=end-start+1;
  return new Response(overrides.body??new Uint8Array(len).fill(7),{status:overrides.status??206,headers:{"ETag":etag,"Content-Range":"bytes "+start+"-"+end+"/"+bytes,"Content-Length":String(len),...overrides.headers}});
 };
 return {s:createRangeSource({...config,fetcher}),requests};
}
test("reads exact requested bytes and truncates at EOF",async()=>{
 const {s,requests}=fixture();const r=await s.getBytes(0,16384);
 assert.equal(r.data.byteLength,16384);assert.equal(new Uint8Array(r.data)[0],7);assert.equal(r.etag,etag);
 assert.equal((await s.getBytes(bytes-10,20)).data.byteLength,10);
 assert.equal(requests[1].opts.headers.Range,"bytes=199990-199999");assert.equal(requests[0].opts.credentials,"omit");assert.equal(requests[0].opts.redirect,"error");
});
test("rejects wrong endpoint/version and unsafe bounds before fetch",async()=>{
 for(const bad of [{url:"http://maps.example.invalid/maps/nordeste-"+sha256+".pmtiles"},{url:url+"?token=x"},{url:origin+"/other.pmtiles"},{etag:'W/"v1"'},{sha256:"bad"}])assert.throws(()=>createRangeSource({...config,...bad}));
 const {s,requests}=fixture();for(const args of [[-1,10],[bytes,1],[0,0],[0,9e6],[0,10,undefined,'"v2"']])await assert.rejects(s.getBytes(...args));
 assert.equal(requests.length,0);
});
test("rejects whole-file response, changed ETag, bad range, encoding and body lengths",async()=>{
 for(const bad of [{status:200},{headers:{ETag:'"v2"'}},{headers:{"Content-Range":"bytes 0-9/300000"}},{headers:{"Content-Length":"11"}},{headers:{"Content-Encoding":"gzip"}},{body:new Uint8Array(9)},{body:new Uint8Array(11)}])await assert.rejects(fixture(bad).s.getBytes(0,10));
});
test("cancellation and closed source never fetch",async()=>{
 const {s,requests}=fixture();const c=new AbortController();c.abort();await assert.rejects(s.getBytes(0,10,c.signal));s.close();await assert.rejects(s.getBytes(0,10));assert.equal(requests.length,0);
});
test("concurrency bounded; slot released on failure",async()=>{
 let release;const wait=new Promise(r=>release=r);
 const s=createRangeSource({...config,parallel:1,fetcher:async()=>{await wait;throw Error("network");}});
 const first=s.getBytes(0,10);await assert.rejects(s.getBytes(10,10),/concurrency/);release();await assert.rejects(first,/network/);await assert.rejects(s.getBytes(20,10),/network/);
});
