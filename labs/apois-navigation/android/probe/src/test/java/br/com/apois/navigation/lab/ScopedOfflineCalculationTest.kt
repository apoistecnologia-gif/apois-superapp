package br.com.apois.navigation.lab
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.CancellationException
import org.junit.Assert.*
import org.junit.Test

class ScopedOfflineCalculationTest{
    private val identity=RoutingIdentity("00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000003")
    private val id="00000000-0000-4000-8000-000000000004"
    private val origin=RegionalPoint(-9.4,-40.5)
    private val destination=RegionalPoint(-9.42,-40.51)
    private val target=ApprovedIndependentTarget(identity,id,RidePhase.PICKUP,destination,RoutingTargetSource.INDEPENDENT_OSM)
    private val proof=routeEvidenceFromRead(NativeVerifiedRide(identity,id,RidePhase.PICKUP,0,1000,"carros"),target,2000)!!
    private fun guard(t:ApprovedIndependentTarget=target,current:()->Boolean={true},pack:()->Boolean={true},
        evidence:suspend ()->VerifiedRouteEvidence?={proof},now:()->Long={2000},
        calc:suspend (RegionalPoint,RegionalPoint)->List<RegionalPoint> = {a,b->listOf(a,b)})=
        ScopedOfflineCalculation(t,current,pack,evidence,now,calc,{it})
    @Test fun validExactLeg()=runBlocking{
        var reads=0
        val g=guard(evidence={reads++;proof})
        assertEquals(listOf(origin,destination),g.resolve(origin,destination));assertEquals(2,reads)
    }
    @Test fun wrongTargetSourceAndMissingPackNeverCalculate()=runBlocking{
        var calls=0
        val never:suspend (RegionalPoint,RegionalPoint)->List<RegionalPoint> = {a,b->calls++;listOf(a,b)}
        for(g in listOf(guard(t=target.copy(source=RoutingTargetSource.GOOGLE),calc=never),guard(pack={false},calc=never),guard(evidence={null},calc=never))){
            assertTrue(runCatching{g.resolve(origin,destination)}.isFailure)
        }
        assertTrue(runCatching{guard(calc=never).resolve(origin,origin)}.isFailure)
        assertEquals(0,calls)
    }
    @Test fun revocationAndExpiredEvidenceRejectDelayedRoute()=runBlocking{
        var active=true
        val g=guard(current={active},calc={a,b->active=false;listOf(a,b)})
        assertTrue(runCatching{g.resolve(origin,destination)}.isFailure)
        var time=2000L
        val h=guard(now={time},calc={a,b->time=7000;listOf(a,b)})
        assertTrue(runCatching{h.resolve(origin,destination)}.isFailure)
    }
    @Test fun packChangeAndGeometryOutsideScopeRejected()=runBlocking{
        var pack=true
        val g=guard(pack={pack},calc={a,b->pack=false;listOf(a,b)})
        assertTrue(runCatching{g.resolve(origin,destination)}.isFailure)
        val h=guard(calc={a,b->listOf(a,RegionalPoint(0.0,0.0),b)})
        assertTrue(runCatching{h.resolve(origin,destination)}.isFailure)
    }
    @Test fun cancellationPropagates()=runBlocking{
        val g=guard(calc={_,_->throw CancellationException("test")})
        var caught=false
        try{g.resolve(origin,destination)}catch(_:CancellationException){caught=true}
        assertTrue(caught)
    }
}
