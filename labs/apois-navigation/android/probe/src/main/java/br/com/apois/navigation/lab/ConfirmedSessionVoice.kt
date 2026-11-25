package br.com.apois.navigation.lab

// Main-looper, one permit per confirmed Activity. Holding the permit at the
// session owner lets revocation stop guidance before Compose disposal and
// even while GPS produces no callbacks. Never stop unrelated legacy audio.
internal class ConfirmedSessionVoice {
    private var permit:OnceNavigationVoicePermit?=null
    private var attempted=false
    fun acquire(factory:()->NavigationVoicePermit?):NavigationVoicePermit?{
        if(attempted)return null
        attempted=true
        return runCatching{factory()?.let(::OnceNavigationVoicePermit)}.getOrNull()?.also{permit=it}
    }
    fun checkAuthority(){
        val current=permit?:return
        if(!runCatching{current.isCurrent()}.getOrDefault(false))close()
    }
    fun pause(){
        val current=permit?:return
        if(!runCatching{current.isCurrent()&&current.stop()}.getOrDefault(false))close()
    }
    fun close(){
        attempted=true
        val old=permit
        permit=null
        old?.let{runCatching{it.release()}}
    }
}
