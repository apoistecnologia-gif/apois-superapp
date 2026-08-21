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

// OAuth do Mercado Pago já está configurado no backend com o retorno legado
// br.com.apois.app://auth/mercadopago. O APK Parceiro registra esse scheme para
// permitir a homologação sem mudar a configuração financeira antes da hora.
if (!manifest.includes('android:scheme="br.com.apois.app"')) {
  const filter = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="br.com.apois.app" android:host="auth" android:pathPrefix="/mercadopago" />\n            </intent-filter>`;
  manifest = manifest.replace('</activity>', `${filter}\n        </activity>`);
}

if (!manifest.includes('android:scheme="br.com.apois.parceiro"')) {
  const filter = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="br.com.apois.parceiro" android:host="auth" />\n            </intent-filter>`;
  manifest = manifest.replace('</activity>', `${filter}\n        </activity>`);
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
import android.os.Handler;
import android.os.Looper;
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

    private boolean hasGoogleTts() {
        try {
            getContext().getPackageManager().getPackageInfo(GOOGLE_TTS_ENGINE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException ignored) {
            return false;
        }
    }

    private void initTts() {
        if (tts != null) return;
        getActivity().runOnUiThread(() -> {
            if (tts != null) return;
            if (hasGoogleTts()) {
                activeEngine = GOOGLE_TTS_ENGINE;
                tts = new TextToSpeech(getContext(), this, GOOGLE_TTS_ENGINE);
            } else {
                activeEngine = "default";
                tts = new TextToSpeech(getContext(), this);
            }
        });
    }

    @Override
    public void onInit(int status) {
        if (status != TextToSpeech.SUCCESS || tts == null) {
            ready = false;
            return;
        }
        int language = tts.setLanguage(PT_BR);
        ready = language != TextToSpeech.LANG_MISSING_DATA && language != TextToSpeech.LANG_NOT_SUPPORTED;
        tts.setSpeechRate(0.98f);
        tts.setPitch(1.0f);
        tts.setAudioAttributes(
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        );
    }

    private void resolvePrime(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ready", ready);
        result.put("engine", activeEngine);
        result.put("language", "pt-BR");
        call.resolve(result);
    }

    @PluginMethod
    public void prime(PluginCall call) {
        initTts();
        if (ready) {
            resolvePrime(call);
            return;
        }
        new Handler(Looper.getMainLooper()).postDelayed(() -> resolvePrime(call), 2200L);
    }

    private void performSpeak(PluginCall call, String text, boolean interrupt) {
        if (!ready || tts == null) {
            call.reject("Voz de navegação pt-BR indisponível no aparelho.");
            return;
        }
        int queueMode = interrupt ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD;
        int result = tts.speak(text, queueMode, null, "apois-nav-" + UUID.randomUUID());
        if (result == TextToSpeech.ERROR) {
            call.reject("Falha ao reproduzir voz de navegação.");
            return;
        }
        JSObject response = new JSObject();
        response.put("spoken", true);
        response.put("engine", activeEngine);
        call.resolve(response);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "").trim();
        boolean interrupt = Boolean.TRUE.equals(call.getBoolean("interrupt", false));
        if (text.isEmpty()) {
            call.resolve();
            return;
        }
        initTts();
        if (ready) {
            performSpeak(call, text, interrupt);
            return;
        }
        new Handler(Looper.getMainLooper()).postDelayed(() -> performSpeak(call, text, interrupt), 2200L);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (tts != null) tts.stop();
        call.resolve();
    }
}
`;
writeFileSync(voicePluginPath, voicePluginJava, 'utf8');

if (!existsSync(mainActivityPath)) {
  throw new Error(`MainActivity do APOIS Parceiro não encontrada: ${mainActivityPath}`);
}
let mainActivity = readFileSync(mainActivityPath, 'utf8');
if (!mainActivity.includes('import android.os.Bundle;')) {
  mainActivity = mainActivity.replace(
    'package br.com.apois.parceiro;',
    'package br.com.apois.parceiro;\n\nimport android.os.Bundle;',
  );
}
if (!mainActivity.includes('registerPlugin(DriverVoicePlugin.class)')) {
  if (/public class MainActivity extends BridgeActivity\s*\{\s*\}/s.test(mainActivity)) {
    mainActivity = mainActivity.replace(
      /public class MainActivity extends BridgeActivity\s*\{\s*\}/s,
      `public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(DriverVoicePlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n}`,
    );
  } else if (mainActivity.includes('public void onCreate(Bundle savedInstanceState)')) {
    mainActivity = mainActivity.replace(
      'super.onCreate(savedInstanceState);',
      'registerPlugin(DriverVoicePlugin.class);\n        super.onCreate(savedInstanceState);',
    );
  } else {
    const lastBrace = mainActivity.lastIndexOf('}');
    if (lastBrace < 0) throw new Error('MainActivity do Parceiro inválida');
    const method = `\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(DriverVoicePlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n`;
    mainActivity = mainActivity.slice(0, lastBrace) + method + mainActivity.slice(lastBrace);
  }
}
writeFileSync(mainActivityPath, mainActivity, 'utf8');

if (!readFileSync(voicePluginPath, 'utf8').includes('@CapacitorPlugin(name = "DriverVoice")')) {
  throw new Error('DriverVoicePlugin não foi instalado no APK Parceiro');
}
if (!readFileSync(mainActivityPath, 'utf8').includes('registerPlugin(DriverVoicePlugin.class)')) {
  throw new Error('DriverVoicePlugin não foi registrado na MainActivity do APK Parceiro');
}

console.log('[OK] APOIS Parceiro Android: localização, notificações, OAuth e voz nativa pt-BR configurados');
