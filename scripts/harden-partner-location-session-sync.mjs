import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const javaRoot = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro');

function patchRuntime({ pluginFile, serviceFile, roleKey, className, syncMethod, label }) {
  const pluginPath = resolve(javaRoot, pluginFile);
  const servicePath = resolve(javaRoot, serviceFile);
  if (!existsSync(pluginPath) || !existsSync(servicePath)) {
    throw new Error(`APOIS Parceiro: runtime ${label} ausente para sincronizar sessão nativa.`);
  }

  let plugin = readFileSync(pluginPath, 'utf8');
  let service = readFileSync(servicePath, 'utf8');
  const accessKey = `${roleKey}_access_token`;
  const refreshKey = `${roleKey}_refresh_token`;

  if (!plugin.includes('SESSION_PREFS = "apois_partner_location_session"')) {
    const startupConstant = /    private static final long STARTUP_ACK_DELAY_MS = \d+L;/;
    if (!startupConstant.test(plugin)) throw new Error(`APOIS Parceiro: ${label} sem startup ACK antes da coordenação de sessão.`);
    plugin = plugin.replace(
      startupConstant,
      (value) => `${value}\n    private static final String SESSION_PREFS = "apois_partner_location_session";\n    private static final String SESSION_ACCESS_KEY = "${accessKey}";\n    private static final String SESSION_REFRESH_KEY = "${refreshKey}";`,
    );
  }

  const intentAnchor = `        Intent intent = new Intent(getContext(), ${className}Service.class);`;
  if (!plugin.includes('SESSION_ACCESS_KEY') || !plugin.includes(`"${accessKey}"`)) {
    throw new Error(`APOIS Parceiro: constantes de sessão ${label} não foram instaladas.`);
  }
  if (!plugin.includes('putString(SESSION_ACCESS_KEY, accessToken)')) {
    if (!plugin.includes(intentAnchor)) throw new Error(`APOIS Parceiro: start de ${label} não encontrado para persistir sessão.`);
    plugin = plugin.replace(
      intentAnchor,
      `        getContext().getSharedPreferences(SESSION_PREFS, android.content.Context.MODE_PRIVATE)\n            .edit()\n            .putString(SESSION_ACCESS_KEY, accessToken)\n            .putString(SESSION_REFRESH_KEY, refreshToken)\n            .commit();\n${intentAnchor}`,
    );
  }

  const stopAnchor = `    @PluginMethod\n    public void stop(PluginCall call) {`;
  if (!plugin.includes('public void session(PluginCall call)')) {
    if (!plugin.includes(stopAnchor)) throw new Error(`APOIS Parceiro: stop de ${label} não encontrado para expor sessão nativa.`);
    const method = `    @PluginMethod\n    public void session(PluginCall call) {\n        SharedPreferences prefs = getContext().getSharedPreferences(SESSION_PREFS, android.content.Context.MODE_PRIVATE);\n        JSObject result = new JSObject();\n        result.put("accessToken", prefs.getString(SESSION_ACCESS_KEY, ""));\n        result.put("refreshToken", prefs.getString(SESSION_REFRESH_KEY, ""));\n        call.resolve(result);\n    }\n\n`;
    plugin = plugin.replace(stopAnchor, `${method}${stopAnchor}`);
  }

  if (!plugin.includes('public void updateSession(PluginCall call)')) {
    if (!plugin.includes(stopAnchor)) throw new Error(`APOIS Parceiro: stop de ${label} não encontrado para inserir updateSession.`);
    const method = `    @PluginMethod\n    public void updateSession(PluginCall call) {\n        String accessToken = call.getString("accessToken", "");\n        String refreshToken = call.getString("refreshToken", "");\n        if (accessToken.isEmpty() || refreshToken.isEmpty()) {\n            call.reject("Sessão inválida para atualizar o serviço de localização.");\n            return;\n        }\n        getContext().getSharedPreferences(SESSION_PREFS, android.content.Context.MODE_PRIVATE)\n            .edit()\n            .putString(SESSION_ACCESS_KEY, accessToken)\n            .putString(SESSION_REFRESH_KEY, refreshToken)\n            .commit();\n        JSObject result = new JSObject();\n        result.put("updated", true);\n        call.resolve(result);\n    }\n\n`;
    plugin = plugin.replace(stopAnchor, `${method}${stopAnchor}`);
  }

  if (!plugin.includes('remove(SESSION_ACCESS_KEY)')) {
    const stopIntentAnchor = `        Intent intent = new Intent(getContext(), ${className}Service.class);\n        intent.setAction(${className}Service.ACTION_STOP);`;
    if (!plugin.includes(stopIntentAnchor)) throw new Error(`APOIS Parceiro: stop de ${label} não encontrado para limpar sessão nativa.`);
    plugin = plugin.replace(
      stopIntentAnchor,
      `        getContext().getSharedPreferences(SESSION_PREFS, android.content.Context.MODE_PRIVATE)\n            .edit()\n            .remove(SESSION_ACCESS_KEY)\n            .remove(SESSION_REFRESH_KEY)\n            .commit();\n${stopIntentAnchor}`,
    );
  }

  if (!service.includes('SESSION_PREFS = "apois_partner_location_session"')) {
    const startupKey = `    private static final String STARTUP_KEY = "${roleKey}_running";`;
    if (!service.includes(startupKey)) throw new Error(`APOIS Parceiro: ${label}Service sem startup key para instalar sessão.`);
    service = service.replace(
      startupKey,
      `${startupKey}\n    private static final String SESSION_PREFS = "apois_partner_location_session";\n    private static final String SESSION_ACCESS_KEY = "${accessKey}";\n    private static final String SESSION_REFRESH_KEY = "${refreshKey}";`,
    );
  }

  const refreshMethodAnchor = '    private boolean refreshSession() {';
  if (!service.includes('private void persistSessionTokens()')) {
    if (!service.includes(refreshMethodAnchor)) throw new Error(`APOIS Parceiro: refreshSession de ${label} não encontrado.`);
    const helper = `    private void persistSessionTokens() {\n        if (accessToken == null || accessToken.isEmpty()) return;\n        getSharedPreferences(SESSION_PREFS, MODE_PRIVATE)\n            .edit()\n            .putString(SESSION_ACCESS_KEY, accessToken)\n            .putString(SESSION_REFRESH_KEY, refreshToken == null ? "" : refreshToken)\n            .commit();\n    }\n\n    private void loadPersistedSessionTokens() {\n        SharedPreferences prefs = getSharedPreferences(SESSION_PREFS, MODE_PRIVATE);\n        String storedAccess = prefs.getString(SESSION_ACCESS_KEY, "");\n        String storedRefresh = prefs.getString(SESSION_REFRESH_KEY, "");\n        if (storedAccess != null && !storedAccess.isEmpty()) accessToken = storedAccess;\n        if (storedRefresh != null && !storedRefresh.isEmpty()) refreshToken = storedRefresh;\n    }\n\n`;
    service = service.replace(refreshMethodAnchor, `${helper}${refreshMethodAnchor}`);
  } else if (!service.includes('private void loadPersistedSessionTokens()')) {
    const helperAnchor = '    private boolean refreshSession() {';
    if (!service.includes(helperAnchor)) throw new Error(`APOIS Parceiro: refreshSession de ${label} não encontrado para leitura persistida.`);
    const helper = `    private void loadPersistedSessionTokens() {\n        SharedPreferences prefs = getSharedPreferences(SESSION_PREFS, MODE_PRIVATE);\n        String storedAccess = prefs.getString(SESSION_ACCESS_KEY, "");\n        String storedRefresh = prefs.getString(SESSION_REFRESH_KEY, "");\n        if (storedAccess != null && !storedAccess.isEmpty()) accessToken = storedAccess;\n        if (storedRefresh != null && !storedRefresh.isEmpty()) refreshToken = storedRefresh;\n    }\n\n`;
    service = service.replace(helperAnchor, `${helper}${helperAnchor}`);
  }

  const startTokenAnchor = `        refreshToken = safe(intent.getStringExtra(EXTRA_REFRESH_TOKEN));`;
  if (!service.includes('refreshToken = safe(intent.getStringExtra(EXTRA_REFRESH_TOKEN));\n        persistSessionTokens();')) {
    if (!service.includes(startTokenAnchor)) throw new Error(`APOIS Parceiro: leitura de sessão no start de ${label} não encontrada.`);
    service = service.replace(startTokenAnchor, `${startTokenAnchor}\n        persistSessionTokens();`);
  }

  const syncAnchor = `    private boolean ${syncMethod}(`;
  const syncIndex = service.indexOf(syncAnchor);
  if (syncIndex < 0) throw new Error(`APOIS Parceiro: método ${syncMethod} de ${label} não encontrado.`);
  const bodyStart = service.indexOf('{', syncIndex);
  if (bodyStart < 0) throw new Error(`APOIS Parceiro: corpo de ${syncMethod} de ${label} não encontrado.`);
  const bodyPreview = service.slice(bodyStart, bodyStart + 220);
  if (!bodyPreview.includes('loadPersistedSessionTokens();')) {
    service = service.slice(0, bodyStart + 1) + '\n        loadPersistedSessionTokens();' + service.slice(bodyStart + 1);
  }

  const refreshAnchor = `            accessToken = nextAccess;\n            if (!nextRefresh.isEmpty()) refreshToken = nextRefresh;\n            return true;`;
  if (!service.includes('if (!nextRefresh.isEmpty()) refreshToken = nextRefresh;\n            persistSessionTokens();\n            return true;')) {
    if (!service.includes(refreshAnchor)) throw new Error(`APOIS Parceiro: atualização de tokens de ${label} não encontrada.`);
    service = service.replace(
      refreshAnchor,
      `            accessToken = nextAccess;\n            if (!nextRefresh.isEmpty()) refreshToken = nextRefresh;\n            persistSessionTokens();\n            return true;`,
    );
  }

  for (const marker of [
    'SESSION_PREFS = "apois_partner_location_session"',
    `SESSION_ACCESS_KEY = "${accessKey}"`,
    `SESSION_REFRESH_KEY = "${refreshKey}"`,
    'public void session(PluginCall call)',
    'public void updateSession(PluginCall call)',
    'result.put("updated", true)',
    'remove(SESSION_ACCESS_KEY)',
    'remove(SESSION_REFRESH_KEY)',
  ]) {
    if (!plugin.includes(marker)) throw new Error(`APOIS Parceiro: plugin ${label} sem coordenação/higiene de sessão (${marker}).`);
  }
  for (const marker of [
    'private void persistSessionTokens()',
    'private void loadPersistedSessionTokens()',
    'loadPersistedSessionTokens();',
    'persistSessionTokens();',
    `SESSION_ACCESS_KEY = "${accessKey}"`,
    `SESSION_REFRESH_KEY = "${refreshKey}"`,
  ]) {
    if (!service.includes(marker)) throw new Error(`APOIS Parceiro: service ${label} sem coordenação de sessão (${marker}).`);
  }

  writeFileSync(pluginPath, plugin, 'utf8');
  writeFileSync(servicePath, service, 'utf8');
}

patchRuntime({
  pluginFile: 'DriverLocationPlugin.java',
  serviceFile: 'DriverLocationService.java',
  roleKey: 'driver',
  className: 'DriverLocation',
  syncMethod: 'syncPresence',
  label: 'Motorista',
});
patchRuntime({
  pluginFile: 'CourierLocationPlugin.java',
  serviceFile: 'CourierLocationService.java',
  roleKey: 'courier',
  className: 'CourierLocation',
  syncMethod: 'syncLocation',
  label: 'Entregador',
});

console.log('[OK] APOIS Parceiro: WebView atualiza tokens do GPS sem reiniciar FGS; services recarregam a sessão persistida antes das chamadas e limpam credenciais no stop.');
