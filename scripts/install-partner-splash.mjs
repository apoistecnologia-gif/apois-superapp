import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const resRoot = resolve('superapp/partner-shell/android/app/src/main/res');
if (!existsSync(resRoot)) throw new Error(`Recursos Android do APOIS Parceiro ausentes: ${resRoot}`);

const drawableDir = join(resRoot, 'drawable');
mkdirSync(drawableDir, { recursive: true });

// Não reutilizamos o splash genérico criado pelo template Android.
// O fundo branco pertence à identidade atual do host Parceiro e a marca fica centralizada,
// sem esticar a arte nem transformar o launcher em uma tela inteira borrada.
// O atributo android:drawable de <item> espera referência de drawable; por isso
// o fundo sólido é um <shape>, evitando erro de AAPT com literal #FFFFFF.
const splashDrawable = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="#FFFFFF" />
        </shape>
    </item>
    <item android:gravity="center">
        <bitmap
            android:gravity="center"
            android:src="@mipmap/ic_launcher" />
    </item>
</layer-list>
`;
const splashPath = join(drawableDir, 'apois_partner_splash.xml');
writeFileSync(splashPath, splashDrawable, 'utf8');

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

  // Android 12+: garante fundo branco e ícone oficial, independentemente do
  // recurso splash padrão que o Capacitor tiver criado.
  if (xml.includes('windowSplashScreenBackground')) {
    xml = xml.replace(/(<item\s+name="(?:android:)?windowSplashScreenBackground">)[^<]*(<\/item>)/g, '$1#FFFFFF$2');
  } else {
    xml = xml.replace(
      /(<style\s+name="AppTheme\.NoActionBarLaunch"[^>]*>)/,
      '$1\n        <item name="windowSplashScreenBackground">#FFFFFF</item>',
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

const finalSplash = readFileSync(splashPath, 'utf8');
if (!finalSplash.includes('<solid android:color="#FFFFFF" />')) throw new Error('Drawable do splash não possui fundo sólido válido.');
if (finalSplash.includes('android:drawable="#FFFFFF"')) throw new Error('Drawable do splash usa literal de cor inválido em android:drawable.');

const allStyles = styleFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
if (!allStyles.includes('#FFFFFF')) throw new Error('Splash do Parceiro não ficou com fundo #FFFFFF.');
if (!allStyles.includes('@mipmap/ic_launcher')) throw new Error('Splash do Parceiro não usa o ícone oficial APOIS.');
if (allStyles.includes('@drawable/splash')) throw new Error('Splash padrão do template Android permaneceu ativo no Parceiro.');

// Esta é a última transformação de recursos antes do Gradle no workflow Parceiro.
// Saneia resíduos do template Capacitor e de scripts anteriores para impedir que
// o AAPT2 encontre duas definições de color/ic_launcher_background.
await import('./sanitize-partner-launcher-resources.mjs');

console.log('[OK] Splash Android do APOIS Parceiro usa drawable XML válido, fundo branco e marca oficial centralizada, sem splash genérico do template.');
