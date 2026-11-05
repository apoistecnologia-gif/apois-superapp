import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const app=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
const settings=readFileSync(resolve(root,"src/routes/motorista.configuracoes.tsx"),"utf8");
const disabledChat=app.split('label="Chat indisponível"\n              disabled').length-1;
assert.ok(disabledChat===0||disabledChat===2,"Mock ride chat actions must be removed upstream or explicitly disabled");
assert.ok(!app.includes('toast.info("Chat em breve")'),"No active-looking fake chat button");
assert.ok(!app.includes('label="Chat"\n              onClick='),"No fake executable chat button");
for(const x of ['title="Sessões ativas" hint="Em breve"','title="Autenticação biométrica" hint="Em breve"','title="Bloqueio por PIN" hint="Em breve"']){
  assert.ok(!settings.includes(x),"No fake security button "+x);
}
for(const x of ['title="Segurança e emergência"','Sair de todos os dispositivos','title="Central de notificações"']){
  assert.ok(settings.includes(x),"Real adjacent feature preserved: "+x);
}
assert.ok(app.includes('onStart={')||app.includes('onStart='),"Ride start still wired");
console.log("[PASS] Driver unavailable chat/security controls cannot look active.");
