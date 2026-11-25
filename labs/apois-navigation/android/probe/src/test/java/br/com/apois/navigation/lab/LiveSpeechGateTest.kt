package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test

class LiveSpeechGateTest {
    @Test fun requiresAllConditions() {
        val ready = LiveSpeechGate(foreground = true, gpsAvailable = true)
        assertTrue(ready.permits(true))
        assertFalse(ready.permits(false))
        assertFalse(ready.copy(foreground = false).permits(true))
        assertFalse(ready.copy(gpsAvailable = false).permits(true))
        assertFalse(ready.copy(muted = true).permits(true))
        assertFalse(ready.copy(closed = true).permits(true))
    }
    @Test fun startsSilent() {
        assertFalse(LiveSpeechGate().permits(true))
    }
    @Test fun qualityLabelsDoNotClaimArrival() {
        assertNull(gpsStatusLabel(GpsQuality.AVAILABLE))
        assertTrue(gpsStatusLabel(GpsQuality.WAITING)!!.contains("Aguardando"))
        assertTrue(gpsStatusLabel(GpsQuality.IMPRECISE)!!.contains("pausada"))
        assertTrue(gpsStatusLabel(GpsQuality.LOST)!!.contains("pausada"))
    }
}
