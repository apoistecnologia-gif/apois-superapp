import assert from "node:assert/strict";
function replaceOnce(s,a,b){
 assert.equal(s.split(a).length,2,"voice anchor: "+a);
 return s.replace(a,b);
}
export function instrumentVoice(source){
 let s=replaceOnce(source,"package com.apois.motorista;","package br.com.apois.navigation.compat.lab;");
 s=replaceOnce(s,"    private TextToSpeech tts;","    private final Handler main = new Handler(Looper.getMainLooper());\n    private final VoiceGeneration generation = new VoiceGeneration();\n    private boolean destroyed;\n    private TextToSpeech tts;");
 s=replaceOnce(s,`        if (tts != null) return;
        getActivity().runOnUiThread(() -> {
            if (tts != null) return;`,`        main.post(() -> {
            if (destroyed || tts != null) return;`);
 s=replaceOnce(s,`    public void onInit(int status) {
        if (status != TextToSpeech.SUCCESS || tts == null) {`,`    public void onInit(int status) {
        main.post(() -> finishInit(status));
    }

    private void finishInit(int status) {
        if (destroyed || status != TextToSpeech.SUCCESS || tts == null) {`);
 s=replaceOnce(s,`        initTts();
        if (ready) {
            resolvePrime(call);
            return;
        }
        new Handler(Looper.getMainLooper()).postDelayed(() -> resolvePrime(call), 900L);`,`        main.post(() -> {
            if (destroyed) { resolvePrime(call); return; }
            initTts();
            if (ready) { resolvePrime(call); return; }
            main.postDelayed(() -> resolvePrime(call), 900L);
        });`);
 s=replaceOnce(s,`    private void performSpeak(PluginCall call, String text, boolean interrupt) {
        if (!ready || tts == null) {`,`    private void performSpeak(PluginCall call, String text, boolean interrupt, long ticket) {
        if (!generation.accepts(ticket)) {
            JSObject skipped = new JSObject();
            skipped.put("spoken", false);
            skipped.put("cancelled", true);
            call.resolve(skipped); // resolve, not reject: no Web Speech fallback
            return;
        }
        if (!ready || tts == null) {`);
 s=replaceOnce(s,`        initTts();
        if (ready) {
            performSpeak(call, text, interrupt);
            return;
        }

        new Handler(Looper.getMainLooper()).postDelayed(() -> performSpeak(call, text, interrupt), 900L);`,`        main.post(() -> {
            if (interrupt && !destroyed) generation.invalidate();
            final long ticket = generation.ticket();
            if (destroyed || ready) {
                performSpeak(call, text, interrupt, ticket);
                return;
            }
            initTts();
            main.postDelayed(() -> performSpeak(call, text, interrupt, ticket), 900L);
        });`);
 s=replaceOnce(s,`        if (tts != null) tts.stop();
        call.resolve();
    }
}`,`        main.post(() -> {
            generation.invalidate();
            boolean stopped = false;
            try { stopped = tts == null || tts.stop() == TextToSpeech.SUCCESS; }
            catch (RuntimeException ignored) { }
            JSObject result = new JSObject();
            result.put("stopped", stopped);
            call.resolve(result);
        });
    }

    @Override
    protected void handleOnDestroy() {
        main.post(() -> {
            destroyed = true;
            generation.close();
            ready = false;
            if (tts != null) {
                try { tts.stop(); } finally { tts.shutdown(); tts = null; }
            }
        });
        super.handleOnDestroy();
    }
}`);
 assert.equal((s.match(/tts\.speak\(/g)||[]).length,1);
 return s;
}
