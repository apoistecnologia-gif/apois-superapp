// APOIS Corridas — segurança de configuração pré-build.
// Não lê nem imprime credenciais de usuário; a chave pública deve vir do ambiente atual.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CORRIDAS_URL = "https://tbbzkrfupmqdywnzgnms.supabase.co";

export function checkCorridasBuildEnv(url, key, legacyKey = "") {
  if ((url || "").trim().replace(/\/$/, "") !== CORRIDAS_URL) {
    throw new Error("[FAIL] Corridas: CORRIDAS_VITE_SUPABASE_URL não aponta para o projeto canônico tbbzkrfupmqdywnzgnms");
  }
  if (!key || typeof key !== "string") {
    throw new Error("[FAIL] Corridas: publishable key ausente");
  }
  const candidate = key.trim();
  if (candidate.startsWith("sb_secret_") || candidate.startsWith("sb_service_")) {
    throw new Error("[FAIL] Corridas: credencial secreta não pode ser usada no bundle");
  }
  if (legacyKey && candidate === legacyKey.trim()) {
    throw new Error("[FAIL] Corridas: chave antiga do snapshot .env.mobile; configurar publishable key ativa do projeto canônico");
  }
  if (candidate.startsWith("sb_publishable_")) {
    if (!/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(candidate)) {
      throw new Error("[FAIL] Corridas: formato da publishable key inválido");
    }
    return { format: "publishable", projectRef: "tbbzkrfupmqdywnzgnms", keyProjectVerified: false };
  }
  const jwtParts = candidate.split(".");
  if (jwtParts.length !== 3) throw new Error("[FAIL] Corridas: chave não é uma publishable key ou anon JWT válido");
  let payload;
  try {
    payload = JSON.parse(Buffer.from(jwtParts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("[FAIL] Corridas: payload da anon key inválido");
  }
  if (payload?.role !== "anon" || payload?.ref !== "tbbzkrfupmqdywnzgnms") {
    throw new Error("[FAIL] Corridas: chave JWT pertence a outro projeto ou papel não público");
  }
  // Um JWT lido via base64 NÃO teve assinatura verificada. Confirmar no servidor.
  return { format: "anon-jwt", projectRef: payload.ref, keyProjectVerified: false };
}

function verifyCLI() {
  const path = resolve("sources/apois-corridas-motorista-admin/.env.mobile");
  let old = "";
  if (existsSync(path)) {
    const text = readFileSync(path, "utf8");
    old = text.match(/^VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*(.+)$/m)?.[1]?.trim() ?? "";
  }
  const result = checkCorridasBuildEnv(
    process.env.CORRIDAS_VITE_SUPABASE_URL,
    process.env.CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY,
    old,
  );
  // Chaves modernas são opacas: sem consultar Supabase Auth não é possível provar
  // por análise local que correspondem ao projeto. Não declarar "pareamento validado".
  if (!result.keyProjectVerified) {
    console.warn("[WARN] Corridas: chave pública opaca com formato válido; pareamento deve ser confirmado em homologação por autenticação real");
  }
  console.log("[OK] Corridas: URL canônica e credencial de navegador sem chave histórica/secreta");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyCLI();
}
