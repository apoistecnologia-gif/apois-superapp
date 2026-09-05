const strict = process.env.APOIS_STRICT_NATIVE_CONFIG === '1';
const canonicalUrl = 'https://vqtucstyduxrqjgyigfk.supabase.co';
let failed = false;
function fail(message) { failed = true; console.error(`[FAIL] ${message}`); }
function warn(message) { console.warn(`[WARN] ${message}`); }
function ok(message) { console.log(`[OK] ${message}`); }

const supabaseUrl = process.env.CORRIDAS_VITE_SUPABASE_URL?.trim().replace(/\/$/, '') || '';
if (!supabaseUrl) {
  if (strict) fail('CORRIDAS_VITE_SUPABASE_URL é obrigatória no release');
  else warn('CORRIDAS_VITE_SUPABASE_URL ausente no desenvolvimento');
} else if (supabaseUrl !== canonicalUrl) {
  fail(`CORRIDAS_VITE_SUPABASE_URL deve ser ${canonicalUrl}`);
} else ok('Supabase Corridas canônico configurado');

for (const name of ['CORRIDAS_WEB_MAPS_API_KEY', 'CORRIDAS_ANDROID_MAPS_API_KEY']) {
  const value = process.env[name]?.trim() || '';
  if (!value) {
    if (strict) fail(`${name} é obrigatória no release estrito`);
    else warn(`${name} ausente; mapa pode ficar indisponível em desenvolvimento`);
    continue;
  }
  if (!/^AIza[A-Za-z0-9_-]{20,}$/.test(value)) fail(`${name} não tem formato plausível de chave Google`);
  else ok(`${name} presente com formato plausível`);
}

if (failed) process.exit(1);
console.log(`[OK] Gate mínimo de release concluído${strict ? ' em modo estrito' : ' em modo desenvolvimento'}.`);
