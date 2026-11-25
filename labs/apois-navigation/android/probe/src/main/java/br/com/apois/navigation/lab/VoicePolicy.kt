package br.com.apois.navigation.lab

// Correct only observed Valhalla mixed-language transition templates,
// never translate road names, numbers, distances or maneuver direction.
// The second template was observed in regional run 45608869135.
private val mixedDistancePrefix=Regex("^In(?=\\s+\\d+(?:[.,]\\d+)?\\s+(?:metros?|quilômetros?|quilometros?|km)\\b)",RegexOption.IGNORE_CASE)
private val mixedTransition=Regex("(^|[.!?]\\s+)(Then,\\s+in)(?=\\s+\\d+(?:[.,]\\d+)?\\s+(?:metros?|quilômetros?|quilometros?|km)\\s*,)",RegexOption.IGNORE_CASE)
internal fun normalizeNavigationSpeech(text:String):String = text.trim()
    .replace(mixedDistancePrefix,"Em")
    .replace(mixedTransition){match->match.groupValues[1]+"Então, em"}

// One policy per active navigation voice. Utterance IDs may be reused by a
// replacement navigator. Scope IDs to the route while bounding total accepts.
// Only defer the immediately previous identical phrase for a short interval
// after replacement; never deduplicate permanently by street name or text.
internal class VoicePolicy(private val maxUtterances:Int=4096) {
    private val seen=LinkedHashSet<String>()
    private var total=0
    private var closed=false
    private var lastText:String?=null
    private var lastAt:Long?=null
    private var replacementText:String?=null
    private var suppressUntil:Long?=null
    init { require(maxUtterances>0) }

    @Synchronized fun routeReplaced(now:Long) {
        if(closed)return
        seen.clear()
        val previous=lastAt
        // At most four seconds from the previous queued instruction, not
        // from each reroute. Unknown time or an older instruction is not held.
        replacementText=if(previous!=null && now>=previous && now-previous<4_000L)lastText else null
        suppressUntil=if(replacementText!=null)previous!!+4_000L else null
    }

    @Synchronized fun accept(id:String,text:String,ready:Boolean,muted:Boolean,now:Long=0L):String? {
        if(closed||!ready||muted||id.isBlank()||text.isBlank()||id in seen)return null
        if(total>=maxUtterances)return null
        val normalized=normalizeNavigationSpeech(text)
        val until=suppressUntil
        if(replacementText==normalized && until!=null && now>=0 && now<until) {
            // Do not spend the ID: if it is still the SDK's instruction after
            // the hold expires, it must be eligible to speak.
            return null
        }
        replacementText=null
        suppressUntil=null
        seen.add(id)
        total++
        lastText=normalized
        lastAt=now.takeIf{it>0}
        return normalized
    }
    @Synchronized fun close(){closed=true;seen.clear();lastText=null;lastAt=null;replacementText=null;suppressUntil=null}
}
