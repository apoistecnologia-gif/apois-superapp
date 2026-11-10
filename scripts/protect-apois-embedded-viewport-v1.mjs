// APOIS_EMBEDDED_VIEWPORT_GUARD_V1 — apply to built HTML only, never pinned sources.
// Keep page and list scrolling working; stop over-pull from chaining into the
// WebView document or moving status/navigation chrome at the edge of a scroll.
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const MARKER='data-apois-embedded-viewport-v1';
const STYLE='<style '+MARKER+'>html,body{overscroll-behavior-y:none;overscroll-behavior-x:none}html{-webkit-text-size-adjust:100%}</style>';
export function protectEmbeddedViewport(dist,modules){
  let total=0;
  for(const entry of ['index.html',...modules.map(x=>'modules/'+x+'/index.html')]){
    const path=resolve(dist,entry);
    if(!existsSync(path))throw Error('[FAIL] Embedded viewport missing '+path);
    let html=readFileSync(path,'utf8');
    if(!/<\/head>/i.test(html))throw Error('[FAIL] Embedded viewport HTML head missing '+entry);
    if(!html.includes(MARKER)){
      html=html.replace(/<\/head>/i,STYLE+'\n</head>');
      writeFileSync(path,html,'utf8');
    }
    if(html.split(MARKER).length!==2 || !html.includes(STYLE))
      throw Error('[FAIL] Embedded viewport guard incomplete '+entry);
    total++;
  }
  console.log('[OK] '+total+' APK HTML entries: native-safe overscroll boundary without disabling nested scrolling');
}
