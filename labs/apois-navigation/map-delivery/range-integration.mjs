// Real PMTiles reader, trusted local TLS, and an existing Vale archive as a transport fixture.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile,stat} from "node:fs/promises";
import {createReadStream} from "node:fs";
import {createServer} from "node:https";
import {PMTiles} from "pmtiles";
import {createVerifiedRangeSource} from './verified-range-source.mjs';
import {buildChunkManifest} from './build-chunk-manifest.mjs';
const [archive,manifest,cert,key]=process.argv.slice(2);
const expectedManifest="367c0104a8a5de7f11bdf2c965eb91a73e1cf21b5a3809f78f53e7170b7cdebb";
const sha=b=>createHash("sha256").update(b).digest("hex");
const raw=await readFile(manifest);assert.equal(sha(raw),expectedManifest);
const entry=JSON.parse(raw).files.find(f=>f.path==="vale.pmtiles");
const size=(await stat(archive)).size;assert.equal(size,entry.bytes);
const digest=entry.sha256;
const chunks=await buildChunkManifest(archive,{expectedSha256:digest,expectedBytes:size,chunkBytes:65536});
const path="/maps/nordeste-"+digest+".pmtiles"; // fixture only, NOT Nordeste coverage
const etag='"'+digest+'"';
let requests=0,transferred=0,unexpected=0;
const server=createServer({cert:await readFile(cert),key:await readFile(key)},(req,res)=>{
 if(req.method!=="GET"||req.url!==path||req.headers["if-range"]!==etag||req.headers.authorization||req.headers.cookie){
  unexpected++;res.writeHead(400).end();return;
 }
 const match=/^bytes=(\d+)-(\d+)$/.exec(req.headers.range??"");
 if(!match){unexpected++;res.writeHead(400).end();return;}
 const start=Number(match[1]),end=Number(match[2]);
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>=size){unexpected++;res.writeHead(416).end();return;}
 const length=end-start+1;requests++;transferred+=length;
 res.writeHead(206,{"Content-Type":"application/octet-stream","Content-Length":length,"Content-Range":"bytes "+start+"-"+end+"/"+size,"ETag":etag,"Cache-Control":"public, max-age=31536000, immutable"});
 const stream=createReadStream(archive,{start,end});stream.on("error",()=>res.destroy());res.on("close",()=>stream.destroy());stream.pipe(res);
});
await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
const origin="https://127.0.0.1:"+server.address().port;
const source=await createVerifiedRangeSource({url:origin+path,authorizedOrigin:origin,manifestBytes:chunks.raw,expectedManifestSha256:chunks.sha256,etag});
try{
 const p=new PMTiles(source);const h=await p.getHeader();assert.equal(h.specVersion,3);assert.equal(h.tileType,1);
 const z=15,n=2**z,lat=-9.403901,lon=-40.5040233;
 const x=Math.floor((lon+180)/360*n),y=Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n);
 const tile=await p.getZxy(z,x,y);assert.ok(tile?.data?.byteLength>0);
 assert.equal(unexpected,0);assert.ok(requests>0);assert.ok(transferred<size,"reader transferred entire archive");
 console.log(JSON.stringify({fixture:"vale-pe-ba",archiveBytes:size,rangeBytes:transferred,requests,tileBytes:tile.data.byteLength,https:true,chunkManifestSha256:chunks.sha256,chunkVerified:true,limits:"transport fixture only; no Northeast map, CDN, CORS or Android claim"},null,2));
}finally{
 source.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
