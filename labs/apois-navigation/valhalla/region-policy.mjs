// Explicit server-owned scope. No default Northeast approval or client-supplied geometry.
import {createHash} from "node:crypto";
export const valeContains=(lat,lon)=>lat>=-9.65&&lat<=-9.10&&lon>=-40.80&&lon<=-40.20;
export function inside(contains,lat,lon){
 if(typeof lat!=="number"||typeof lon!=="number"||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return false;
 try{return contains(lat,lon)===true;}catch{return false;}
}
// Bounded prepared rings. Geographic data must first be reviewed for valid
// topology (self-intersections, shared borders, simplification, holes).
// GeoJSON polygon/multipolygon, WGS84 lon/lat; excludes exact boundaries.
export function createPolygonRegion(raw,expectedSha256){
 if(!Buffer.isBuffer(raw)||raw.length<1||raw.length>8*1024*1024||typeof expectedSha256!=="string"||!/^[a-f0-9]{64}$/.test(expectedSha256)||createHash("sha256").update(raw).digest("hex")!==expectedSha256)throw Error("Untrusted regional geometry");
 const geo=JSON.parse(raw.toString("utf8"));
 const polys=geo.type==="Polygon"?[geo.coordinates]:geo.type==="MultiPolygon"?geo.coordinates:null;
 if(!Array.isArray(polys)||polys.length<1||polys.length>4096)throw Error("Invalid region geometry");
 let vertices=0;
 const prepared=polys.map(poly=>{
  if(!Array.isArray(poly)||poly.length<1||poly.length>4096)throw Error("Invalid polygon");
  return poly.map(ring=>{
   if(!Array.isArray(ring)||ring.length<4)throw Error("Invalid ring");
   vertices+=ring.length;if(vertices>250000)throw Error("Too many vertices");
   let minX=180,maxX=-180,minY=90,maxY=-90;
   for(const p of ring){
    if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)throw Error("Invalid coordinate");
    minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);
   }
   if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1]||minX===maxX||minY===maxY||maxX-minX>=180)throw Error("Invalid ring closure or extent");
   return {ring,minX,maxX,minY,maxY};
  });
 });
 function classify(r,x,y){
  if(x<r.minX||x>r.maxX||y<r.minY||y>r.maxY)return 0;
  let hit=false;
  for(let i=1;i<r.ring.length;i++){
   const [a,b]=r.ring[i-1],[c,d]=r.ring[i];
   const cross=(x-a)*(d-b)-(y-b)*(c-a);
   if(Math.abs(cross)<=1e-12&&x>=Math.min(a,c)&&x<=Math.max(a,c)&&y>=Math.min(b,d)&&y<=Math.max(b,d))return -1;
   if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
  }
  return hit?1:0;
 }
 return (lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&prepared.some(([outer,...holes])=>classify(outer,lon,lat)===1&&holes.every(h=>classify(h,lon,lat)===0));
}
