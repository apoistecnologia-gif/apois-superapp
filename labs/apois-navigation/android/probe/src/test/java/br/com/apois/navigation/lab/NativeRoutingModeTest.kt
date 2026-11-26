package br.com.apois.navigation.lab
import org.junit.Assert.*
import org.junit.Test
class NativeRoutingModeTest{
    @Test fun noSilentFallbackOrMixedMode(){
        assertTrue(nativeRoutingModeMatches(true,true,false))
        assertTrue(nativeRoutingModeMatches(false,false,true))
        for(local in listOf(false,true))for(factory in listOf(false,true))for(issuer in listOf(false,true)){
            val expected=(local&&factory&&!issuer)||(!local&&!factory&&issuer)
            assertEquals(expected,nativeRoutingModeMatches(local,factory,issuer))
        }
    }
}
