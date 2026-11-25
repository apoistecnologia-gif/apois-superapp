package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test
class NativeConfirmedRoutePreparationTest{
    private val identity=RoutingIdentity("00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000003")
    private val id="00000000-0000-4000-8000-000000000004"
    private val proof=NativeVerifiedRide(identity,id,RidePhase.PICKUP,0,1000,"carros")
    private val target=ApprovedIndependentTarget(identity,id,RidePhase.PICKUP,RegionalPoint(-9.40,-40.50),RoutingTargetSource.INDEPENDENT_OSM)
    @Test fun independentEvidenceBindsExactlyToVerifiedRide(){
        val evidence=routeEvidenceFromRead(proof,target,2000)!!
        assertEquals(identity,evidence.identity)
        assertEquals(target.point,evidence.target)
        assertEquals("Embarque",evidence.ride.destination)
        assertNull(evidence.ride.passenger);assertNull(evidence.ride.totalLabel)
    }
    @Test fun unrelatedOrChangedProofRejected(){
        assertNull(routeEvidenceFromRead(proof.copy(identity=identity.copy(driverId=identity.authUserId)),target,2000))
        assertNull(routeEvidenceFromRead(proof.copy(rideId=identity.driverId),target,2000))
        assertNull(routeEvidenceFromRead(proof.copy(phase=RidePhase.TRIP),target,2000))
        assertNull(routeEvidenceFromRead(proof.copy(intermediateStops=1),target,2000))
        assertNull(routeEvidenceFromRead(proof.copy(category="motos"),target,2000))
        assertNull(routeEvidenceFromRead(proof,target,6001))
    }
    @Test fun unsupportedSourcesOrCoordinatesNeverBecomeRoutingEvidence(){
        assertNull(routeEvidenceFromRead(proof,target.copy(source=RoutingTargetSource.GOOGLE),2000))
        assertNull(routeEvidenceFromRead(proof,target.copy(source=RoutingTargetSource.UNKNOWN),2000))
        assertNull(routeEvidenceFromRead(proof,target.copy(point=RegionalPoint(0.0,0.0)),2000))
    }
}
