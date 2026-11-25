package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test

class ConfirmedSessionVoiceTest{
    private class Permit:NavigationVoicePermit{
        var current=true
        var stopOk=true
        var stops=0
        var releases=0
        override fun isCurrent()=current
        override fun speak(text:String)=current
        override fun stop():Boolean{stops++;return stopOk}
        override fun release(){releases++;current=false}
    }
    @Test fun revocationWithoutGpsReleasesExactlyOnce(){
        val owner=ConfirmedSessionVoice()
        val p=Permit()
        val surface=owner.acquire{p}!!
        p.current=false
        owner.checkAuthority()
        assertEquals(1,p.releases)
        surface.release();owner.close()
        assertEquals(1,p.releases)
        assertNull(owner.acquire{Permit()})
    }
    @Test fun pauseStopsOnlyCurrentPermitAndAllowsSameLeaseToContinue(){
        val owner=ConfirmedSessionVoice()
        val p=Permit()
        val surface=owner.acquire{p}!!
        owner.pause()
        assertEquals(1,p.stops)
        assertTrue(surface.isCurrent())
        owner.close()
        assertEquals(1,p.releases)
    }
    @Test fun failedPauseOrMissingPermitNeverRetriesAcquisition(){
        val owner=ConfirmedSessionVoice()
        val p=Permit().apply{stopOk=false}
        owner.acquire{p}
        owner.pause()
        assertEquals(1,p.releases)
        assertNull(owner.acquire{Permit()})
        val silent=ConfirmedSessionVoice()
        assertNull(silent.acquire{null})
        assertNull(silent.acquire{Permit()})
    }
    @Test fun closingBeforeAcquisitionPreventsLateLease(){
        val owner=ConfirmedSessionVoice()
        owner.close()
        assertNull(owner.acquire{throw AssertionError("must not run")})
    }
}
