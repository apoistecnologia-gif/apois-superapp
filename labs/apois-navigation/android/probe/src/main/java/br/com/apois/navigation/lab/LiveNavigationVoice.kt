package br.com.apois.navigation.lab

import android.os.SystemClock
import uniffi.ferrostar.SpokenInstruction

/** Host-provided exclusive lease. Issuing a lease requires stopping the existing
 * navigation voice first. This laboratory does not register the production issuer.
 * The host must revoke and close the surface on account/ride/voice-mode changes.
 */
internal interface NavigationVoicePermit {
    fun isCurrent(): Boolean
    fun speak(text:String):Boolean
    fun stop():Boolean
    fun release()
}

internal class OnceNavigationVoicePermit(private val delegate: NavigationVoicePermit) : NavigationVoicePermit {
    private var released = false
    override fun isCurrent(): Boolean = !released && delegate.isCurrent()
    override fun speak(text:String):Boolean = isCurrent() && delegate.speak(text)
    override fun stop():Boolean = !released && delegate.stop()
    override fun release() {
        if (released) return
        released = true
        delegate.release()
    }
}

internal data class LiveSpeechGate(
    val foreground: Boolean = false, val gpsAvailable: Boolean = false,
    val muted: Boolean = false, val closed: Boolean = false
) {
    fun permits(leaseCurrent: Boolean): Boolean =
        !closed && foreground && gpsAvailable && !muted && leaseCurrent
}

// Confirmed live guidance does not instantiate AndroidTtsObserver or another
// engine. Only the existing DriverVoice engine, through an exclusive permit,
// may speak. The synthetic replay retains its own separate laboratory voice.
internal class LiveNavigationVoice(private val permit: NavigationVoicePermit) {
    private val policy=VoicePolicy()
    private var gate = LiveSpeechGate()
    private fun authorized() = runCatching { permit.isCurrent() }.getOrDefault(false)
    private fun update(next: LiveSpeechGate) {
        if (gate.closed) return
        val wasPermitted=gate.permits(true)
        gate = next
        if (!authorized()) { close(); return }
        if (wasPermitted&&!gate.permits(true)&&!runCatching{permit.stop()}.getOrDefault(false))close()
    }
    fun setForeground(value: Boolean) = update(gate.copy(foreground = value))
    fun setGpsAvailable(value: Boolean) = update(gate.copy(gpsAvailable = value))
    fun setMuted(value: Boolean) = update(gate.copy(muted = value))
    fun routeReplaced() {
        if (gate.closed) return
        if (!authorized()) { close(); return }
        if(!runCatching{permit.stop()}.getOrDefault(false)){close();return}
        policy.routeReplaced(SystemClock.elapsedRealtime())
    }
    fun speak(instruction: SpokenInstruction) {
        if (gate.closed) return
        if (!authorized()) { close(); return }
        if (!gate.permits(true))return
        val text=policy.accept(instruction.utteranceId.toString(),instruction.text,true,false,SystemClock.elapsedRealtime())?:return
        if(!runCatching{permit.speak(text)}.getOrDefault(false))close()
    }
    fun close() {
        if (gate.closed) return
        gate = gate.copy(closed = true)
        policy.close()
        runCatching { permit.release() }
    }
}
