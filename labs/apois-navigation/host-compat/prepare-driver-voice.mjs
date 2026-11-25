import {readFileSync,writeFileSync,realpathSync,mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
import {instrumentVoice} from "./instrument-driver-voice.mjs";
import {instrumentSharedAudio} from "./instrument-shared-audio.mjs";
import {instrumentGeneratedJavaVoice} from "./instrument-generated-java-voice.mjs";
const [hostArg,sourceArg,repoArg]=process.argv.slice(2);
const host=realpathSync(hostArg),source=realpathSync(sourceArg),repo=realpathSync(repoArg);
assert.ok(host.startsWith(realpathSync(process.env.RUNNER_TEMP)+"/")&&host.endsWith("/apois-compat-host"));
assert.equal(execFileSync("git",["-C",source,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),"9fc171050d8b5703540c49d19a8f1e9f5162775f");
const original=join(source,"android-motorista/app/src/main/java/com/apois/motorista/DriverVoicePlugin.java");
assert.equal(execFileSync("git",["hash-object",original],{encoding:"utf8"}).trim(),"08fa0674ff51f11244dd0e8d362a903be3c4d708");
const raw=readFileSync(original,"utf8"),guarded=instrumentVoice(raw),patched=instrumentSharedAudio(guarded);
assert.throws(()=>instrumentSharedAudio(patched));
assert.ok(patched.includes("SharedGuidanceAudio.INSTANCE.beforeLegacySpeech(this)"));
assert.throws(()=>instrumentVoice(patched));
assert.throws(()=>instrumentVoice(raw.replace("if (tts != null) tts.stop();","")));
// Historical harden-motorista-voice-navigation-flow.mjs changes the two
// startup delays to 2200L. The full QA290 WebView workflow emitted the
// following SHA256s at e5c491f (run 45608534488, job 139185666949).
// Compile the exact generated Java, including its original package, rather
// than only the related 900ms compatibility variant. Neither is registered.
assert.equal(raw.split("900L").length,3);
const finalJava=instrumentGeneratedJavaVoice(raw.replaceAll("900L","2200L"));
const generation=readFileSync(join(repo,"labs/apois-navigation/host-compat/VoiceGeneration.java"),"utf8")
  .replace("package br.com.apois.navigation.compat.lab;","package com.apois.motorista;");
const hash=text=>createHash("sha256").update(text).digest("hex");
assert.equal(hash(finalJava),"8cb0ab1d7e186892a4bc6a523d91c86f0720a17f440c172a89385ee078b81843","Exact previously generated QA290 Java hash");
assert.equal(hash(generation),"73ba988496603b52c44154325a966cce9bf7116c8c625517534c56a10f0a5cc1","Exact previously generated QA290 generation guard hash");
assert.throws(()=>instrumentGeneratedJavaVoice(finalJava));
const target=join(host,"android/app/src/main/java/com/apois/motorista");
mkdirSync(target,{recursive:true});
writeFileSync(join(target,"DriverVoicePlugin.java"),finalJava,{flag:"wx"});
writeFileSync(join(target,"VoiceGeneration.java"),generation,{flag:"wx"});
const main=readFileSync(join(host,"android/app/src/main/java/br/com/apois/navigation/compat/lab/MainActivity.java"),"utf8");
assert.ok(!main.includes("DriverVoicePlugin"));
console.log("[OK] exact final generated QA290 voice Java sources prepared for compile; sha256="+hash(finalJava)+"; no runtime registration");
