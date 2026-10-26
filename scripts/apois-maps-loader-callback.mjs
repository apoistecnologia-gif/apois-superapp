// APOIS Maps: correção isolada do carregamento JS no Android WebView.
// O Google recomenda callback=globalFn quando loading=async está ativo:
// script.onload sozinho NÃO garante que google.maps.importLibrary exista.
const CALLBACK_NAME = '__apoisGoogleMapsJavascriptReady';

export function patchMapsJavaScriptLoader(source) {
  const original = source;
  function replaceOnce(oldValue, newValue, label) {
    if (source.includes(newValue)) return;
    const matches = source.split(oldValue).length - 1;
    if (matches !== 1) throw new Error('[FAIL] Google Maps loader: ' + label + ' (matches=' + matches + ')');
    source = source.replace(oldValue, newValue);
  }

  // Mantém as restrições HTTP Referrer do Google Cloud. Apenas deixa de forçar
  // origin-only, que pode conflitar com restrições baseadas em caminhos.
  replaceOnce(
    '          auth_referrer_policy: "origin",',
    '          // APOIS_WEBVIEW_REFERRER_COMPAT_V1: usa referer normal, sem origin-only',
    'configuracao de referer',
  );

  replaceOnce(
    'const SCRIPT_ID = "apois-google-maps-js";',
    'const SCRIPT_ID = "apois-google-maps-js";\nconst APOIS_MAPS_READY_CALLBACK = "' + CALLBACK_NAME + '"; // APOIS_MAPS_CALLBACK_READY_V1',
    'declaracao da callback',
  );

  // A callback do Google é chamada após o carregamento completo da API.
  // Registrar a função ANTES de inserir a tag de script.
  replaceOnce(
    '      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;',
    `      const onApiReady = () => {
        if (typeof googleWindow.google?.maps?.importLibrary === "function") finish();
        else finish(new Error("maps_api_unavailable"));
      };
      (window as any)[APOIS_MAPS_READY_CALLBACK] = onApiReady;

      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;`,
    'callback global antes de adicionar o script',
  );

  replaceOnce(
    '        window.clearTimeout(timeoutId);',
    `        window.clearTimeout(timeoutId);
        if ((window as any)[APOIS_MAPS_READY_CALLBACK] === onApiReady) {
          delete (window as any)[APOIS_MAPS_READY_CALLBACK];
        }`,
    'limpeza da callback apos sucesso/erro',
  );

  replaceOnce(
    '          loading: "async",',
    '          loading: "async",\n          callback: APOIS_MAPS_READY_CALLBACK,',
    'parametro de callback na URL',
  );

  // A etapa adapt-corridas-current.mjs converte o ternario original em
  // if/else explícito ANTES deste hardener. Aceitamos os dois formatos.
  source = source.replace(
    `            if (googleWindow.google?.maps?.importLibrary) finish();
            else finish(new Error("maps_api_unavailable"));`,
    `            googleWindow.google?.maps?.importLibrary
              ? finish()
              : finish(new Error("maps_api_unavailable"));`,
  );
  source = source.replace(
    `        if (googleWindow.google?.maps?.importLibrary) finish();
        else finish(new Error("maps_api_unavailable"));`,
    `        googleWindow.google?.maps?.importLibrary
          ? finish()
          : finish(new Error("maps_api_unavailable"));`,
  );

  // Com loading=async o onload pode ocorrer antes da inicialização interna.
  // Não emitir erro prematuro: callback ou timeout/evento real decidem.
  replaceOnce(
    `            googleWindow.google?.maps?.importLibrary
              ? finish()
              : finish(new Error("maps_api_unavailable"));`,
    `            if (typeof googleWindow.google?.maps?.importLibrary === "function") finish();`,
    'carregamento de script preexistente',
  );
  replaceOnce(
    `      script.onload = () => {
        googleWindow.google?.maps?.importLibrary
          ? finish()
          : finish(new Error("maps_api_unavailable"));
      };`,
    `      script.onload = () => {
        if (typeof googleWindow.google?.maps?.importLibrary === "function") finish();
        // loading=async: aguarda callback do Google em vez de falhar aqui.
      };`,
    'script.onload prematuro',
  );

  const required = [
    'APOIS_MAPS_CALLBACK_READY_V1',
    'callback: APOIS_MAPS_READY_CALLBACK,',
    'const onApiReady = () =>',
    'delete (window as any)[APOIS_MAPS_READY_CALLBACK]',
    'loading=async: aguarda callback',
  ];
  for (const token of required) {
    if (!source.includes(token)) throw new Error('[FAIL] Google Maps loader incompleto: ' + token);
  }
  if (source.includes('auth_referrer_policy: "origin"')) throw new Error('[FAIL] Referer origin-only presente');
  if (source === original) return original; // execução repetida deve ser idempotente.
  return source;
}
