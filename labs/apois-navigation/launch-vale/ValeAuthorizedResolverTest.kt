package br.com.apois.navigation.lab

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Real bundled assets, MapLibre map preflight, JNI Valhalla and Ferrostar.
 * Authority is a synthetic in-memory fixture only, never an official backend. */
@RunWith(AndroidJUnit4::class)
class ValeAuthorizedResolverTest {
    @Test fun verifiedLocalFactoryAndRevocation(){
        runBlocking {
            val context=InstrumentationRegistry.getInstrumentation().targetContext
            val pack=VerifiedValeRuntimePack.install(context)
            val map=checkNotNull(BundledRegionalMap.VerifiedMap.load(context))
            val identity=RoutingIdentity("00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000003")
            val id="00000000-0000-4000-8000-000000000004"
            val origin=RegionalPoint(-9.403901,-40.5040233)
            val destination=RegionalPoint(-9.4165,-40.5035)
            val target=ApprovedIndependentTarget(identity,id,RidePhase.PICKUP,destination,RoutingTargetSource.INDEPENDENT_OSM)
            var active=true
            var reads=0
            var changeOnRead=Int.MAX_VALUE
            val request=ConfirmedHostRequest(id,RidePhase.PICKUP,0)
            val proof=DriverControlTarget(target,"00000000-0000-4000-8000-000000000005",1)
            val readTarget:suspend (ConfirmedHostRequest)->DriverControlTarget?={r->
                check(r==request)
                reads++
                if(!active)null else if(reads>=changeOnRead)proof.copy(version=2) else proof
            }
            assertNull(valeDriverGrant(context,pack,request,{false},readTarget))
            assertEquals(0,reads)
            val grant=checkNotNull(valeDriverGrant(context,pack,request,{active},readTarget))
            assertEquals(1,reads)
            assertNull(grant.issuer)
            val evidence=checkNotNull(grant.verifyEvidence)
            val factory=checkNotNull(grant.localFactory)
            var resolver:ManagedRouteResolver?=null
            try{
                assertNull(factory.open(target.copy(source=RoutingTargetSource.GOOGLE),map,{active},evidence))
                assertNull(factory.open(target.copy(point=RegionalPoint(-9.42,-40.51)),map,{active},evidence))
                val opened=checkNotNull(factory.open(target,map,{active},evidence))
                resolver=opened
                assertTrue(resolverResourcesCurrent(opened))
                assertNull(factory.open(target,map,{active},evidence))
                val route=opened.resolve(origin,destination)
                assertTrue(route.geometry.size>1)
                assertEquals(3,reads)
                assertTrue(runCatching{opened.resolve(origin,origin)}.isFailure)
                assertEquals(3,reads)
                // Revoke the simulated authority only after the JNI calculation.
                changeOnRead=5
                assertTrue(runCatching{opened.resolve(origin,destination)}.isFailure)
                assertEquals(5,reads)
                // A changed authority revision permanently revokes this
                // owner even if the old proof later reappears.
                assertFalse(grant.current())
                assertFalse(resolverResourcesCurrent(opened))
                changeOnRead=Int.MAX_VALUE
                assertTrue(runCatching{opened.resolve(origin,destination)}.isFailure)
                assertEquals(5,reads)
                opened.dispose()
                assertFalse(resolverResourcesCurrent(opened))
                assertFalse(grant.current())
            }finally{
                resolver?.dispose()
            }
            assertFalse(grant.current())
            assertNull(factory.open(target,map,{true},evidence))
            val fresh=checkNotNull(valeDriverGrant(context,pack,request,{active},readTarget))
            val nextFactory=checkNotNull(fresh.localFactory)
            val next=checkNotNull(nextFactory.open(target,map,{true},checkNotNull(fresh.verifyEvidence)))
            try{
                assertTrue(fresh.current());assertTrue(resolverResourcesCurrent(next))
                active=false
                assertFalse(fresh.current())
                active=true
                assertFalse(fresh.current());assertFalse(resolverResourcesCurrent(next))
            }finally{next.dispose()}
            android.util.Log.i("APOIS_VALE_AUTHORIZED","real_engine=true; real_map=true; synthetic_authority=true; revocation_rejected=true")
        }
    }
}
