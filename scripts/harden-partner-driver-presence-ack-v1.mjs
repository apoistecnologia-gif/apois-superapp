// APOIS_DRIVER_PRESENCE_ACK_V1 — server-confirmed driver availability.
// Changes only the generated Motorista workspace; no production mutations.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const hookPath = resolve(root, "src/hooks/useDriverBroadcast.ts");
const appPath = resolve(root, "src/routes/motorista.app.tsx");
let hook = readFileSync(hookPath, "utf8");
let app = readFileSync(appPath, "utf8");

function once(src, oldText, newText, label) {
  const count = src.split(oldText).length - 1;
  if (count !== 1) throw Error("[FAIL] Presence ACK: " + label + " (" + count + ")");
  return src.replace(oldText, newText);
}

if (!hook.includes("APOIS_DRIVER_PRESENCE_ACK_V1")) {
  // A rotina anterior ja transforma a RPC em booleano (true/false) para preservar
  // a trava operacional do shell. Nao remover esse contrato.
  hook = once(hook,
    '        await setPresence(desiredOnline, desiredPosition);',
    '        const presenceConfirmed = await setPresence(desiredOnline, desiredPosition);\n' +
    '        if (desiredOnline && !presenceConfirmed) throw new Error("presence_rejected_by_server");',
    "honor existing boolean RPC result");
  const end = '      });\n  };\n\n  useEffect(() => {\n    positionRef.current = position;';
  const after = [
    '      }).catch((error) => {',
    '        // APOIS_DRIVER_PRESENCE_ACK_V1: only notify the latest ONLINE lifecycle.',
    '        if (desiredOnline && presenceLifecycleVersionRef.current === lifecycleVersion) {',
    '          const message = error instanceof Error ? error.message : "presence_update_failed";',
    '          window.dispatchEvent(new CustomEvent("apois:driver-presence-rejected", { detail: { message } }));',
    '        }',
    '      });',
    '  };',
    '',
    '  useEffect(() => {',
    '    positionRef.current = position;',
  ].join("\n");
  hook = once(hook, end, after, "queue catch and event");
}

if (!app.includes("APOIS_DRIVER_PRESENCE_ACK_V1")) {
  const anchor = "  // realtime: ofertas (broadcast) + corrida ativa — canal estável";
  const effect = [
    '  // APOIS_DRIVER_PRESENCE_ACK_V1: no phantom ONLINE after server rejects presence.',
    '  useEffect(() => {',
    '    if (!online) return;',
    '    const handlePresenceRejection = (event: Event) => {',
    '      const message = String((event as CustomEvent<{ message?: string }>).detail?.message ?? "");',
    '      stopDriverWatch();',
    '      setDesiredOnline(false);',
    '      setGpsStatus("error");',
    '      setGpsMessage(',
    '        /driver_kyc_incomplete/i.test(message) ? "Cadastro ou documentos incompletos. Confira seu perfil antes de ficar online." :',
    '        /driver_subscription_inactive/i.test(message) ? "Sua mensalidade não permite ficar online. Confira sua assinatura." :',
    '        /driver_not_approved|driver_not_eligible|driver_suspended/i.test(message) ? "Seu cadastro não está liberado para receber corridas." :',
    '        "Não foi possível confirmar o status ONLINE com o servidor. Verifique sua conexão e tente novamente."',
    '      );',
    '    };',
    '    window.addEventListener("apois:driver-presence-rejected", handlePresenceRejection);',
    '    return () => window.removeEventListener("apois:driver-presence-rejected", handlePresenceRejection);',
    '  }, [online, stopDriverWatch, setDesiredOnline]);',
    '',
    anchor,
  ].join("\n");
  app = once(app, anchor, effect, "route effect anchor");
}
for(const marker of [
  "APOIS_DRIVER_PRESENCE_ACK_V1",
  'new CustomEvent("apois:driver-presence-rejected"',
]) if(!hook.includes(marker))throw Error("[FAIL] Hook missing "+marker);
for(const marker of [
  "APOIS_DRIVER_PRESENCE_ACK_V1",
  'window.addEventListener("apois:driver-presence-rejected", handlePresenceRejection)',
  "stopDriverWatch();",
  "setDesiredOnline(false);",
]) if(!app.includes(marker))throw Error("[FAIL] App missing "+marker);

writeFileSync(hookPath, hook, "utf8");
writeFileSync(appPath, app, "utf8");
console.log("[OK] APOIS Motorista: presence failure is propagated to UI; driver returns offline on rejected server status.");
