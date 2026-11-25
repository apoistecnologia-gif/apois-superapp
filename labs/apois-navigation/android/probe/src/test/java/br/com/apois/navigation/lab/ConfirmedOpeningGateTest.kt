package br.com.apois.navigation.lab
import org.junit.Assert.*
import org.junit.Test
class ConfirmedOpeningGateTest{
    private val identity=RoutingIdentity("00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000003")
    private val id="00000000-0000-4000-8000-000000000004"
    private val req=ConfirmedHostRequest(id,RidePhase.PICKUP,0)
    @Test fun cancelledTicketStillOccupiesUntilCleanup(){
        val gate=ConfirmedOpeningGate()
        val t=gate.begin(req)!!
        assertNull(gate.begin(req))
        assertTrue(gate.cancel(req));assertFalse(gate.current(t))
        assertNull(gate.begin(req))
        gate.finish(t)
        assertNotNull(gate.begin(req))
    }
    @Test fun unrelatedCancellationAndLateCleanupCannotAffectNewTicket(){
        val gate=ConfirmedOpeningGate()
        val t=gate.begin(req)!!
        assertFalse(gate.cancel(req.copy(phase=RidePhase.TRIP)));assertTrue(gate.current(t))
        gate.finish(t)
        val next=gate.begin(req.copy(phase=RidePhase.TRIP))!!
        gate.finish(t);assertTrue(gate.current(next))
    }
    @Test fun invalidPhaseRevisionAndTargetFailClosed(){
        val gate=ConfirmedOpeningGate()
        assertNull(gate.begin(req.copy(revision=1)))
        assertNull(gate.begin(req.copy(phase=RidePhase.WAITING_PIN)))
        assertNull(gate.begin(req.copy(rideId="invalid")))
        val target=ApprovedIndependentTarget(identity,id,RidePhase.PICKUP,RegionalPoint(-9.40,-40.50),RoutingTargetSource.INDEPENDENT_OSM)
        assertTrue(req.matches(target))
        assertFalse(req.matches(target.copy(phase=RidePhase.TRIP)))
        assertFalse(req.matches(target.copy(source=RoutingTargetSource.GOOGLE)))
    }
}
