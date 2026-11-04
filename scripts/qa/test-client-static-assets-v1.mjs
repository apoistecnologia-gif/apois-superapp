import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {verifyClientBundleAssets} from './verify-client-static-assets-v1.mjs';
const root=mkdtempSync(resolve(tmpdir(),'apois-client-assets-'));
const put=(name,content)=>{
 const full=resolve(root,name);
 mkdirSync(resolve(full,'..'),{recursive:true});
 writeFileSync(full,content);
};
try{
 put('index.html','<script src="./assets/shell.js"></script>');
 put('assets/shell.js','export {}');
 put('modules/corridas/index.html','<script src="./assets/ride.js"></script><link rel="stylesheet" href="./assets/ride.css">');
 put('modules/corridas/assets/ride.js','export {}');
 put('modules/corridas/assets/ride.css','body{background:url("./pin.svg")}');
 put('modules/corridas/assets/pin.svg','<svg/>');
 put('modules/entregas/index.html','<script src="./assets/order.js"></script>');
 put('modules/entregas/assets/order.js','export {}');
 assert.equal(verifyClientBundleAssets(root).assetsChecked,5);
 put('modules/entregas/index.html','<script src="./assets/not-found.js"></script>');
 assert.throws(()=>verifyClientBundleAssets(root),/missing local asset .\/assets\/not-found\.js/);
 put('modules/entregas/index.html','<script src="./assets/order.js"></script>');
 put('modules/corridas/assets/ride.css','body{background:url("./missing.png")}');
 assert.throws(()=>verifyClientBundleAssets(root),/missing local asset .\/missing\.png/);
 put('modules/corridas/assets/ride.css','body{background:url(data:image\/svg+xml;utf8,abc)}');
 assert.equal(verifyClientBundleAssets(root).entries,3);
 console.log('[PASS] Client bundle includes Corridas and Entregas entrypoints; broken JS/CSS assets are rejected');
}finally{rmSync(root,{recursive:true,force:true});}
