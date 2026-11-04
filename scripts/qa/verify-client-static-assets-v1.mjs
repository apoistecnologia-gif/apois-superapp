// Same local-asset integrity gate as Partner, but targeting Cliente Corridas + Entregas.
// Reject missing JS/CSS/font/image before signing a native client APK.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyMobileBundleAssets } from './verify-partner-static-assets-v1.mjs';

const entries=['index.html','modules/corridas/index.html','modules/entregas/index.html'];
export function verifyClientBundleAssets(root='superapp/shell/dist'){
 return verifyMobileBundleAssets(root,entries,'Cliente');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 verifyClientBundleAssets(process.argv[2]);
}
