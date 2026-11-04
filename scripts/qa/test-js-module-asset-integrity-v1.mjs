import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {jsLocalRefs,verifyMobileBundleAssets} from './verify-partner-static-assets-v1.mjs';
const root=mkdtempSync(resolve(tmpdir(),'apois-js-graph-'));
const put=(name,value)=>{
 const path=resolve(root,name);mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,value,'utf8');
};
try{
 put('index.html','<script type="module" src="./modules/cliente/assets/main.js"></script>');
 put('modules/cliente/index.html','<script type="module" src="./assets/main.js"></script>');
 const js=[
  'import{p as q}from"./existing.js";',
  'import("./lazy.js");',
  'import(' + String.fromCharCode(96) + './lazy-template.js' + String.fromCharCode(96) + ');',
  'import"./side-effect.js";',
  'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./preload.js","./styles.css"])))=>i.map(i=>d[i]);'
 ].join('\n');
 put('modules/cliente/assets/main.js',js);
 for(const name of ['existing.js','lazy.js','lazy-template.js','side-effect.js','preload.js'])put('modules/cliente/assets/'+name,'export const x=1;');
 put('modules/cliente/assets/styles.css','body {color:black}');
 assert.deepEqual(new Set(jsLocalRefs(js)),new Set(['./existing.js','./lazy.js','./lazy-template.js','./side-effect.js','./preload.js','./styles.css']));
 const entries=['index.html','modules/cliente/index.html'];
 assert.equal(verifyMobileBundleAssets(root,entries,'Cliente').assetsChecked,8);
 for(const [original,missing] of [
  ['./lazy.js','./missing-lazy.js'],
  ['./preload.js','./missing-preload.js'],
  ['./existing.js','./missing-static.js'],
  ['./lazy-template.js','./missing-template.js']
 ]){
  put('modules/cliente/assets/main.js',js.replace(original,missing));
  assert.throws(()=>verifyMobileBundleAssets(root,entries,'Cliente'),/missing local asset/);
 }
 put('modules/cliente/assets/main.js',js);
 assert.equal(verifyMobileBundleAssets(root,entries,'Cliente').entries,2);
 console.log('[PASS] Shared JS graph gate catches missing dynamic, static, template and preload route chunks');
}finally{rmSync(root,{recursive:true,force:true});}
