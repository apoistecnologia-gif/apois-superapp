import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || ".work/motorista";
const path = resolve(workspace, "src/routes/motorista.corridas.tsx");
if (!existsSync(path)) throw Error("[FAIL] Histórico Motorista: rota não encontrada: " + path);
const original = readFileSync(path, "utf8");
const marker = "APOIS_MOTORISTA_HISTORICO_ASYNC_RECOVERY_V1";
const start = '  const [query, setQuery] = useState("");';
const startNew = [
  "  // APOIS_MOTORISTA_HISTORICO_ASYNC_RECOVERY_V1",
  '  const [retryNonce, setRetryNonce] = useState(0);',
].join("\n");
const end = '    })();\n    return () => {\n      active = false;\n    };\n  }, []);';
const endNew = [
  '    })().catch((cause) => {',
  '      if (!active) return;',
  '      console.error("[APOIS Motorista] histórico: falha inesperada", cause);',
  '      setError("Não foi possível carregar o histórico. Verifique sua conexão e tente novamente.");',
  '      setRides([]);',
  '    });',
  '    return () => {',
  '      active = false;',
  '    };',
  '  }, [retryNonce]);',
].join("\n");
const errorCard = [
  '          {error && (',
  '            <DSCard className="min-w-0 p-3" role="alert">',
  '              <Body className="break-words text-destructive">{error}</Body>',
  '            </DSCard>',
  '          )}',
].join("\n");
const errorCardNew = [
  '          {error && (',
  '            <DSCard className="min-w-0 space-y-2 p-3" role="alert">',
  '              <Body className="break-words text-destructive">{error}</Body>',
  '              <DSButton',
  '                type="button"',
  '                variant="outline"',
  '                className="min-h-11"',
  '                onClick={() => {',
  '                  setError(null);',
  '                  setRides(null);',
  '                  setRetryNonce((n) => n + 1);',
  '                }}',
  '              >',
  '                Tentar novamente',
  '              </DSButton>',
  '            </DSCard>',
  '          )}',
].join("\n");
function replaceOnce(s, before, after, label) {
  const n = s.split(before).length - 1;
  if (n !== 1) throw Error("[FAIL] Histórico Motorista: " + label + " (esperado 1, encontrado " + n + ")");
  return s.replace(before, after);
}
if (original.includes(marker)) {
  for (const check of [").catch((cause) => {", "[retryNonce]", "Tentar novamente"]) {
    if (!original.includes(check)) throw Error("[FAIL] Histórico Motorista: patch parcial");
  }
  console.log("[OK] Histórico Motorista: recuperação de falhas já existente");
} else {
  let patched = replaceOnce(original, start, start + "\n" + startNew, "estado de retry");
  patched = replaceOnce(patched, end, endNew, "promessa assíncrona");
  patched = replaceOnce(patched, errorCard, errorCardNew, "cartão de erro");
  writeFileSync(path, patched, "utf8");
  console.log("[OK] Histórico Motorista: exceção assíncrona capturada e botão de retry criado");
}
