import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/routes/_public.login.tsx');
let source = readFileSync(path, 'utf8');

const oldBlock = `      if (error) {
        console.error("[Login] signIn failed", {
          name: error.name,
          status: error.status,
          code: (error as { code?: string }).code,
          message: error.message,
        });
        toast.error(friendlyLoginError(error.message));
        return;
      }`;

const newBlock = `      if (error) {
        const errorCode = (error as { code?: string }).code;
        console.error("[Login] signIn failed", {
          name: error.name,
          status: error.status,
          code: errorCode,
          message: error.message,
        });
        const invalidCredentials =
          error.status === 400 ||
          error.status === 401 ||
          errorCode === "invalid_credentials" ||
          error.message.toLowerCase().includes("invalid login credentials");
        toast.error(invalidCredentials ? "E-mail ou senha incorretos." : friendlyLoginError(error.message));
        return;
      }`;

const currentBlock = `      if (error) {
        const { data: existing } = await supabase.auth.getSession();
        if (existing.session?.user) {
          window.location.replace("./index.html#/inicio");
          return;
        }
        console.error("[Login] signIn failed", {
          name: error.name,
          status: error.status,
          code: (error as { code?: string }).code,
          message: error.message,
        });
        toast.error(friendlyLoginError(error.message));
        return;
      }`;

const currentReplacement = newBlock.replace(
  '      if (error) {',
  `      if (error) {
        const { data: existing } = await supabase.auth.getSession();
        if (existing.session?.user) {
          window.location.replace("./index.html#/inicio");
          return;
        }`,
);

if (source.includes(currentBlock)) {
  source = source.replace(currentBlock, currentReplacement);
  writeFileSync(path, source, 'utf8');
} else if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
  writeFileSync(path, source, 'utf8');
}

if (!source.includes('invalidCredentials ? "E-mail ou senha incorretos."')) {
  throw new Error('[FAIL] corridas: feedback de credenciais inválidas não foi endurecido');
}

console.log('[OK] corridas: HTTP 400/401 de login exibe credenciais inválidas em vez de erro genérico');
