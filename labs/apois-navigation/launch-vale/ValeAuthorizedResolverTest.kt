package br.com.apois.navigation.lab

import android.os.SystemClock
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
            val lease=pack.acquireLease()
            var active=true
            var reads=0
            var revokeOnRead=Int.MAX_VALUE
            val evidence:suspend ()->VerifiedRouteEvidence?={
                reads++
                if(reads>=revokeOnRead)active=false
                val now=SystemClock.elapsedRealtime()
                if(!active)null else routeEvidenceFromRead(NativeVerifiedRide(identity,id,RidePhase.PICKUP,0,now,"carros"),target,now)
            }
            val factory=valeLocalFactory(context,lease)
            var resolver:ManagedRouteResolver?=null
            try{
                assertNull(factory.open(target.copy(source=RoutingTargetSource.GOOGLE),map,{active},evidence))
                val opened=checkNotNull(factory.open(target,map,{active},evidence))
                resolver=opened
                assertNull(factory.open(target,map,{active},evidence))
                val route=opened.resolve(origin,destination)
                assertTrue(route.geometry.size>1)
                assertEquals(2,reads)
                assertTrue(runCatching{opened.resolve(origin,origin)}.isFailure)
                assertEquals(2,reads)
                // Revoke the simulated authority only after the JNI calculation.
                revokeOnRead=4
                assertTrue(runCatching{opened.resolve(origin,destination)}.isFailure)
                assertEquals(4,reads)
                assertFalse(active)
                assertTrue(runCatching{opened.resolve(origin,destination)}.isFailure)
                assertEquals(4,reads)
            }finally{
                resolver?.dispose()
                lease.close()
            }
            assertFalse(lease.current())
            assertFalse(lease.claim())
            android.util.Log.i("APOIS_VALE_AUTHORIZED","real_engine=true; real_map=true; synthetic_authority=true; revocation_rejected=true")
        }
    }
}
