package br.com.apois.navigation.lab

// Correct only the observed mixed-language distance prefix. Street names and
// maneuver semantics remain unchanged. No machine translation or guessed turns.
private val mixedDistancePrefix=Regex("^In(?=\\s+\\d+(?:[.,]\\d+)?\\s+(?:metros?|quilômetros?|quilometros?|km)\\b)",RegexOption.IGNORE_CASE)
internal fun normalizeNavigationSpeech(text:String):String = text.trim().replace(mixedDistancePrefix,"Em")

// One instance per navigation leg. A new route can produce new utterance IDs.
// Keep a bounded set; never deduplicate by street name or instruction text.
internal class VoicePolicy(private val maxUtterances:Int=4096) {
    private val seen=LinkedHashSet<String>()
    private var closed=false
    init { require(maxUtterances>0) }
    @Synchronized fun accept(id:String,text:String,ready:Boolean,muted:Boolean):String? {
        if(closed||!ready||muted||id.isBlank()||text.isBlank()||id in seen)return null
        // Once full, fail silent rather than replay old instructions.
        if(seen.size>=maxUtterances)return null
        seen.add(id)
        return normalizeNavigationSpeech(text)
    }
    @Synchronized fun close(){closed=true;seen.clear()}
}
