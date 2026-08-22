import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const javaRoot = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro');
const targets = [
  { file: 'DriverLocationPlugin.java', label: 'Motorista', failure: 'O serviço de localização do motorista não confirmou a inicialização.' },
  { file: 'CourierLocationPlugin.java', label: 'Entregador', failure: 'O serviço de localização do entregador não confirmou a inicialização.' },
];

for (const target of targets) {
  const path = resolve(javaRoot, target.file);
  if (!existsSync(path)) throw new Error(`APOIS Parceiro: ${target.file} ausente para retry do startup ACK.`);
  let source = readFileSync(path, 'utf8');

  if (!source.includes('STARTUP_ACK_MAX_ATTEMPTS = 4')) {
    const constant = '    private static final long STARTUP_ACK_DELAY_MS = 900L;';
    if (!source.includes(constant)) throw new Error(`APOIS Parceiro: ${target.label} sem delay do startup ACK.`);
    source = source.replace(constant, `${constant}\n    private static final int STARTUP_ACK_MAX_ATTEMPTS = 4;`);
  }

  const oldBlock = `        new Handler(Looper.getMainLooper()).postDelayed(() -> {\n            boolean started = startup.getBoolean(STARTUP_KEY, false);\n            if (!started) {\n                call.reject("${target.failure}");\n                return;\n            }\n            JSObject result = new JSObject();\n            result.put("started", true);\n            call.resolve(result);\n        }, STARTUP_ACK_DELAY_MS);`;

  if (source.includes(oldBlock)) {
    source = source.replace(oldBlock, '        resolveStartup(call, startup, 1);');
  }

  if (!source.includes('private void resolveStartup(PluginCall call, SharedPreferences startup, int attempt)')) {
    const stopAnchor = `    @PluginMethod\n    public void stop(PluginCall call) {`;
    if (!source.includes(stopAnchor)) throw new Error(`APOIS Parceiro: stop de ${target.label} não encontrado para inserir retry ACK.`);
    const helper = `    private void resolveStartup(PluginCall call, SharedPreferences startup, int attempt) {\n        if (startup.getBoolean(STARTUP_KEY, false)) {\n            JSObject result = new JSObject();\n            result.put("started", true);\n            call.resolve(result);\n            return;\n        }\n        if (attempt >= STARTUP_ACK_MAX_ATTEMPTS) {\n            call.reject("${target.failure}");\n            return;\n        }\n        new Handler(Looper.getMainLooper()).postDelayed(\n            () -> resolveStartup(call, startup, attempt + 1),\n            STARTUP_ACK_DELAY_MS\n        );\n    }\n\n`;
    source = source.replace(stopAnchor, `${helper}${stopAnchor}`);
  }

  for (const marker of [
    'STARTUP_ACK_MAX_ATTEMPTS = 4',
    'resolveStartup(call, startup, 1);',
    'private void resolveStartup(PluginCall call, SharedPreferences startup, int attempt)',
    'attempt >= STARTUP_ACK_MAX_ATTEMPTS',
    '() -> resolveStartup(call, startup, attempt + 1)',
  ]) {
    if (!source.includes(marker)) throw new Error(`APOIS Parceiro: retry do startup ACK incompleto em ${target.label} (${marker}).`);
  }
  if (source.includes('new Handler(Looper.getMainLooper()).postDelayed(() -> {\n            boolean started = startup.getBoolean')) {
    throw new Error(`APOIS Parceiro: ${target.label} ainda usa verificação única de 900 ms para startup.`);
  }

  writeFileSync(path, source, 'utf8');
}

console.log('[OK] APOIS Parceiro: startup do GPS nativo tolera aparelhos lentos com até quatro verificações antes de falhar fechado.');
