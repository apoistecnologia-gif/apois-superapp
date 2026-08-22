import { dirname, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = process.cwd();
const androidRoot = resolve(root, 'superapp/partner-shell/android');
const manifestPath = resolve(androidRoot, 'app/src/main/AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');

function ensurePermission(name) {
  if (manifest.includes(`android:name="${name}"`)) return;
  manifest = manifest.replace('<application', `    <uses-permission android:name="${name}" />\n\n    <application`);
}

ensurePermission('android.permission.ACCESS_FINE_LOCATION');
ensurePermission('android.permission.ACCESS_COARSE_LOCATION');
ensurePermission('android.permission.POST_NOTIFICATIONS');

// Android 11+ restringe descoberta de pacotes. Declarar o Google TTS permite
// priorizar Speech Services by Google quando estiver instalado; o plugin ainda
// possui fallback para o mecanismo TTS padrão do aparelho.
if (!manifest.includes('android:name="com.google.android.tts"')) {
  const queries = `    <queries>\n        <package android:name="com.google.android.tts" />\n    </queries>\n\n`;
  manifest = manifest.replace('<application', `${queries}    <application`);
}

// O APK Parceiro usa callback OAuth próprio. NÃO registre br.com.apois.app aqui:
// esse scheme pertence ao app cliente e, além de criar colisão entre aplicativos,
// faria o próprio workflow do Codemagic reprovar o Manifest. O backend do
// Motorista já recebe appTarget="partner" e retorna por br.com.apois.parceiro.
const legacyPartnerMpFilterPattern = /\s*<intent-filter>\s*<action android:name="android\.intent\.action\.VIEW"\s*\/>\s*<category android:name="android\.intent\.category\.DEFAULT"\s*\/>\s*<category android:name="android\.intent\.category\.BROWSABLE"\s*\/>\s*<data android:scheme="br\.com\.apois\.app" android:host="auth" android:pathPrefix="\/mercadopago"\s*\/>\s*<\/intent-filter>/g;
manifest = manifest.replace(legacyPartnerMpFilterPattern, '\n');

if (!manifest.includes('android:scheme="br.com.apois.parceiro"')) {
  const filter = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="br.com.apois.parceiro" android:host="auth" />\n            </intent-filter>`;
  manifest = manifest.replace('</activity>', `${filter}\n        </activity>`);
}

// O módulo Motorista continua usando seu scheme histórico para recuperação de
// senha e para o retorno do Google. O host nativo do APOIS Parceiro precisa
// declarar o mesmo scheme para receber esses callbacks e repassá-los ao módulo.
if (!manifest.includes('android:scheme="apoismotorista"')) {
  const filter = `\n            <intent-filter android:autoVerify="false">\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="apoismotorista" android:host="auth" />\n            </intent-filter>`;
  manifest = manifest.replace('</activity>', `${filter}\n        </activity>`);
}

if (manifest.includes('android:scheme="br.com.apois.app"') && manifest.includes('android:pathPrefix="/mercadopago"')) {
  throw new Error('APOIS Parceiro: callback Mercado Pago legado do app cliente permaneceu no Manifest.');
}

writeFileSync(manifestPath, manifest, 'utf8');

// ---------------------------------------------------------------------------
// Voz nativa do Motorista dentro do APK unificado APOIS Parceiro.
// O módulo web chama registerPlugin("DriverVoice"). Como o Android do Parceiro
// é criado do zero pelo Codemagic, o host também precisa registrar esse plugin.
// ---------------------------------------------------------------------------
const javaRoot = resolve(androidRoot, 'app/src/main/java/br/com/apois/parceiro');
const mainActivityPath = resolve(javaRoot, 'MainActivity.java');
const voicePluginPath = resolve(javaRoot, 'DriverVoicePlugin.java');
mkdirSync(javaRoot, { recursive: true });

const voicePluginJava = `package br.com.apois.parceiro;

import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.speech.tts.TextToSpeech;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(name = "DriverVoice")
public class DriverVoicePlugin extends Plugin implements TextToSpeech.OnInitListener {
    private static final String GOOGLE_TTS_ENGINE = "com.google.android.tts";
    private static final Locale PT_BR = new Locale("pt", "BR");

    private TextToSpeech tts;
    private boolean ready = false;
    private String activeEngine = "default";

    @Override
    public void load() {
        super.load();
        initTts();
    }

    private void initTts() {
        try {
            if (getContext().getPackageManager().getApplicationInfo(GOOGLE_TTS_ENGINE, 0) != null) {
                tts = new TextToSpeech(getContext(), this, GOOGLE_TTS_ENGINE);
                activeEngine = GOOGLE_TTS_ENGINE;
                return;
            }
        } catch (PackageManager.NameNotFoundException ignored) {
            // fallback abaixo
        }
        tts = new TextToSpeech(getContext(), this);
        activeEngine = "default";
    }

    @Override
    public void onInit(int status) {
        ready = status == TextToSpeech.SUCCESS;
        if (!ready || tts == null) return;
        tts.setLanguage(PT_BR);
        tts.setSpeechRate(0.96f);
        tts.setPitch(1.0f);
        tts.setAudioAttributes(new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build());
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "").trim();
        if (text.isEmpty()) {
            call.reject("Texto vazio");
            return;
        }
        if (!ready || tts == null) {
            call.reject("TTS ainda não está pronto");
            return;
        }
        String utteranceId = "apois-" + UUID.randomUUID();
        int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId);
        if (result == TextToSpeech.ERROR) {
            call.reject("Falha ao iniciar fala");
            return;
        }
        JSObject response = new JSObject();
        response.put("engine", activeEngine);
        call.resolve(response);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (tts != null) tts.stop();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        ready = false;
        super.handleOnDestroy();
    }
}
`;

writeFileSync(voicePluginPath, voicePluginJava, 'utf8');

let mainActivity = existsSync(mainActivityPath)
  ? readFileSync(mainActivityPath, 'utf8')
  : `package br.com.apois.parceiro;\n\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {}\n`;
if (!mainActivity.includes('registerPlugin(DriverVoicePlugin.class)')) {
  mainActivity = `package br.com.apois.parceiro;\n\nimport android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(DriverVoicePlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n}\n`;
}
writeFileSync(mainActivityPath, mainActivity, 'utf8');
console.log('[OK] Android do APOIS Parceiro configurado: permissões, deep links próprios e DriverVoice.');
