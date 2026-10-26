import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const base=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||'.work/partner-entregador');
for (const route of ['login','register']) {
 const path=resolve(base,'src/routes/'+route+'.tsx');let s=readFileSync(path,'utf8');
 if(s.includes('APOIS_COURIER_AUTH_BACK_V2'))continue;
 if(!s.includes('useState } from "react"'))throw Error('[FAIL] React import '+route);
 s=s.replace('useState } from "react"','useEffect, useState } from "react"');
 s='import { App as CapacitorApp } from "@capacitor/app";\nimport { Capacitor } from "@capacitor/core";\n'+s;
 const anchor='  const navigate = useNavigate();';
 if(!s.includes(anchor))throw Error('[FAIL] navigate '+route);
 const effect='\n  // APOIS_COURIER_AUTH_BACK_V2: botão/gesto físico do Android no login/cadastro.\n  useEffect(() => {\n    if (!Capacitor.isNativePlatform()) return;\n    let disposed=false;\n    let listener: {remove:()=>Promise<void>} | null=null;\n    void CapacitorApp.addListener("backButton", () => {\n      if (!disposed) window.location.replace("../../index.html");\n    }).then(handle => { if(disposed) void handle.remove(); else listener=handle; });\n    return () => { disposed=true; void listener?.remove(); };\n  }, []);\n';
 s=s.replace(anchor,anchor+effect);
 s=s.replaceAll('onClick={() => navigate({ to: "/" })}','onClick={() => window.location.replace("../../index.html")}');
 if(!s.includes('APOIS_COURIER_AUTH_BACK_V2'))throw Error('[FAIL] back '+route);
 writeFileSync(path,s,'utf8');
}
console.log('[OK] Entregador: login/cadastro respondem à seta, back Android e gesto.');
