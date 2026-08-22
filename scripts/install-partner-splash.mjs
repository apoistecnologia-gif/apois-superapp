import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const resRoot = resolve('superapp/partner-shell/android/app/src/main/res');
if (!existsSync(resRoot)) throw new Error(`Recursos Android do APOIS Parceiro ausentes: ${resRoot}`);

const drawableDir = join(resRoot, 'drawable');
mkdirSync(drawableDir, { recursive: true });

// Não reutilizamos o splash branco/padrão criado pelo template Android.
// O fundo pertence à identidade do host Parceiro e a marca fica centralizada,
// sem esticar a arte nem transformar o launcher em uma tela inteira borrada.
const splashDrawable = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="#050505" />
    <item android:gravity="center">
        <bitmap
            android:gravity="center"
            android:src="@mipmap/ic_launcher" />
    </item>
</layer-list>
`;
writeFileSync(join(drawableDir, 'apois_partner_splash.xml'), splashDrawable, 'utf8');

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const styleFiles = walk(resRoot).filter((path) => /[/\\]values[^/\\]*[/\\]styles\.xml$/.test(path));
if (!styleFiles.length) throw new Error('Nenhum styles.xml Android encontrado para configurar o splash do Parceiro.');

let launchThemeFound = false;
for (const path of styleFiles) {
  let xml = readFileSync(path, 'utf8');
  if (!xml.includes('AppTheme.NoActionBarLaunch')) continue;
  launchThemeFound = true;

  // Template pré-Android-12 / fallback do SplashScreen.
  xml = xml.replaceAll('@drawable/splash', '@drawable/apois_partner_splash');

  // Android 12+: garante fundo preto e ícone oficial, independentemente do
  // recurso splash padrão que o Capacitor tiver criado.
  if (xml.includes('windowSplashScreenBackground')) {
    xml = xml.replace(/(<item\s+name="(?:android:)?windowSplashScreenBackground">)[^<]*(<\/item>)/g, '$1#050505$2');
  } else {
    xml = xml.replace(
      /(<style\s+name="AppTheme\.NoActionBarLaunch"[^>]*>)/,
      '$1\n        <item name="windowSplashScreenBackground">#050505</item>',
    );
  }

  if (xml.includes('windowSplashScreenAnimatedIcon')) {
    xml = xml.replace(/(<item\s+name="(?:android:)?windowSplashScreenAnimatedIcon">)[^<]*(<\/item>)/g, '$1@mipmap/ic_launcher$2');
  } else {
    xml = xml.replace(
      /(<style\s+name="AppTheme\.NoActionBarLaunch"[^>]*>)/,
      '$1\n        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher</item>',
    );
  }

  writeFileSync(path, xml, 'utf8');
}

if (!launchThemeFound) throw new Error('Tema AppTheme.NoActionBarLaunch não encontrado no Android do Parceiro.');

const allStyles = styleFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
if (!allStyles.includes('#050505')) throw new Error('Splash do Parceiro não ficou com fundo #050505.');
if (!allStyles.includes('@mipmap/ic_launcher')) throw new Error('Splash do Parceiro não usa o ícone oficial APOIS.');
if (allStyles.includes('@drawable/splash')) throw new Error('Splash padrão do template Android permaneceu ativo no Parceiro.');

console.log('[OK] Splash Android do APOIS Parceiro usa fundo preto e marca oficial centralizada, sem splash padrão/branco do template.');
