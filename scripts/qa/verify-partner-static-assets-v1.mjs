// APOIS Partner APK: block missing local JS/CSS/font/image assets at bundle time.
// Read-only local filesystem verification; no data, network or Android execution.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const entrypoints=['index.html','modules/motorista/index.html','modules/entregador/index.html'];
function attribute(tag,name){
 const re=new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27|([^\\s>]+))','i');
 const m=tag.match(re);return m?(m[1]??m[2]??m[3]):null;
}
function localAsset(root,owner,raw){
 const source=raw.trim();
 if(!source||/^(?:https?:|data:|blob:|file:|mailto:|tel:|\/\/|#)/i.test(source))return null;
 if(/^[a-z][a-z0-9+.-]*:/i.test(source))throw Error('Unexpected asset scheme: '+source.slice(0,100));
 const base=new URL(owner.split(sep).join('/'),'https://apois-native.invalid/');
 const uri=new URL(source,base);
 if(uri.origin!==base.origin)return null;
 const full=resolve(root,'.'+decodeURIComponent(uri.pathname));
 const rel=relative(root,full);
 if(rel==='..'||rel.startsWith('..'+sep)||rel.startsWith(sep))throw Error('Asset escaped APK root: '+owner+' -> '+source);
 return {full,rel};
}
function htmlRefs(html){
 const refs=[];
 for(const m of html.matchAll(/<(?:script|link)\b[^>]*>/gi)){
  const tag=m[0];
  if(/^<script\b/i.test(tag)){const src=attribute(tag,'src');if(src!==null)refs.push(src);continue;}
  const rel=(attribute(tag,'rel')||'').toLowerCase().split(/\s+/);
  const as=(attribute(tag,'as')||'').toLowerCase();
  if(rel.includes('stylesheet')||rel.includes('modulepreload')||
     (rel.includes('preload')&&['script','style','font'].includes(as))){
   const href=attribute(tag,'href');if(href!==null)refs.push(href);
  }
 }
 return refs;
}
function cssRefs(css){
 const refs=[];
 for(const m of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi))refs.push(m[1]??m[2]??m[3]);
 return refs;
}
// Authenticated screens can import local ESM chunks on demand. In addition
// to HTML/CSS assets, validate static/dynamic literal JS import edges and
// Vite dependency preload arrays. Computed imports need runtime E2E tests.
export function jsLocalRefs(js){
 const refs=[];
 const patterns=[
  /\bfrom\s*(["'])(\.{1,2}\/[^"'\r\n]+)\1/g,
  /\bimport\s*(["'])(\.{1,2}\/[^"'\r\n]+)\1/g,
  /\bimport\s*\(\s*(["'\x60])(\.{1,2}\/[^"'\x60\r\n]+)\1\s*\)/g,
 ];
 for(const pattern of patterns)for(const match of js.matchAll(pattern))refs.push(match[2]);
 if(js.includes('__vite__mapDeps')){
  for(const match of js.matchAll(/\bm\.f\s*=\s*\[([^\]]*)\]/g)){
   for(const ref of match[1].matchAll(/(["'])(\.{1,2}\/[^"'\r\n]+)\1/g))refs.push(ref[2]);
  }
 }
 return refs;
}
function filesWithJs(dir){
 const out=[];
 function walk(directory){
  for(const name of readdirSync(directory)){
   const full=resolve(directory,name);
   if(statSync(full).isDirectory())walk(full);
   else if(name.toLowerCase().endsWith('.js')||name.toLowerCase().endsWith('.mjs'))out.push(full);
  }
 }
 walk(dir);return out;
}
function filesWithCss(dir){
 const out=[];
 function walk(directory){
  for(const name of readdirSync(directory)){
   const full=resolve(directory,name);
   if(statSync(full).isDirectory())walk(full);
   else if(name.toLowerCase().endsWith('.css'))out.push(full);
  }
 }
 walk(dir);return out;
}
export function verifyMobileBundleAssets(bundleRoot, entries, label){
 const root=resolve(bundleRoot),errors=[];let inspected=0;
 function check(owner,ref){
  try{
   const asset=localAsset(root,owner,ref);if(!asset)return;
   inspected++;
   if(!existsSync(asset.full)||!statSync(asset.full).isFile()){
    errors.push(owner+': missing local asset '+ref+' (expected '+asset.rel+')');
   }
  }catch(e){errors.push(owner+': '+e.message);}
 }
 for(const path of entries){
  const entry=resolve(root,path);
  if(!existsSync(entry)){errors.push('Missing '+label+' entrypoint: '+path);continue;}
  for(const ref of htmlRefs(readFileSync(entry,'utf8')))check(path,ref);
 }
 if(existsSync(root))for(const file of filesWithCss(root)){
  const owner=relative(root,file);
  for(const ref of cssRefs(readFileSync(file,'utf8')))check(owner,ref);
 }
 if(existsSync(root))for(const file of filesWithJs(root)){
  const owner=relative(root,file);
  for(const ref of jsLocalRefs(readFileSync(file,'utf8')))check(owner,ref);
 }
 if(errors.length)throw Error('[FAIL] APK '+label+' has '+errors.length+' missing/broken local assets:\n'+errors.slice(0,30).join('\n'));
 if(!inspected)throw Error('[FAIL] APK '+label+' did not verify any local script/style/asset reference');
 console.log('[PASS] '+label+' bundle: '+entries.length+' entrypoints, '+inspected+' linked local assets verified');
 return {entries:entries.length,assetsChecked:inspected};
}
export function verifyPartnerBundleAssets(bundleRoot){
 return verifyMobileBundleAssets(bundleRoot,entrypoints,'Partner');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 verifyPartnerBundleAssets(process.argv[2]||'superapp/partner-shell/dist');
}
