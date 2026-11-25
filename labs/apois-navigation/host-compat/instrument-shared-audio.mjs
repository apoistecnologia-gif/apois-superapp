import assert from "node:assert/strict";
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,"shared audio anchor: "+a);return s.replace(a,()=>b);};
// Apply only to the generation-guarded DriverVoice copy in the isolated host.
// No new engine, plugin ID, permissions or registration.
export function instrumentSharedAudio(raw){
 let s=once(raw,"import android.speech.tts.TextToSpeech;","import android.speech.tts.TextToSpeech;\nimport br.com.apois.navigation.lab.SharedGuidanceAudio;");
 s=once(s,"    private boolean ready = false;","    private boolean ready = false;\n    private boolean guidanceReady = false;");
 s=once(s,"        super.load();\n        initTts();",`        super.load();
        main.post(() -> SharedGuidanceAudio.INSTANCE.install(this,
            () -> !destroyed && ready && guidanceReady && tts != null,
            this::stopSharedEngine, this::speakSharedGuidance));
        initTts();`);
 s=once(s,"            ready = false;\n            return;","            ready = false;\n            guidanceReady = false;\n            return;");
 s=once(s,"        tts.setSpeechRate(0.98f);","        guidanceReady = language >= TextToSpeech.LANG_COUNTRY_AVAILABLE;\n        tts.setSpeechRate(0.98f);");
 s=once(s,"    private void resolvePrime(PluginCall call) {",`    // Both legacy and Ferrostar guidance use this same engine. Stop must
    // invalidate every delayed legacy callback before acknowledging.
    private boolean stopSharedEngine() {
        generation.invalidate();
        try { return tts == null || tts.stop() == TextToSpeech.SUCCESS; }
        catch (RuntimeException ignored) { return false; }
    }

    private boolean speakSharedGuidance(String text) {
        if (destroyed || !ready || !guidanceReady || tts == null) return false;
        return tts.speak(text, TextToSpeech.QUEUE_FLUSH, null,
            "apois-guidance-" + UUID.randomUUID()) == TextToSpeech.SUCCESS;
    }

    private void resolvePrime(PluginCall call) {`);
 s=once(s,"            if (interrupt && !destroyed) generation.invalidate();",`            if (destroyed || !SharedGuidanceAudio.INSTANCE.beforeLegacySpeech(this)) {
                JSObject skipped = new JSObject();
                skipped.put("spoken", false);
                skipped.put("cancelled", true);
                call.resolve(skipped); // never enter Web Speech on ambiguous stop
                return;
            }
            if (interrupt) generation.invalidate();`);
 s=once(s,`            generation.invalidate();
            boolean stopped = false;
            try { stopped = tts == null || tts.stop() == TextToSpeech.SUCCESS; }
            catch (RuntimeException ignored) { }`,`            boolean stopped = SharedGuidanceAudio.INSTANCE.stopForLegacy(this);`);
 s=once(s,"            destroyed = true;\n            generation.close();","            SharedGuidanceAudio.INSTANCE.uninstall(this);\n            destroyed = true;\n            guidanceReady = false;\n            generation.close();");
 assert.equal((s.match(/new TextToSpeech\(/g)||[]).length,2,"existing two alternative constructors only");
 assert.equal((s.match(/tts\.speak\(/g)||[]).length,2,"legacy and guidance share tts");
 return s;
}
