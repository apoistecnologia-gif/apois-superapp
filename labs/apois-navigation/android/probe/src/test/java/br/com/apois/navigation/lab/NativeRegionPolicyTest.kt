package br.com.apois.navigation.lab
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File
import java.security.MessageDigest

class NativeRegionPolicyTest {
    private fun hash(b:ByteArray)=MessageDigest.getInstance("SHA-256").digest(b).joinToString(""){"%02x".format(it.toInt() and 255)}
    private fun fixture():ByteArray=ByteArrayOutputStream().also{b->
        DataOutputStream(b).use{out->
            out.writeInt(0x41505231);out.writeInt(1);out.writeInt(2)
            for(r in listOf(doubleArrayOf(-42.0,-8.0,-41.0,-8.0,-41.0,-7.0,-42.0,-7.0,-42.0,-8.0),
                doubleArrayOf(-41.8,-7.8,-41.7,-7.8,-41.7,-7.7,-41.8,-7.7,-41.8,-7.8))){
                out.writeInt(r.size/2);r.forEach{out.writeDouble(it)}
            }
        }
    }.toByteArray()
    @Test fun strictRegionPolicy(){
        val b=fixture();val p=NativeRegionPolicy.read(b,hash(b))
        assertTrue(p.contains(-7.4,-41.4))
        for(v in listOf(-7.75 to -41.75,-8.0 to -42.0,0.0 to 0.0,Double.NaN to -41.0))assertFalse(p.contains(v.first,v.second))
        assertTrue(runCatching{NativeRegionPolicy.read(b,"0".repeat(64))}.isFailure)
        val extra=b+byteArrayOf(1);assertTrue(runCatching{NativeRegionPolicy.read(extra,hash(extra))}.isFailure)
        val truncated=b.copyOf(b.size-1);assertTrue(runCatching{NativeRegionPolicy.read(truncated,hash(truncated))}.isFailure)
    }
    @Test fun explicitScopeDoesNotWidenLegacyDefault(){
        val bytes=fixture()
        val region=RouteRegion.Verified(NativeRegionPolicy.read(bytes,hash(bytes)))
        val a=RegionalPoint(-7.4,-41.4);val b=RegionalPoint(-7.41,-41.41)
        val outside=RegionalPoint(-9.4,-40.5)
        val hole=RegionalPoint(-7.75,-41.75)
        assertFalse(routeEndpointsMatch(listOf(a,b),a,b))
        assertTrue(routeEndpointsMatch(listOf(a,b),a,b,region))
        assertFalse(routeEndpointsMatch(listOf(a,hole,b),a,b,region))
        assertFalse(routeEndpointsMatch(listOf(a,outside,b),a,b,region))
        assertFalse(routeEndpointsMatch(listOf(a,b),a,outside,region))
        val owner=LegRouteResources("pilot",Leg.TRIP,b,region){_,_->"route"}
        val attachment=owner.attach(LegToken("pilot",Leg.TRIP,1))!!
        owner.remember(attachment,a,"route",1000)
        assertEquals("route",owner.cached(attachment,a,1001))
        owner.remember(attachment,outside,"wrong",1000)
        assertNull(owner.cached(attachment,outside,1001))
        assertFalse(mayApplyReroute(true,true,true,GpsQuality.AVAILABLE,true,1000,1000,5.0,listOf(a,b),a,b))
        assertTrue(mayApplyReroute(true,true,true,GpsQuality.AVAILABLE,true,1000,1000,5.0,listOf(a,b),a,b,region))
        assertFalse(mayApplyReroute(true,true,true,GpsQuality.AVAILABLE,true,12000,1000,5.0,listOf(a,b),a,b,region))
    }
    @Test fun capabilityIsBoundToRegionDestinationAndCurrentSession()=kotlinx.coroutines.runBlocking{
        val bytes=fixture()
        val region=RouteRegion.Verified(NativeRegionPolicy.read(bytes,hash(bytes)))
        val a=RegionalPoint(-7.4,-41.4);val b=RegionalPoint(-7.41,-41.41)
        val identity=RoutingIdentity("00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000003")
        val target=ApprovedIndependentTarget(identity,"00000000-0000-4000-8000-000000000004",RidePhase.TRIP,b,RoutingTargetSource.INDEPENDENT_OSM)
        val token="a".repeat(32)+"."+"b".repeat(86)
        var calls=0;var current=true
        val issuer=RouteCapabilityIssuer{_,_->calls++;token}
        val legacy=RouteCapabilityScope(target,{true},issuer)
        assertNull(legacy.acquire(a,b))
        val scope=RouteCapabilityScope(target,{current},issuer,region)
        assertNull(scope.acquire(RegionalPoint(-7.75,-41.75),b))
        assertNull(scope.acquire(a,a))
        assertEquals(0,calls)
        assertNotNull(scope.acquire(a,b))
        current=false
        assertNull(scope.acquire(a,b))
        assertEquals(1,calls)
    }
    @Test fun realBoundaryWhenRequested(){
        val path=System.getenv("APOIS_NATIVE_REGION_FIXTURE")?:return
        val sha=System.getenv("APOIS_NATIVE_REGION_SHA256")?:error("missing fixture hash")
        val samples=System.getenv("APOIS_NATIVE_REGION_SAMPLES")?:error("missing samples")
        val policy=NativeRegionPolicy.read(File(path).readBytes(),sha)
        var count=0
        File(samples).forEachLine{line->
            val v=line.split("\t");require(v.size==4)
            assertEquals(v[0],v[3]=="1",policy.contains(v[1].toDouble(),v[2].toDouble()))
            count++
        }
        assertEquals(17,count)
        // This candidate must not silently enable the current Android host.
        assertFalse(RegionalPoint(-7.45,-41.48).valid())
        println("APOIS_NATIVE_REGION_OK samples=$count")
    }
}
