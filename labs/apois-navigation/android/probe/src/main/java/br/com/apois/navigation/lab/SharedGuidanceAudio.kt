package br.com.apois.navigation.lab

import android.os.Looper
import java.util.function.BooleanSupplier
import java.util.function.Predicate

// Native-only adapter installed by the existing DriverVoice plugin in the
// disposable host. This is not a Capacitor method and has no TTS instance.
// Ownership is by object identity; destruction of an old plugin cannot stop
// another plugin's audio. All methods execute on the Android main looper.
object SharedGuidanceAudio {
    private var owner:Any?=null
    private var arbiter:GuidanceAudioArbiter?=null
    private fun main(){check(Looper.myLooper()==Looper.getMainLooper())}

    fun install(candidate:Any,ready:BooleanSupplier,stop:BooleanSupplier,speak:Predicate<String>):Boolean{
        main()
        if(owner!=null)return owner===candidate
        owner=candidate
        arbiter=GuidanceAudioArbiter({ready.asBoolean},{stop.asBoolean},{speak.test(it)})
        return true
    }
    fun beforeLegacySpeech(candidate:Any):Boolean{
        main()
        return owner===candidate&&arbiter?.beforeLegacySpeech()==true
    }
    fun stopForLegacy(candidate:Any):Boolean{
        main()
        return owner===candidate&&arbiter?.explicitStop()==true
    }
    fun uninstall(candidate:Any){
        main()
        if(owner!==candidate)return
        arbiter?.close()
        arbiter=null;owner=null
    }

    // Trusted host calls this only after Web Speech cancellation and native
    // legacy stop acknowledgement. The verified session must remain current.
    internal fun acquire(webStopped:Boolean,stillCurrent:()->Boolean):NavigationVoicePermit?{
        main()
        if(!runCatching{stillCurrent()}.getOrDefault(false))return null
        val engine=arbiter?:return null
        val token=engine.acquire(webStopped)?:return null
        return object:NavigationVoicePermit{
            override fun isCurrent():Boolean{
                main()
                return arbiter===engine&&engine.current(token)&&runCatching{stillCurrent()}.getOrDefault(false)
            }
            override fun speak(text:String):Boolean{main();return isCurrent()&&engine.speak(token,text)}
            override fun stop():Boolean{main();return arbiter===engine&&engine.pause(token)}
            override fun release(){main();if(arbiter===engine)engine.release(token)}
        }
    }
}
