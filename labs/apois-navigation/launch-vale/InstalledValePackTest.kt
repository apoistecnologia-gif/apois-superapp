package br.com.apois.navigation.embedded

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import android.os.SystemClock
import android.util.Log
import com.valhalla.config.ValhallaConfigBuilder
import com.valhalla.valhalla.Valhalla
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import uniffi.ferrostar.*
import kotlin.math.*
import br.com.apois.navigation.lab.OfflinePackStore
import br.com.apois.navigation.lab.OfflinePackSpec
import br.com.apois.navigation.lab.OfflinePackFile
import br.com.apois.navigation.lab.PilotSearchCatalog
import br.com.apois.navigation.lab.PilotSearchCandidate

/** Only fixed public reference coordinates and a version-matched graph. */
@RunWith(AndroidJUnit4::class)
class InstalledValePackTest {
    private data class Point(val lat:Double,val lng:Double){
        fun inside()=lat.isFinite()&&lng.isFinite()&&lat in -9.65..-9.10&&lng in -40.80..-40.20
        fun distance(other:Point):Double {
            val a=Math.toRadians(other.lat-lat);val b=Math.toRadians(other.lng-lng)
            val h=sin(a/2).pow(2)+cos(Math.toRadians(lat))*cos(Math.toRadians(other.lat))*sin(b/2).pow(2)
            return 12_742_000.0*asin(sqrt(h.coerceIn(0.0,1.0)))
        }
    }
    private fun body(a:Point,b:Point)=
        """{"locations":[{"lat":${a.lat},"lon":${a.lng},"type":"break"},{"lat":${b.lat},"lon":${b.lng},"type":"break"}],"costing":"auto","units":"kilometers","language":"pt-BR","format":"osrm","voice_instructions":true,"banner_instructions":true,"shape_format":"polyline6"}"""
    private fun digest(bytes:ByteArray)=MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it.toInt() and 255)}
    private fun validatedTile():br.com.apois.navigation.lab.VerifiedValeRuntimePack {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val pack=kotlinx.coroutines.runBlocking{br.com.apois.navigation.lab.VerifiedValeRuntimePack.install(context)}
        val dir=pack.directory
        assertEquals("89e4ed84a975713e74e67bcdba4b883caf1b85e1348c2496189c153a2629cfad",pack.identity)
        assertEquals(dir,kotlinx.coroutines.runBlocking{br.com.apois.navigation.lab.VerifiedValeRuntimePack.install(context)}.directory)
        val magic=ByteArray(7)
        java.io.DataInputStream(File(dir,"map.pmtiles").inputStream()).use{it.readFully(magic)}
        assertEquals("PMTiles",magic.toString(Charsets.US_ASCII))
        val json=JSONObject(File(dir,"search.json").readText())
        assertEquals("c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238",json.getString("extract_sha256"))
        assertFalse(json.getBoolean("active"))
        val rows=json.getJSONArray("rows");assertEquals(8676,rows.length())
        val candidates=(0 until rows.length()).map{ i->
            val r=rows.getJSONObject(i)
            PilotSearchCandidate(r.getString("id"),r.getString("kind"),r.getString("label"),
                r.getDouble("lat"),r.getDouble("lon"),r.getString("number"),r.getString("locality"))
        }
        val catalog=PilotSearchCatalog(candidates)
        for(city in listOf("Petrolina","Juazeiro")){
            assertTrue(catalog.find(city).any{it.kind=="place"&&it.label==city})
        }
        Log.i("APOIS_VALE_OFFLINE","pack_installed=true; search_rows="+rows.length())
        return pack
    }
    @Test fun observedPackChangeCannotResurrectLease(){
        val pack=validatedTile()
        val lease=kotlinx.coroutines.runBlocking{pack.acquireLease()}
        val original=pack.search.lastModified()
        assertTrue(lease.claim())
        try{
            assertTrue(pack.search.setLastModified(original-60_000L))
            assertFalse(lease.current())
        }finally{
            assertTrue(pack.search.setLastModified(original))
        }
        assertFalse(lease.current());assertFalse(lease.claim())
        val fresh=kotlinx.coroutines.runBlocking{pack.acquireLease()}
        try{assertTrue(fresh.claim());assertTrue(fresh.current())}finally{fresh.close()}
    }
    @Test fun verifyRegionalOfflineRoutesAndFerrostar(){
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val pack=validatedTile()
        val lease=kotlinx.coroutines.runBlocking{pack.acquireLease()}
        assertTrue(lease.claim());assertFalse(lease.claim());assertTrue(lease.current())
        try{
        val config=ValhallaConfigBuilder().withTileExtract(lease.graph.absolutePath).build()
        val adapter=RouteAdapter.fromWellKnownRouteProvider(WellKnownRouteProvider.Valhalla("https://navigation.invalid/route","auto"))
        val a=Point(-9.403901,-40.5040233);val b=Point(-9.397901,-40.4980233)
        val c=Point(-9.4165,-40.5035);val d=Point(-9.4225,-40.5095)
        val opened=SystemClock.elapsedRealtime()
        Valhalla(context,config).use{engine->
            Log.i("APOIS_VALE_OFFLINE","engine_open_ms="+(SystemClock.elapsedRealtime()-opened))
            fun checked(origin:Point,target:Point):Route{
                assertTrue(origin.inside()&&target.inside())
                val start=SystemClock.elapsedRealtime()
                assertTrue(lease.current())
                val raw=engine.routeRaw(body(origin,target))
                assertTrue(lease.current())
                val bytes=raw.toByteArray(Charsets.UTF_8);assertTrue(bytes.size in 1..2_000_000)
                val json=JSONObject(raw);assertEquals("Ok",json.getString("code"))
                val item=json.getJSONArray("routes").getJSONObject(0)
                assertTrue(item.getDouble("distance")>0&&item.getDouble("duration")>0)
                var voice=0;var banners=0
                val legs=item.getJSONArray("legs")
                for(i in 0 until legs.length()){
                    val steps=legs.getJSONObject(i).getJSONArray("steps")
                    for(j in 0 until steps.length()){
                        val step=steps.getJSONObject(j)
                        voice+=step.optJSONArray("voiceInstructions")?.length()?:0
                        banners+=step.optJSONArray("bannerInstructions")?.length()?:0
                    }
                }
                assertTrue("missing voice",voice>0);assertTrue("missing banners",banners>0)
                val parsed=adapter.parseResponse(bytes).first()
                val points=parsed.geometry.map{Point(it.lat,it.lng)}
                assertTrue(points.size in 2..100000&&points.all{it.inside()})
                assertTrue(points.first().distance(origin)<=150&&points.last().distance(target)<=150)
                Log.i("APOIS_VALE_OFFLINE","route_ms="+(SystemClock.elapsedRealtime()-start)+" voice="+voice+" banners="+banners)
                return parsed
            }
            checked(a,b);checked(c,d);checked(a,c);checked(c,a)
            val changed=checked(b,c)
            assertNotEquals(checked(a,c).geometry,changed.geometry)
            assertTrue(runCatching{engine.routeRaw(body(Point(-7.45,-41.48),c))}.isFailure)
            Log.i("APOIS_VALE_OFFLINE","reference_routes=4; changed_origin=true")
        }
        }finally{lease.close()}
        assertFalse(lease.current());assertFalse(lease.claim())
        val next=kotlinx.coroutines.runBlocking{pack.acquireLease()}
        try{assertTrue(next.claim());assertTrue(next.current())}finally{next.close()}
        Log.i("APOIS_VALE_OFFLINE","lease_single_use=true; revoked=true; reacquired=true")
    }
}
