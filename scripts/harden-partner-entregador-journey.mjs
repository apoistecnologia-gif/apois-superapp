import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

if (!source.includes('import { Geolocation } from "@capacitor/geolocation";')) {
  const anchor = 'import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";';
  if (!source.includes(anchor)) throw new Error('Entregador Parceiro: import principal de courier.tsx não encontrado.');
  source = source.replace(anchor, `${anchor}\nimport { Geolocation } from "@capacitor/geolocation";`);
}

const rpcAnchor = `const rpc = (name: string, args?: Record<string, unknown>) =>\n  (supabase.rpc as any)(name, args ?? {});`;
const readableErrorHelper = `${rpcAnchor}\n\nconst courierReadableError = (error: unknown, fallback: string) => {\n  const raw = String((error as { message?: string } | null)?.message ?? "").trim();\n  const normalized = raw.toLowerCase();\n  const known: Array<[string, string]> = [\n    ["active courier push registration required", "Ative as notificações para ficar online e receber novas entregas."],\n    ["fresh accurate courier location required", "A localização ainda não está precisa o suficiente. Vá para uma área aberta, aguarde o GPS estabilizar e tente novamente."],\n    ["courier is not allowed to go online", "Seu cadastro de entregador precisa estar aprovado e ativo para ficar online."],\n    ["courier profile not found", "Não encontramos seu cadastro de entregador nesta conta."],\n    ["courier must be online", "Fique online antes de aceitar uma entrega."],\n    ["offer is no longer available", "Esta chamada expirou ou já foi aceita por outro entregador."],\n    ["offer not found", "Esta chamada não está mais disponível."],\n    ["delivery already assigned", "Esta entrega já foi atribuída a outro entregador."],\n    ["courier already has active delivery", "Conclua sua entrega atual antes de aceitar outra."],\n    ["active delivery must be completed before going offline", "Conclua a entrega atual antes de ficar offline."],\n    ["delivery job not assigned to courier", "Esta entrega não está mais vinculada à sua conta. Atualize a tela."],\n    ["courier must arrive at destination first", "Marque primeiro que chegou ao destino para confirmar a entrega."],\n    ["invalid delivery transition", "A etapa da entrega mudou. Atualize a tela antes de continuar."],\n    ["delivery confirmation secret not found", "O PIN desta entrega ainda não está disponível. Atualize a tela ou acione o suporte."],\n    ["delivery coordinates required", "O endereço do cliente está incompleto. Não aceite esta entrega e acione o suporte."],\n  ];\n  const match = known.find(([needle]) => normalized.includes(needle));\n  return match?.[1] ?? (raw && !/^edge function/i.test(raw) ? raw : fallback);\n};`;
if (!source.includes('const courierReadableError =')) {
  if (!source.includes(rpcAnchor)) throw new Error('Entregador Parceiro: helper RPC não encontrado.');
  source = source.replace(rpcAnchor, readableErrorHelper);
}

