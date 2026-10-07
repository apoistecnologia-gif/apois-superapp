import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';

function patch(relativePath, transform, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado/sem alteração)`);
    return;
  }
  writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch('src/lib/theme.tsx', (source) => {
  let next = source;
  const listenerStart = next.indexOf('  // Listen to system changes while in "system" mode');
  const syncStart = next.indexOf('  // Sync from Supabase user preferences on auth/state change', listenerStart);
  if (listenerStart >= 0 && syncStart > listenerStart) {
    next = next.slice(0, listenerStart) + `  // APOIS Parceiro mantém a identidade visual clara vermelho/branco independentemente do tema do aparelho.\n  useEffect(() => {\n    applyThemeClass(\"dark\");\n  }, [mode]);\n\n` + next.slice(syncStart);
  }
  if (next.includes('mq.matches ? "dark" : "light"')) {
    throw new Error('[FAIL] theme.tsx: listener do sistema ainda pode mudar o APOIS Parceiro para tema claro');
  }
  if (!next.includes('applyThemeClass("light");')) {
    throw new Error('[FAIL] theme.tsx: trava de identidade clara não aplicada');
  }
  return next;
}, 'motorista: tema do sistema não consegue descaracterizar a identidade clara APOIS');

patch('src/routes/motorista.configuracoes.tsx', (source) => {
  let next = source;
  const themeBlockStart = next.indexOf('                <SettingsRow\n                  icon={Moon}\n                  title="Tema"');
  const navigationBlockStart = next.indexOf('                <SettingsRow\n                  icon={Navigation}\n                  title="App de navegação"', themeBlockStart);
  if (themeBlockStart >= 0 && navigationBlockStart > themeBlockStart) {
    next = next.slice(0, themeBlockStart) + next.slice(navigationBlockStart);
  }
  next = next.replace('  LockKeyhole, LogOut, MapPin, Moon, Navigation, Palette,\n', '  LockKeyhole, LogOut, MapPin, Navigation, Palette,\n');
  next = next.replace('  Sun, Trash2, User, Vibrate, Volume2, FileText, Fingerprint,\n', '  Trash2, User, Vibrate, Volume2, FileText, Fingerprint,\n');
  next = next.replace('  LogOut, MapPin, Moon, Navigation, Palette,\n', '  LogOut, MapPin, Navigation, Palette,\n');
  next = next.replace('  Sun, Trash2, User, Vibrate, Volume2, FileText,\n', '  Trash2, User, Vibrate, Volume2, FileText,\n');

  if (next.includes('title="Tema"')) throw new Error('[FAIL] motorista.configuracoes.tsx: seletor visual de tema permaneceu apesar do tema fixo da marca');
  return next;
}, 'motorista: configurações não exibem seletor de tema que não deve alterar a identidade da marca');

console.log(`[OK] identidade vermelho/branco do Motorista protegida em ${workspace}`);
