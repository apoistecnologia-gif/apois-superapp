package br.com.apois.navigation.lab
import org.junit.Assert.*
import org.junit.Test
class GuidanceAudioArbiterTest{
    @Test fun requiresWebStopAndReadyEngine(){
        var ready=false;var stops=0
        val a=GuidanceAudioArbiter({ready},{stops++;true},{true})
        assertNull(a.acquire(true));ready=true;assertNull(a.acquire(false));assertEquals(0,stops)
        val token=a.acquire(true)!!
        assertEquals(1,stops);assertNull(a.acquire(true));assertTrue(a.speak(token,"Vire."))
    }
    @Test fun legacyAlertRevokesNativeBeforeSpeechAndOldReleaseCannotStopAlert(){
        val events=mutableListOf<String>()
        val a=GuidanceAudioArbiter({true},{events.add("stop");true},{events.add(it);true})
        val token=a.acquire(true)!!
        assertTrue(a.speak(token,"Vire."))
        assertTrue(a.beforeLegacySpeech());events.add("Nova corrida")
        assertFalse(a.speak(token,"Siga."));assertFalse(a.release(token));assertFalse(a.pause(token))
        assertEquals(listOf("stop","Vire.","stop","Nova corrida"),events)
    }
    @Test fun failedStopBlocksBothUntilExplicitRecovery(){
        var stopOk=true
        val a=GuidanceAudioArbiter({true},{stopOk},{true})
        val token=a.acquire(true)!!
        stopOk=false
        assertFalse(a.beforeLegacySpeech());assertFalse(a.current(token));assertNull(a.acquire(true))
        assertFalse(a.beforeLegacySpeech())
        stopOk=true;assertTrue(a.explicitStop());assertTrue(a.beforeLegacySpeech());assertNotNull(a.acquire(true))
    }
    @Test fun staleLeaseCannotAffectNewLease(){
        var stops=0
        val a=GuidanceAudioArbiter({true},{stops++;true},{true})
        val old=a.acquire(true)!!;assertTrue(a.release(old))
        val next=a.acquire(true)!!;val count=stops
        assertFalse(a.pause(old));assertFalse(a.release(old));assertFalse(a.speak(old,"Vire."))
        assertEquals(count,stops);assertTrue(a.current(next))
    }
    @Test fun engineErrorRevokesGuidance(){
        val a=GuidanceAudioArbiter({true},{true},{throw IllegalStateException()})
        val token=a.acquire(true)!!;assertFalse(a.speak(token,"Vire."));assertFalse(a.current(token))
        assertTrue(a.beforeLegacySpeech())
    }
    @Test fun closedArbiterCannotBeReused(){
        val a=GuidanceAudioArbiter({true},{true},{true})
        val token=a.acquire(true)!!;a.close();assertFalse(a.current(token))
        assertFalse(a.beforeLegacySpeech());assertFalse(a.explicitStop());assertNull(a.acquire(true))
    }
}