const webBlockStartMarker = '        if (!navigator.geolocation) {';
const webBlockEndMarker = 'recordedAt: Date.now(),\n        };';
const webBlockStart = source.indexOf(webBlockStartMarker);
if (webBlockStart < 0 && !source.includes('isNativeCourierAndroid()) {\n          let permission = await Geolocation.checkPermissions();')) {
  throw new Error('Entregador Parceiro: bloco de geolocalização web (toggle online) não encontrado.');
}
if (webBlockStart >= 0) {
  const webBlockEndRel = source.indexOf(webBlockEndMarker, webBlockStart);
  if (webBlockEndRel < 0) throw new Error('Entregador Parceiro: fim do bloco de geolocalização web não encontrado.');
  const webBlockEnd = webBlockEndRel + webBlockEndMarker.length;
  const originalWebBlock = source.slice(webBlockStart, webBlockEnd);
  // Preserva o bloco web original (com o mapeamento de erros por geoError.code) tal como está,
  // apenas trocando a leitura final de `position.coords.*` para uma variável `coords`
  // compartilhada com o novo caminho nativo Capacitor.
  const webBlockAsElse = originalWebBlock
    .replace(
      'const position = await new Promise<GeolocationPosition>((resolve, reject) =>',
      'const webPosition = await new Promise<GeolocationPosition>((resolve, reject) =>',
    )
    .replace(
      /const initialPosition: CourierPosition = \{\n          lat: position\.coords\.latitude,[\s\S]*$/,
      'coords = webPosition.coords;',
    );
  if (webBlockAsElse.includes('position.coords')) {
    throw new Error('Entregador Parceiro: não foi possível isolar a leitura final de coords do bloco web original.');
  }

  // Idempotente: se o bloco nativo já existe, não inserimos outro. Sem isto, o
  // pipeline reaplicado prependia uma cópia do bloco a cada execução.
  const alreadyPatched = source.includes('coords = nativePosition.coords;');
  const newBlock = `        let coords: {
          latitude: number;
          longitude: number;
          accuracy: number;
          heading?: number | null;
          speed?: number | null;
        };

        if (isNativeCourierAndroid()) {
          let permission = await Geolocation.checkPermissions();
          if (permission.location !== "granted") {
            permission = await Geolocation.requestPermissions({
              permissions: ["location", "coarseLocation"],
            });
          }
          if (permission.location !== "granted") {
            throw new Error("Permita a localização para ficar online e receber entregas próximas.");
          }
          const nativePosition = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 20_000,
            maximumAge: 0,
          });
          coords = nativePosition.coords;
        } else {
${webBlockAsElse}
        }

        const initialPosition: CourierPosition = {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
          heading:
            coords.heading !== null && coords.heading !== undefined && Number.isFinite(coords.heading)
              ? coords.heading
              : null,
          speed:
            coords.speed !== null && coords.speed !== undefined && Number.isFinite(coords.speed)
              ? coords.speed
              : null,
          recordedAt: Date.now(),
        };`;

  // Só reescreve o bloco quando o caminho nativo ainda não está presente.
  // Reaplicar prependia uma cópia do bloco a cada execução do pipeline.
  if (!alreadyPatched) {
    source = source.slice(0, webBlockStart) + newBlock + source.slice(webBlockEnd);
  } else {
    console.log('[OK] Entregador Parceiro: bloco nativo de GPS já presente (jornada idempotente)');
  }
}

const replacements = [
  ['toast.error(error?.message || "Não foi possível atualizar sua disponibilidade.");', 'toast.error(courierReadableError(error, "Não foi possível atualizar sua disponibilidade."));'],
  ['if (error) return toast.error(error.message || "Esta entrega não está mais disponível.");', 'if (error) return toast.error(courierReadableError(error, "Esta entrega não está mais disponível."));'],
  ['if (error) return toast.error(error.message);\n    await loadCourierOperations(courier.id);', 'if (error) return toast.error(courierReadableError(error, "Não foi possível recusar esta chamada."));\n    await loadCourierOperations(courier.id);'],
  ['if (error) return toast.error(error.message || "Não foi possível atualizar a entrega.");', 'if (error) return toast.error(courierReadableError(error, "Não foi possível atualizar a entrega."));'],
  ['if (error) return toast.error(error.message || "Não foi possível concluir a entrega.");', 'if (error) return toast.error(courierReadableError(error, "Não foi possível concluir a entrega."));'],
];
for (const [before, after] of replacements) {
  if (source.includes(before)) source = source.replace(before, after);
}

for (const marker of [
  'import { Geolocation } from "@capacitor/geolocation";',
  'Geolocation.checkPermissions()',
  'Geolocation.requestPermissions({',
  'Geolocation.getCurrentPosition({',
  'coords = nativePosition.coords;',
  'coords = webPosition.coords;',
  'const courierReadableError =',
  'fresh accurate courier location required',
  'Esta chamada expirou ou já foi aceita por outro entregador.',
  'Conclua a entrega atual antes de ficar offline.',
]) {
  if (!source.includes(marker)) throw new Error(`Entregador Parceiro: hardening da jornada incompleto (${marker}).`);
}

if (source.includes('const position = await new Promise<GeolocationPosition>')) {
  throw new Error('Entregador Parceiro: toggle online ainda depende exclusivamente da geolocalização WebView.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: ficar online usa GPS nativo e erros operacionais são exibidos em português acionável.');
