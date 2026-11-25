package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test
import br.com.apois.navigation.lab.NativeRerouteGate.Decision

class ControllerRouteResourcesTest {
    private val target=RegionalPoint(-9.4165,-40.5035)
    private val resolver=LiveRouteResolver { _,_ -> error("not invoked by unit test") }
    private fun ride(phase:RidePhase=RidePhase.PICKUP,rev:Long=1)=
        RideSnapshot("ride-lab",phase,rev,"Destino",null,null)
    @Test fun onlyCurrentTokenCanCreateOwner() {
        val c=NavigationSessionController(ride())
        assertNull(c.routingFor(LegToken("ride-lab",Leg.PICKUP,1),target,resolver))
        c.enable()
        val token=c.token!!
        assertNotNull(c.routingFor(token,target,resolver))
        assertNull(c.routingFor(token.copy(generation=2),target,resolver))
    }
    @Test fun fallbackRetainsBudgetButInvalidatesAttachment() {
        val c=NavigationSessionController(ride());c.enable()
        val first=c.token!!
        val owner=c.routingFor(first,target,resolver)!!
        val attachment=owner.attach(first)!!
        owner.budget.evaluate(1000,1000,5.0,80.0,true)
        val req=owner.budget.evaluate(2000,2000,5.0,80.0,true) as Decision.Request
        c.disable()
        assertFalse(owner.accepts(attachment))
        assertTrue(owner.budget.isPending(req.ticket))
        c.enable()
        val second=c.token!!
        assertNotEquals(first,second)
        assertSame(owner,c.routingFor(second,target,resolver))
        assertEquals(1,owner.budget.requests)
        assertNotNull(owner.attach(second))
    }
    @Test fun phaseChangeAndCancellationCloseResources() {
        val c=NavigationSessionController(ride());c.enable()
        val pickup=c.token!!
        val owner=c.routingFor(pickup,target,resolver)!!
        val attachment=owner.attach(pickup)!!
        c.update(ride(RidePhase.WAITING_PIN,2))
        assertFalse(owner.accepts(attachment));assertNull(owner.attach(pickup))
        c.update(ride(RidePhase.TRIP,3))
        val trip=c.token!!
        val next=c.routingFor(trip,target,resolver)!!
        assertNotSame(owner,next)
        c.update(ride(RidePhase.CANCELLED,4))
        assertNull(next.attach(trip))
    }
    @Test fun changedTargetCannotResetBudgetAndStaleSnapshotDoesNotCloseOwner() {
        val c=NavigationSessionController(ride());c.enable()
        val token=c.token!!
        val owner=c.routingFor(token,target,resolver)!!
        assertNull(c.routingFor(token,target.copy(lat=target.lat+0.001),resolver))
        c.update(ride(RidePhase.CANCELLED,1))
        assertSame(owner,c.routingFor(token,target,resolver))
        c.close()
        assertNull(owner.attach(token))
    }
}
