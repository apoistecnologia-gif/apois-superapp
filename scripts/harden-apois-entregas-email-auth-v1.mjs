import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const workspace=resolve(process.env.APOIS_AUTH_ENTREGAS_WORKSPACE || process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas');
const nativeScheme=process.env.APOIS_AUTH_ENTREGAS_SCHEME || (workspace.includes('partner-entregador')?'br.com.apois.parceiro':'br.com.apois.app');
function edit(path,transform){const full=resolve(workspace,path);const before=readFileSync(full,'utf8');const after=transform(before);if(after===before)throw Error('[FAIL] autenticação: nada alterado em '+path);writeFileSync(full,after,'utf8');}
edit('src/routes/login.tsx',s=>{
  if(!s.includes('import { Capacitor } from "@capacitor/core";'))s='import { Capacitor } from "@capacitor/core";\n'+s;
  const candidates=[
    'redirectTo: `${window.location.origin}/redefinir-senha`,',
    'redirectTo: "br.com.apois.app://auth/reset",',
    'redirectTo: "br.com.apois.parceiro://auth/reset",'
  ];
  const matches=candidates.filter(x=>s.includes(x));
  if(matches.length!==1)throw Error('[FAIL] recuperação Entregas: redirectTo incompatível ou ambíguo');
  return s.replace(matches[0],'redirectTo: Capacitor.isNativePlatform() ? "'+nativeScheme+'://auth/reset" : new URL("/redefinir-senha", window.location.origin).toString(),');
});
edit('src/routes/register.tsx',s=>{
  if(!s.includes('import { Capacitor } from "@capacitor/core";'))s='import { Capacitor } from "@capacitor/core";\n'+s;
  const old='emailRedirectTo: `${window.location.origin}/auth/callback`,';
  if(!s.includes(old))throw Error('[FAIL] signup Entregas: endereço não localizado');
  s=s.replace(old,'emailRedirectTo: (Capacitor.isNativePlatform()) ? "'+nativeScheme+'://auth/callback" : new URL("/auth/callback", window.location.origin).toString(),');
  const oldNotice='toast.success("Conta criada. Faça login para continuar.");';
  if(s.includes(oldNotice))s=s.replace(oldNotice,'toast.success("Confira seu e-mail para confirmar a conta antes de entrar.");');
  return s;
});
console.log('[OK] Entregas: callbacks signup/recovery explícitos e aviso de confirmação (cliente/parceiro).');
