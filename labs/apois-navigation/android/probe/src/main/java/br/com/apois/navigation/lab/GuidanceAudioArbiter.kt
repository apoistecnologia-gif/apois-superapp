package br.com.apois.navigation.lab

// Main-thread serialized, engine-agnostic exclusive ownership. Legacy and
// operational speech share the same physical engine as navigation guidance.
// A failed stop blocks all playback until an explicit successful stop.
internal class GuidanceAudioArbiter(
    private val ready:()->Boolean,private val stopEngine:()->Boolean,
    private val speakEngine:(String)->Boolean
){
    internal class Lease
    private var lease:Lease?=null
    private var blocked=false
    private var closed=false
    private fun stop():Boolean{
        val ok=runCatching{stopEngine()}.getOrDefault(false)
        blocked=!ok
        return ok
    }
    fun acquire(webStopped:Boolean):Lease?{
        if(closed||blocked||lease!=null||!webStopped||!runCatching{ready()}.getOrDefault(false))return null
        if(!stop())return null
        return Lease().also{lease=it}
    }
    fun current(candidate:Lease):Boolean=!closed&&!blocked&&lease===candidate
    fun speak(candidate:Lease,text:String):Boolean{
        if(!current(candidate)||text.isBlank())return false
        if(runCatching{speakEngine(text)}.getOrDefault(false))return true
        lease=null
        stop()
        return false
    }
    fun pause(candidate:Lease):Boolean{
        if(!current(candidate))return false
        if(stop())return true
        lease=null
        return false
    }
    fun release(candidate:Lease):Boolean{
        if(!current(candidate))return false
        lease=null
        return stop()
    }
    // Every legacy utterance is treated as an operational interruption. Old
    // callbacks are invalidated by the engine stop before legacy queues audio.
    fun beforeLegacySpeech():Boolean{
        if(closed||blocked)return false
        if(lease==null)return true
        lease=null
        return stop()
    }
    fun explicitStop():Boolean{
        if(closed)return false
        lease=null
        return stop()
    }
    fun close(){if(!closed){lease=null;stop();closed=true}}
}
