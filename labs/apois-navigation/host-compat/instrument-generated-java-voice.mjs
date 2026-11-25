import assert from "node:assert/strict";
import {instrumentVoice} from "./instrument-driver-voice.mjs";
import {instrumentSharedAudio} from "./instrument-shared-audio.mjs";
function once(s,a,b){
  assert.equal(s.split(a).length,2,"QA290 Java voice anchor: "+a);
  return s.replace(a,()=>b);
}
export function instrumentGeneratedJavaVoice(raw) {
  // Historical hardener changed both 900ms startup delays to 2200ms.
  // Reuse the compiled original generation guard, then restore exact package
  // and delay. No second TTS service or new plugin identifier.
  assert.equal(raw.split("2200L").length,3,"QA290 historical TTS startup delay");
  const s=instrumentSharedAudio(instrumentVoice(raw.replaceAll("2200L","900L")));
  return once(s,"package br.com.apois.navigation.compat.lab;","package com.apois.motorista;").replaceAll("900L","2200L");
}
