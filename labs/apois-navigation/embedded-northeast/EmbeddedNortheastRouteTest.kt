package br.com.apois.navigation.embedded

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import android.os.Debug
import android.os.SystemClock
import android.util.Log
import com.valhalla.config.ValhallaConfigBuilder
import com.valhalla.valhalla.Valhalla
import java.io.File
import java.security.MessageDigest
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import uniffi.ferrostar.*
import kotlin.math.*

/** Disposable CI: only published sample points, no user location or network. */
@RunWith(AndroidJUnit4::class)
class EmbeddedNortheastRouteTest{
    private data class Point(val lat:Double,val lon:Double){
        fun distance(other:Point):Double{
            val a=Math.toRadians(other.lat-lat);val b=Math.toRadians(other.lon-lon)
            val h=sin(a/2).pow(2)+cos(Math.toRadians(lat))*cos(Math.toRadians(other.lat))*sin(b/2).pow(2)
            return 12_742_000.0*asin(sqrt(h.coerceIn(0.0,1.0)))
        }
    }
    private fun point(a:JSONArray)=Point(a.getDouble(0),a.getDouble(1))
    private fun body(a:Point,b:Point)=JSONObject().put("locations",JSONArray().apply{
        for(p in listOf(a,b))put(JSONObject().put("lat",p.lat).put("lon",p.lon).put("type","break"))
    }).put("costing","auto").put("units","kilometers").put("language","pt-BR").put("format","osrm")
        .put("voice_instructions",true).put("banner_instructions",true).put("shape_format","polyline6").toString()
    @Test fun fullGraphRoutes(){
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val manifest=JSONObject(context.assets.open("graph-index-report.json").bufferedReader().use{it.readText()})
        assertEquals("3.6.3",manifest.getString("engine_version"))
        assertEquals(2397,manifest.getInt("tiles"))
        assertEquals(877875200L,manifest.getLong("bytes"))
        val file=File(context.filesDir,"ne-graph.tar")
        assertEquals(manifest.getLong("bytes"),file.length())
        val md=MessageDigest.getInstance("SHA-256")
        file.inputStream().use{input->val b=ByteArray(65536);while(true){val n=input.read(b);if(n<0)break;md.update(b,0,n)}}
        assertEquals(manifest.getString("sha256"),md.digest().joinToString(""){"%02x".format(it.toInt() and 255)})
        val samples=JSONObject(context.assets.open("samples.json").bufferedReader().use{it.readText()})
        val cases=mutableListOf<Triple<String,Point,Point>>()
        val cities=samples.getJSONArray("cities")
        for(i in 0 until cities.length()){
            val c=cities.getJSONArray(i);val a=Point(c.getDouble(2),c.getDouble(3))
            cases.add(Triple(c.getString(0)+" "+c.getString(1),a,Point(a.lat+0.006,a.lon+0.006)))
        }
        val crossings=samples.getJSONArray("crossings")
        for(i in 0 until crossings.length()){
            val c=crossings.getJSONArray(i);cases.add(Triple(c.getString(0),point(c.getJSONArray(1)),point(c.getJSONArray(2))))
        }
        assertEquals(15,cases.size)
        val config=ValhallaConfigBuilder().withTileExtract(file.absolutePath).build()
        val adapter=RouteAdapter.fromWellKnownRouteProvider(WellKnownRouteProvider.Valhalla("https://navigation.invalid/route","auto"))
        val opened=SystemClock.elapsedRealtime()
        Valhalla(context,config).use{engine->
            Log.i("APOIS_NE_OFFLINE","engine_open_ms="+(SystemClock.elapsedRealtime()-opened)+" pss_kb="+Debug.getPss())
            val rejected=mutableListOf<String>()
            for((label,a,b) in cases){
                val t=SystemClock.elapsedRealtime()
                val raw=engine.routeRaw(body(a,b)).toByteArray(Charsets.UTF_8)
                assertTrue(raw.size in 1..2_000_000)
                val json=JSONObject(raw.toString(Charsets.UTF_8));assertEquals("Ok",json.getString("code"))
                val r=json.getJSONArray("routes").getJSONObject(0)
                assertTrue(r.getDouble("distance")>0&&r.getDouble("duration")>0)
                var voice=0;var banners=0
                val legs=r.getJSONArray("legs")
                for(i in 0 until legs.length()){
                    val steps=legs.getJSONObject(i).getJSONArray("steps")
                    for(j in 0 until steps.length()){
                        val step=steps.getJSONObject(j)
                        voice+=step.optJSONArray("voiceInstructions")?.length()?:0
                        banners+=step.optJSONArray("bannerInstructions")?.length()?:0
                    }
                }
                assertTrue(voice>0&&banners>0)
                val parsed=adapter.parseResponse(raw).first()
                assertTrue(parsed.geometry.size in 2..100000&&parsed.geometry.all{it.lat.isFinite()&&it.lng.isFinite()})
                val first=parsed.geometry.first();val last=parsed.geometry.last()
                val snapA=Point(first.lat,first.lng).distance(a);val snapB=Point(last.lat,last.lng).distance(b)
                if(snapA>150||snapB>150)rejected.add(label)
                Log.i("APOIS_NE_OFFLINE","case="+label+" ms="+(SystemClock.elapsedRealtime()-t)+" pss_kb="+Debug.getPss()+" snap_m="+snapA+","+snapB+" voice="+voice+" banners="+banners)
            }
            Log.i("APOIS_NE_OFFLINE","routes=15 snap_rejected="+rejected.size)
            // A server-valid route can still be rejected by the mobile snap gate.
            assertTrue("snap > 150m: "+rejected.joinToString(),rejected.isEmpty())
        }
    }
}
