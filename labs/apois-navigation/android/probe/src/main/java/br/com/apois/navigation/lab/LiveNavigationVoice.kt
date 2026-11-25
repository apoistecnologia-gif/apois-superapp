package br.com.apois.navigation.lab

import android.content.Context
import uniffi.ferrostar.SpokenInstruction

/** Host-provided exclusive lease. Issuing a lease requires stopping the existing
 * navigation voice first. This laboratory does not register the production issuer.
 * The host must revoke and close the surface on account/ride/voice-mode changes.
 */
internal interface NavigationVoicePermit {
    fun isCurrent(): Boolean
    fun release()
}

internal class OnceNavigationVoicePermit(private val delegate: NavigationVoicePermit) : NavigationVoicePermit {
    private var released = false
    override fun isCurrent(): Boolean = !released && delegate.isCurrent()
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

internal class LiveNavigationVoice(context: Context, private val permit: NavigationVoicePermit) {
    private val speech = PortugueseVoiceObserver(context)
    private var gate = LiveSpeechGate()
    private fun authorized() = runCatching { permit.isCurrent() }.getOrDefault(false)
    private fun update(next: LiveSpeechGate) {
        if (gate.closed) return
        gate = next
        if (!authorized()) { close(); return }
        speech.setMuted(gate.muted)
        if (!gate.permits(true)) speech.stopAndClearQueue()
    }
    fun setForeground(value: Boolean) = update(gate.copy(foreground = value))
    fun setGpsAvailable(value: Boolean) = update(gate.copy(gpsAvailable = value))
    fun setMuted(value: Boolean) = update(gate.copy(muted = value))
    fun speak(instruction: SpokenInstruction) {
        if (gate.closed) return
        if (!authorized()) { close(); return }
        if (gate.permits(true)) speech.onSpokenInstructionTrigger(instruction)
    }
    fun close() {
        if (gate.closed) return
        gate = gate.copy(closed = true)
        try { speech.close() } finally { runCatching { permit.release() } }
    }
}
