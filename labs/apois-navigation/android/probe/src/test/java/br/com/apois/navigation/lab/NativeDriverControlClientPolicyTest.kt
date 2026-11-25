package br.com.apois.navigation.lab
import org.junit.Assert.*
import org.junit.Test

class NativeDriverControlClientPolicyTest{
    private val identity=RoutingIdentity("00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000003")
    private val id="00000000-0000-4000-8000-000000000004"
    private val evidence="00000000-0000-4000-8000-000000000005"
    private val target=DriverControlTarget(ApprovedIndependentTarget(identity,id,RidePhase.PICKUP,RegionalPoint(-9.4,-40.5),RoutingTargetSource.INDEPENDENT_OSM),evidence,1)
    @Test fun onlySameVerifiedEvidenceRevisionCanRenew(){
        assertTrue(target.matches(ConfirmedHostRequest(id,RidePhase.PICKUP,0)))
        assertFalse(target.matches(ConfirmedHostRequest(id,RidePhase.TRIP,0)))
        assertTrue(target.currentProof(target.copy()))
        assertFalse(target.currentProof(target.copy(version=2)))
        assertFalse(target.currentProof(target.copy(approved=target.approved.copy(point=RegionalPoint(-9.41,-40.5)))))
        assertFalse(target.copy(approved=target.approved.copy(source=RoutingTargetSource.GOOGLE)).usable())
        assertFalse(target.copy(approved=target.approved.copy(identity=identity.copy(driverId="wrong"))).usable())
        val proof=target.evidence(1000L)!!
        assertEquals(target.approved.point,proof.target)
        assertNull(proof.ride.passenger)
    }
    @Test fun permitIsOnlyForExactRidePhaseAndEvidence(){
        val grant=DriverControlPermit(id,RidePhase.PICKUP,evidence,1,"a".repeat(32)+"."+"b".repeat(86))
        assertTrue(grant.matches(target))
        assertFalse(grant.copy(version=2).matches(target))
        assertFalse(grant.copy(phase=RidePhase.TRIP).matches(target))
        assertFalse(grant.copy(token="a.b.c").matches(target))
        assertEquals("DriverControlPermit(redacted)",grant.toString())
    }
}
