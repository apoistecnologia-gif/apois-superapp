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
