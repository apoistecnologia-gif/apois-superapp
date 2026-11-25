package br.com.apois.navigation.lab

import android.content.Context
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import com.stadiamaps.ferrostar.core.AndroidTtsObserver
import com.stadiamaps.ferrostar.core.AndroidTtsStatusListener
import com.stadiamaps.ferrostar.core.SpokenInstructionObserver
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import uniffi.ferrostar.SpokenInstruction
import java.util.Locale

// Lab adapter for the actual SDK observer. Only a future host may instantiate
// it after granting exclusive navigation voice ownership; never run alongside
// the existing APOIS voice plugin. No location, network, or ride mutations.
internal class PortugueseVoiceObserver(context:Context):SpokenInstructionObserver,AutoCloseable {
    private val policy=VoicePolicy()
    private val delegate=AndroidTtsObserver(context.applicationContext)
    private val _ready=MutableStateFlow(false)
    val ready:StateFlow<Boolean> = _ready.asStateFlow()
    @Volatile private var closed=false
    private val _failure=MutableStateFlow<String?>(null)
    val failure:StateFlow<String?> = _failure.asStateFlow()

    init {
        delegate.statusObserver=object:AndroidTtsStatusListener {
            override fun onTtsInitialized(tts:TextToSpeech?,status:Int) {
                if(closed)return
                val locale=Locale.forLanguageTag("pt-BR")
                val supported=status==TextToSpeech.SUCCESS && tts!=null &&
                    tts.setLanguage(locale)>=TextToSpeech.LANG_COUNTRY_AVAILABLE
                _ready.value=supported
                _failure.value=if(supported)null else "Voz em português brasileiro indisponível."
            }
            override fun onTtsShutdownAndRelease(){_ready.value=false}
            override fun onTtsSpeakError(utteranceId:String,status:Int){
                _ready.value=false
                _failure.value="Falha na orientação por voz. Siga as instruções visuais."
            }
        }
        delegate.start()
    }
    override val muteState:StateFlow<Boolean> get()=delegate.muteState
    @Synchronized override fun onSpokenInstructionTrigger(spokenInstruction:SpokenInstruction){
        if(closed)return
        val text=policy.accept(spokenInstruction.utteranceId.toString(),spokenInstruction.text,_ready.value,delegate.isMuted,SystemClock.elapsedRealtime())?:return
        delegate.onSpokenInstructionTrigger(spokenInstruction.copy(text=text))
    }
    @Synchronized override fun setMuted(isMuted:Boolean){
        if(closed)return
        delegate.setMuted(isMuted)
        if(isMuted)delegate.stopAndClearQueue()
    }
    @Synchronized fun routeReplaced(){
        if(closed)return
        delegate.stopAndClearQueue()
        policy.routeReplaced(SystemClock.elapsedRealtime())
    }
    @Synchronized override fun stopAndClearQueue(){if(!closed)delegate.stopAndClearQueue()}
    @Synchronized override fun close(){
        if(closed)return
        closed=true
        _ready.value=false
        policy.close()
        delegate.stopAndClearQueue()
        delegate.shutdown()
    }
}
