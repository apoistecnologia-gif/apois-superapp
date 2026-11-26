package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test

class FieldDynamicRoutePolicyTest {
    private val a=RegionalPoint(-7.4475,-41.4786)
    private val b=RegionalPoint(-7.439992,-41.474246)
    private val fix=InitialRouteFix(a,2.5,1000)
    private fun start(f:InitialRouteFix=fix,now:Long=1000,current:Boolean=true,foreground:Boolean=true,
                      quality:GpsQuality=GpsQuality.AVAILABLE,geometry:List<RegionalPoint> = listOf(a,b))=
        fieldDynamicCanStart(current,foreground,quality,now,f,b,geometry)
    @Test fun requiresCurrentPreciseFreshGpsNearActualRoute(){
        assertTrue(start())
        assertFalse(start(f=fix.copy(point=a.copy(lat=a.lat+0.001))))
        assertFalse(start(now=6001))
        assertFalse(start(f=fix.copy(accuracy=21.0)))
        assertFalse(start(current=false))
        assertFalse(start(foreground=false))
        assertFalse(start(quality=GpsQuality.LOST))
        assertFalse(start(geometry=listOf(a,RegionalPoint(-9.4,-40.5),b)))
        assertFalse(start(geometry=emptyList()))
        assertFalse(routeEndpointsMatch(listOf(a,b),a,b))
    }
    @Test fun shortLivedLabSecretAndStrictEndpoint(){
        val s=FieldLabSecret.parse("a".repeat(64),1000)!!
        assertTrue(s.valid(900999));assertFalse(s.valid(901000));assertFalse(s.valid(999))
        assertEquals("FieldLabSecret(redacted)",s.toString())
        assertNull(FieldLabSecret.parse("a.b.c",1000))
        assertEquals("/route",validatedRouteEndpoint("https://lab.example/route","lab.example").path)
        for(raw in listOf("http://lab.example/route","https://other.example/route","https://lab.example/route?x=1","https://lab.example:444/route")){
            assertTrue(runCatching{validatedRouteEndpoint(raw,"lab.example")}.isFailure)
        }
    }
}
