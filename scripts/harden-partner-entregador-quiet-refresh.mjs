import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

const oldCatch = `      } catch (error: any) {\n        const message = error?.message || "Não foi possível carregar o app do entregador.";\n        setAppError(message);\n        toast.error(message);\n      } finally {`;
const newCatch = `      } catch (error: any) {\n        const message = error?.message || "Não foi possível carregar o app do entregador.";\n        if (quiet) {\n          // Retorno do segundo plano/refresh manual não pode substituir uma\n          // entrega válida por uma tela cheia de erro por causa de uma falha\n          // transitória. Mantemos a UI atual e sinalizamos a reconciliação.\n          console.warn("courier quiet refresh failed", message);\n          setOperationsError("Não foi possível sincronizar agora. A última entrega e chamadas válidas continuam na tela.");\n          toast.error("Falha temporária ao atualizar. Seus dados anteriores foram mantidos.");\n        } else {\n          setAppError(message);\n          toast.error(message);\n        }\n      } finally {`;

if (!source.includes('courier quiet refresh failed')) {
  if (!source.includes(oldCatch)) throw new Error('Entregador Parceiro: catch de loadAll não encontrado.');
  source = source.replace(oldCatch, newCatch);
}

for (const marker of [
  'if (quiet) {',
  'courier quiet refresh failed',
  'A última entrega e chamadas válidas continuam na tela.',
  'Falha temporária ao atualizar. Seus dados anteriores foram mantidos.',
  '} else {\n          setAppError(message);',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: refresh silencioso incompleto (${marker}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: refresh de retorno preserva a tela ativa em falhas transitórias e mantém erro inicial bloqueante.');
