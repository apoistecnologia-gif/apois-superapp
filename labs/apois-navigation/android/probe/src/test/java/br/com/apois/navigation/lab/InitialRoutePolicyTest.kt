package br.com.apois.navigation.lab
import org.junit.Assert.*
import org.junit.Test
class InitialRoutePolicyTest{
    private val identity=RoutingIdentity("00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000003")
    private val ride=RideSnapshot("00000000-0000-4000-8000-000000000004",RidePhase.PICKUP,0,"Destino",null,null)
    private val origin=RegionalPoint(-9.40,-40.50)
    private val target=RegionalPoint(-9.42,-40.52)
    private val evidence=VerifiedRouteEvidence(identity,ride,target,RoutingTargetSource.INDEPENDENT_GPS,0,1000)
    private val fix=InitialRouteFix(origin,10.0,1000)
    @Test fun independentEvidenceAndFreshPhysicalFix(){
        assertTrue(initialRouteMatches(evidence,fix,listOf(origin,target),6000))
        assertFalse(initialRouteMatches(evidence,fix,listOf(origin,target),6001))
        assertFalse(evidence.copy(verifiedAt=6001).usable(6000))
    }
    @Test fun providerUnknownAndMultiStopRejected(){
        for(source in listOf(RoutingTargetSource.GOOGLE,RoutingTargetSource.UNKNOWN))assertFalse(evidence.copy(source=source).usable(1000))
        assertFalse(evidence.copy(intermediateStops=1).usable(1000))
        assertFalse(evidence.copy(intermediateStops=-1).usable(1000))
    }
    @Test fun missingIdentityAndInvalidPhaseRejected(){
        assertFalse(evidence.copy(identity=identity.copy(driverId="")).usable(1000))
        for(phase in listOf(RidePhase.WAITING_PIN,RidePhase.COMPLETED,RidePhase.CANCELLED))
            assertFalse(evidence.copy(ride=ride.copy(phase=phase)).usable(1000))
    }
    @Test fun accountAndDestinationAndLegCannotChangeUnderAnExistingRequest(){
        assertFalse(sameRoutingLeg(evidence,evidence.copy(identity=identity.copy(authUserId=identity.profileUserId))))
        assertFalse(sameRoutingLeg(evidence,evidence.copy(ride=ride.copy(phase=RidePhase.TRIP))))
        assertFalse(sameRoutingLeg(evidence,evidence.copy(target=origin)))
        assertFalse(sameRoutingLeg(evidence,evidence.copy(source=RoutingTargetSource.INDEPENDENT_OSM)))
        assertTrue(sameRoutingLeg(evidence,evidence.copy(ride=ride.copy(revision=1),verifiedAt=2000)))
    }
    @Test fun heartbeatNeedsFreshEvidenceAndUnchangedSnapshot(){
        val next=evidence.copy(verifiedAt=2000)
        assertTrue(mayRenewRouteEvidence(evidence,next,2000))
        assertFalse(mayRenewRouteEvidence(evidence,evidence,2000))
        assertFalse(mayRenewRouteEvidence(evidence,next.copy(ride=ride.copy(destination="Outro")),2000))
        assertTrue(mayRenewRouteEvidence(evidence,next.copy(ride=ride.copy(revision=1,destination="Outro")),2000))
        assertFalse(mayRenewRouteEvidence(evidence.copy(ride=ride.copy(revision=2)),next,2000))
        assertFalse(mayRenewRouteEvidence(evidence,next.copy(ride=ride.copy(phase=RidePhase.TRIP)),2000))
        assertFalse(mayRenewRouteEvidence(evidence,next,8000))
    }
    @Test fun oneInitialRequestPerLegInProcessEvenAfterFailure(){
        val admission=InitialRouteAdmission(2)
        assertTrue(admission.reserve(evidence))
        assertFalse(admission.available(evidence))
        assertFalse(admission.reserve(evidence.copy(verifiedAt=2000)))
        val trip=evidence.copy(ride=ride.copy(phase=RidePhase.TRIP))
        assertTrue(admission.reserve(trip))
        assertFalse(admission.reserve(trip))
        val another=evidence.copy(ride=ride.copy(rideId="00000000-0000-4000-8000-000000000009"))
        assertFalse(admission.reserve(another))
    }
    @Test fun onlyFailedLocalPreparationMayRetryOnceWithFreshProof(){
        val admission=InitialRouteAdmission(1)
        assertTrue(admission.reserve(evidence,1000,true))
        assertFalse(admission.available(evidence.copy(verifiedAt=30_999),30_999,true))
        val fresh=evidence.copy(verifiedAt=31_000)
        assertFalse(admission.available(fresh,31_000,false))
        assertFalse(admission.available(fresh.copy(identity=identity.copy(driverId=identity.profileUserId)),31_000,true))
        assertTrue(admission.reserve(fresh,31_000,true))
        assertFalse(admission.available(evidence.copy(verifiedAt=61_000),61_000,true))
    }
    @Test fun preparedLocalAndRemoteAttemptsNeverReopen(){
        val local=InitialRouteAdmission()
        assertTrue(local.reserve(evidence,1000,true))
        local.markPrepared(evidence)
        val fresh=evidence.copy(verifiedAt=31_000)
        assertFalse(local.available(fresh,31_000,true))
        val remote=InitialRouteAdmission()
        assertTrue(remote.reserve(evidence))
        assertFalse(remote.available(fresh,31_000,true))
    }
    @Test fun acknowledgedLocalReentryRequiresCooldownFreshSameIdentityAndRetainsBudget(){
        val admission=InitialRouteAdmission()
        assertTrue(admission.reserve(evidence,1000,true))
        val budget=admission.budgetFor(evidence)!!
        admission.markPrepared(evidence)
        val ticket=admission.closeTicket(evidence)!!
        val fresh=evidence.copy(verifiedAt=32_000)
        assertFalse(admission.available(fresh,32_000,true))
        assertTrue(admission.markActivityClosed(ticket,2000))
        assertFalse(admission.markActivityClosed(ticket,3000))
        assertFalse(admission.available(evidence.copy(verifiedAt=31_999),31_999,true))
        assertFalse(admission.available(fresh.copy(identity=identity.copy(driverId=identity.profileUserId)),32_000,true))
        assertTrue(admission.reserve(fresh,32_000,true))
        assertSame(budget,admission.budgetFor(fresh))
        assertFalse(admission.markActivityClosed(ticket,33_000))
        admission.markPrepared(fresh)
        assertTrue(admission.markActivityClosed(admission.closeTicket(fresh)!!,33_000))
        assertFalse(admission.available(evidence.copy(verifiedAt=63_000),63_000,true))
    }
    @Test fun impreciseStaleOrMovedOriginRejected(){
        assertFalse(initialRouteMatches(evidence,fix.copy(accuracy=25.1),listOf(origin,target),2000))
        assertFalse(initialRouteMatches(evidence.copy(verifiedAt=12000),fix,listOf(origin,target),12000))
        assertFalse(initialRouteMatches(evidence,fix.copy(point=RegionalPoint(-9.45,-40.50)),listOf(origin,target),2000))
        assertFalse(initialRouteMatches(evidence,fix,listOf(origin,RegionalPoint(-9.60,-40.30)),2000))
    }
}
