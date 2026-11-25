package br.com.apois.navigation.lab

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class RouteCapabilityScopeTest{
    private val identity=RoutingIdentity("00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000003")
    private val target=ApprovedIndependentTarget(identity,"00000000-0000-4000-8000-000000000004",RidePhase.PICKUP,
        RegionalPoint(-9.42,-40.51),RoutingTargetSource.INDEPENDENT_OSM)
    private val origin=RegionalPoint(-9.4,-40.5)
    private val token="a".repeat(32)+"."+"b".repeat(86)
    @Test fun onlyExactCurrentLegAndDestinationCanRequestCapability()=runBlocking{
        var calls=0
        val scope=RouteCapabilityScope(target,{true},RouteCapabilityIssuer{leg,point->
            calls++;assertEquals(target,leg);assertEquals(origin,point);token})
        assertNull(scope.acquire(origin,RegionalPoint(-9.43,-40.51)))
        assertNull(scope.acquire(RegionalPoint(0.0,0.0),target.point))
        assertEquals(0,calls)
        val capability=scope.acquire(origin,target.point)!!
        assertEquals("Bearer "+token,capability.header())
        assertEquals("RouteCapability(redacted)",capability.toString())
        assertEquals(1,calls)
    }
    @Test fun sourceWithoutIndependentEvidenceNeverCallsIssuer()=runBlocking{
        for(source in listOf(RoutingTargetSource.GOOGLE,RoutingTargetSource.UNKNOWN)){
            val scope=RouteCapabilityScope(target.copy(source=source),{true},RouteCapabilityIssuer{_,_->throw AssertionError("must not issue")})
            assertNull(scope.acquire(origin,target.point))
        }
    }
    @Test fun revocationDuringIssueRejectsDelayedCredential()=runBlocking{
        var active=true
        val scope=RouteCapabilityScope(target,{active},RouteCapabilityIssuer{_,_->active=false;token})
        assertNull(scope.acquire(origin,target.point))
        assertFalse(scope.authorized(origin,target.point))
    }
    @Test fun refusesMissingMalformedOrAccountJwtCredentials()=runBlocking{
        for(raw in listOf(null,"","Bearer "+token,"a.b.c","a\r\n.b","a."+"b".repeat(85),"a".repeat(1501)+"."+"b".repeat(86))){
            val scope=RouteCapabilityScope(target,{true},RouteCapabilityIssuer{_,_->raw})
            assertNull(scope.acquire(origin,target.point))
        }
    }
    @Test fun everyRequestObtainsFreshCapabilityWithoutCache()=runBlocking{
        var calls=0
        val scope=RouteCapabilityScope(target,{true},RouteCapabilityIssuer{_,_->calls++;token})
        assertNotNull(scope.acquire(origin,target.point))
        assertNotNull(scope.acquire(origin,target.point))
        assertEquals(2,calls)
    }
    @Test fun cancellationPropagates()=runBlocking{
        val scope=RouteCapabilityScope(target,{true},RouteCapabilityIssuer{_,_->throw CancellationException("test")})
        var cancelled=false
        try{scope.acquire(origin,target.point)}catch(_:CancellationException){cancelled=true}
        assertTrue(cancelled)
    }
}
