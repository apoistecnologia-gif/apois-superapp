package br.com.apois.navigation.lab

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class RegionalMapPreflightTest{
    @Test fun invalidOwnerDoesNotReadMap()=runBlocking{
        var loads=0
        assertNull(preflightRegionalMap({false}){loads++;Any()})
        assertEquals(0,loads)
    }
    @Test fun missingOrCorruptMapDoesNotAuthorizeRoute()=runBlocking{
        assertNull(preflightRegionalMap<Any>({true}){null})
    }
    @Test fun revocationDuringLocalInstallRejectsResult()=runBlocking{
        var current=true
        val result=preflightRegionalMap({current}){current=false;Any()}
        assertNull(result)
    }
    @Test fun exactlyVerifiedResultIsReturnedForCurrentOwner()=runBlocking{
        val map=Any()
        assertSame(map,preflightRegionalMap({true}){map})
    }
    @Test fun cancellationIsNotTreatedAsSuccessfulVerification()=runBlocking{
        var cancelled=false
        try{preflightRegionalMap<Any>({true}){throw CancellationException("test")}}
        catch(_:CancellationException){cancelled=true}
        assertTrue(cancelled)
    }
}
