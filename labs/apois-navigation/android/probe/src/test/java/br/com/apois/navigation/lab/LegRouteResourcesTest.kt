package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test
import br.com.apois.navigation.lab.NativeRerouteGate.Decision
import br.com.apois.navigation.lab.NativeRerouteGate.Reason

class LegRouteResourcesTest {
    private val a=RegionalPoint(-9.4039,-40.5040)
    private val b=RegionalPoint(-9.4165,-40.5035)
    private val token=LegToken("ride",Leg.PICKUP,1)
    private fun owner()=LegRouteResources("ride",Leg.PICKUP,b) { _,_ -> "route" }
    private fun NativeRerouteGate.fix(t:Long)=evaluate(t,t,5.0,80.0,true)
    @Test fun recreationRetainsBudgetAndPendingTicket() {
        val o=owner()
        val first=o.attach(token)!!
        o.budget.fix(1000)
        val ticket=(o.budget.fix(2000) as Decision.Request).ticket
        o.detach(first)
        val second=o.attach(token.copy(generation=2))!!
        assertFalse(o.accepts(first));assertTrue(o.accepts(second))
        o.budget.fix(18000)
        assertEquals(Decision.Hold(Reason.IN_FLIGHT),o.budget.fix(19000))
        assertEquals(1,o.budget.requests)
        assertTrue(o.budget.settle(ticket))
        assertTrue(o.budget.fix(20000) is Decision.Request)
        assertEquals(2,o.budget.requests)
    }
    @Test fun rejectsOtherRideLegAndSimultaneousConsumer() {
        val o=owner()
        assertNull(o.attach(token.copy(rideId="other")))
        assertNull(o.attach(token.copy(leg=Leg.TRIP)))
        assertNotNull(o.attach(token))
        assertNull(o.attach(token))
    }
    @Test fun exactOriginCacheExpiresAndDoesNotCrossOwners() {
        val o=owner();val x=o.attach(token)!!
        o.remember(x,a,"route",1000)
        assertEquals("route",o.cached(x,a,30999))
        assertNull(o.cached(x,a.copy(lat=a.lat+0.000001),2000))
        val other=owner();val y=other.attach(token)!!
        assertNull(other.cached(y,a,2000))
        assertNull(o.cached(x,a,31000))
    }
    @Test fun cacheIsBoundedAndLru() {
        val o=owner();val x=o.attach(token)!!
        val points=(0..4).map { a.copy(lat=a.lat+it*0.00001) }
        for(i in 0..3)o.remember(x,points[i],"r"+i,1000)
        assertEquals("r0",o.cached(x,points[0],1001))
        o.remember(x,points[4],"r4",1002)
        assertNull(o.cached(x,points[1],1003))
        assertEquals("r0",o.cached(x,points[0],1003))
    }
    @Test fun staleAttachmentCannotReadOrWriteAndCloseIsFinal() {
        val o=owner();val x=o.attach(token)!!
        o.remember(x,a,"old",1000)
        o.detach(x)
        val y=o.attach(token)!!
        o.remember(x,a,"late",1001)
        assertNull(o.cached(x,a,1002))
        assertEquals("old",o.cached(y,a,1002))
        o.close()
        assertFalse(o.accepts(y))
        assertNull(o.cached(y,a,1003))
        assertNull(o.attach(token))
        assertEquals(Decision.Hold(Reason.CLOSED),o.budget.fix(2000))
    }
    @Test fun monotonicClockRegressionInvalidatesCache() {
        val o=owner();val x=o.attach(token)!!
        o.remember(x,a,"route",1000)
        assertNull(o.cached(x,a,999))
    }
}
