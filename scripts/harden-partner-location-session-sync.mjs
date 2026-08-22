import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const javaRoot = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro');

function patchRuntime({ pluginFile, serviceFile, roleKey, className, label }) {
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
    const startupConstant = `    private static final long STARTUP_ACK_DELAY_MS = 900L;`;
    if (!plugin.includes(startupConstant)) throw new Error(`APOIS Parceiro: ${label} sem startup ACK antes da coordenação de sessão.`);
    plugin = plugin.replace(
      startupConstant,
      `${startupConstant}\n    private static final String SESSION_PREFS = "apois_partner_location_session";\n    private static final String SESSION_ACCESS_KEY = "${accessKey}";\n    private static final String SESSION_REFRESH_KEY = "${refreshKey}";`,
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

  if (!plugin.includes('public void session(PluginCall call)')) {
    const stopAnchor = `    @PluginMethod\n    public void stop(PluginCall call) {`;
    if (!plugin.includes(stopAnchor)) throw new Error(`APOIS Parceiro: stop de ${label} não encontrado para expor sessão nativa.`);
    const method = `    @PluginMethod\n    public void session(PluginCall call) {\n        SharedPreferences prefs = getContext().getSharedPreferences(SESSION_PREFS, android.content.Context.MODE_PRIVATE);\n        JSObject result = new JSObject();\n        result.put("accessToken", prefs.getString(SESSION_ACCESS_KEY, ""));\n        result.put("refreshToken", prefs.getString(SESSION_REFRESH_KEY, ""));\n        call.resolve(result);\n    }\n\n`;
    plugin = plugin.replace(stopAnchor, `${method}${stopAnchor}`);
  }

  if (!service.includes('SESSION_PREFS = "apois_partner_location_session"')) {
    const startupKey = `    private static final String STARTUP_KEY = "${roleKey}_running";`;
    if (!service.includes(startupKey)) throw new Error(`APOIS Parceiro: ${label}Service sem startup key para instalar sessão.`);
    service = service.replace(
      startupKey,
      `${startupKey}\n    private static final String SESSION_PREFS = "apois_partner_location_session";\n    private static final String SESSION_ACCESS_KEY = "${accessKey}";\n    private static final String SESSION_REFRESH_KEY = "${refreshKey}";`,
    );
  }

  if (!service.includes('private void persistSessionTokens()')) {
    const refreshMethodAnchor = '    private boolean refreshSession() {';
    if (!service.includes(refreshMethodAnchor)) throw new Error(`APOIS Parceiro: refreshSession de ${label} não encontrado.`);
    const helper = `    private void persistSessionTokens() {\n        if (accessToken == null || accessToken.isEmpty()) return;\n        getSharedPreferences(SESSION_PREFS, MODE_PRIVATE)\n            .edit()\n            .putString(SESSION_ACCESS_KEY, accessToken)\n            .putString(SESSION_REFRESH_KEY, refreshToken == null ? "" : refreshToken)\n            .commit();\n    }\n\n`;
    service = service.replace(refreshMethodAnchor, `${helper}${refreshMethodAnchor}`);
  }

  const startTokenAnchor = `        refreshToken = safe(intent.getStringExtra(EXTRA_REFRESH_TOKEN));`;
  if (!service.includes('refreshToken = safe(intent.getStringExtra(EXTRA_REFRESH_TOKEN));\n        persistSessionTokens();')) {
    if (!service.includes(startTokenAnchor)) throw new Error(`APOIS Parceiro: leitura de sessão no start de ${label} não encontrada.`);
    service = service.replace(startTokenAnchor, `${startTokenAnchor}\n        persistSessionTokens();`);
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
    'putString(SESSION_ACCESS_KEY, accessToken)',
    'putString(SESSION_REFRESH_KEY, refreshToken)',
  ]) {
    if (!plugin.includes(marker)) throw new Error(`APOIS Parceiro: plugin ${label} sem coordenação de sessão (${marker}).`);
  }
  for (const marker of [
    'private void persistSessionTokens()',
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
  label: 'Motorista',
});
patchRuntime({
  pluginFile: 'CourierLocationPlugin.java',
  serviceFile: 'CourierLocationService.java',
  roleKey: 'courier',
  className: 'CourierLocation',
  label: 'Entregador',
});

console.log('[OK] APOIS Parceiro: refresh token usado pelos serviços de GPS é persistido e pode ser reconciliado pela WebView da mesma conta, evitando sessão divergente após longos períodos em background.');
