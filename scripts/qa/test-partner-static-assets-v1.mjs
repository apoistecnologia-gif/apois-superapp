import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { verifyPartnerBundleAssets } from './verify-partner-static-assets-v1.mjs';
const root=mkdtempSync(resolve(tmpdir(),'apois-partner-assets-'));
const put=(path,data)=>{const full=resolve(root,path);mkdirSync(resolve(full,'..'),{recursive:true});writeFileSync(full,data);};
try{
 put('index.html','<script type="module" src="./assets/shell.js"></script>');
 put('assets/shell.js','export {}');
 put('modules/motorista/index.html','<link rel="stylesheet" href="./assets/driver.css"><script type="module" src="./assets/driver.js"></script>');
 put('modules/motorista/assets/driver.css','body{background-image:url(./logo.svg)}');
 put('modules/motorista/assets/logo.svg','<svg></svg>');
 put('modules/motorista/assets/driver.js','export {}');
 put('modules/entregador/index.html','<script type="module" src="./assets/courier.js"></script><link rel="preload" as="font" href="./assets/font.woff2">');
 put('modules/entregador/assets/courier.js','export {}');
 put('modules/entregador/assets/font.woff2','SYNTHETIC');
 assert.equal(verifyPartnerBundleAssets(root).assetsChecked,6);
 put('modules/entregador/index.html','<script src="./assets/absent.js"></script>');
 assert.throws(()=>verifyPartnerBundleAssets(root),/missing local asset .\/assets\/absent\.js/);
 put('modules/entregador/index.html','<script src="./assets/courier.js"></script>');
 put('modules/motorista/assets/driver.css','body{background-image:url(./missing.svg)}');
 assert.throws(()=>verifyPartnerBundleAssets(root),/missing local asset .\/missing\.svg/);
 put('modules/motorista/assets/driver.css','body{background-image:url(data:image\/png;base64,iVBORw)}');
 assert.equal(verifyPartnerBundleAssets(root).entries,3);
 console.log('[PASS] Partner APK asset integrity: good bundle, missing JS, missing CSS image, inline data');
}finally{rmSync(root,{recursive:true,force:true});}
