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

/** Only fixed public reference coordinates and a version-matched graph. */
@RunWith(AndroidJUnit4::class)
class EmbeddedPiauiRouteTest {
    private data class Point(val lat:Double,val lng:Double){
        fun inside()=lat.isFinite()&&lng.isFinite()&&lat in -7.75..-6.85&&lng in -41.85..-41.15
        fun distance(other:Point):Double {
            val a=Math.toRadians(other.lat-lat);val b=Math.toRadians(other.lng-lng)
            val h=sin(a/2).pow(2)+cos(Math.toRadians(lat))*cos(Math.toRadians(other.lat))*sin(b/2).pow(2)
            return 12_742_000.0*asin(sqrt(h.coerceIn(0.0,1.0)))
        }
    }
    private fun body(a:Point,b:Point)=
        """{"locations":[{"lat":${a.lat},"lon":${a.lng},"type":"break"},{"lat":${b.lat},"lon":${b.lng},"type":"break"}],"costing":"auto","units":"kilometers","language":"pt-BR","format":"osrm","voice_instructions":true,"banner_instructions":true,"shape_format":"polyline6"}"""
    private fun digest(bytes:ByteArray)=MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it.toInt() and 255)}
    private fun validatedTile():File {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val manifest=context.assets.open("graph-manifest.json").use{it.readBytes()}
        assertEquals("3d8ddee2d42886b1846d86477b44ca7fabc050227e48c767836699050b23dd31",digest(manifest))
        val m=JSONObject(manifest.toString(Charsets.UTF_8))
        assertEquals("3.6.3",m.getString("engine_version"));assertFalse(m.getBoolean("active"))
        val g=m.getJSONObject("graph");val bytes=g.getLong("bytes");assertEquals(3737600L,bytes)
        val sha=g.getString("sha256");assertEquals("b0f3de3041ec8994c77eb678e416db86f93e9dc3d95a7416114b55059a393344",sha)
        val tile=File(context.noBackupFilesDir,"piaui-verified.tar")
        val temp=File.createTempFile("graph-",".part",context.noBackupFilesDir)
        try{
            val md=MessageDigest.getInstance("SHA-256")
            var count=0L
            context.assets.open("valhalla_tiles.tar").use{input->
                FileOutputStream(temp).use{out->
                    val buf=ByteArray(64*1024)
                    while(true){val n=input.read(buf);if(n<0)break;count+=n;check(count<=bytes);md.update(buf,0,n);out.write(buf,0,n)}
                    out.fd.sync()
                }
            }
            assertEquals(bytes,count)
            assertEquals(sha,md.digest().joinToString(""){"%02x".format(it.toInt() and 255)})
            assertTrue(temp.renameTo(tile))
            return tile
        }finally{temp.delete()}
    }
    @Test fun verifyRegionalOfflineRoutesAndFerrostar(){
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        val tile=validatedTile()
        val config=ValhallaConfigBuilder().withTileExtract(tile.absolutePath).build()
        val adapter=RouteAdapter.fromWellKnownRouteProvider(WellKnownRouteProvider.Valhalla("https://navigation.invalid/route","auto"))
        val a=Point(-7.4475,-41.4786);val b=Point(-7.439992,-41.474246)
        val c=Point(-7.0769,-41.4669);val d=Point(-7.0709,-41.4609)
        val opened=SystemClock.elapsedRealtime()
        Valhalla(context,config).use{engine->
            Log.i("APOIS_PIAUI_OFFLINE","engine_open_ms="+(SystemClock.elapsedRealtime()-opened))
            fun checked(origin:Point,target:Point):Route{
                assertTrue(origin.inside()&&target.inside())
                val start=SystemClock.elapsedRealtime()
                val raw=engine.routeRaw(body(origin,target))
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
                Log.i("APOIS_PIAUI_OFFLINE","route_ms="+(SystemClock.elapsedRealtime()-start)+" voice="+voice+" banners="+banners)
                return parsed
            }
            checked(a,b);checked(b,a);checked(c,d);checked(d,c)
            val original=checked(a,c);val changed=checked(b,c)
            assertNotEquals(original.geometry,changed.geometry)
            val bad=adapter.parseResponse(engine.routeRaw(body(a,Point(-7.4415,-41.4726))).toByteArray(Charsets.UTF_8)).first()
            val last=bad.geometry.last().let{Point(it.lat,it.lng)}
            assertTrue(last.distance(Point(-7.4415,-41.4726))>150)
            assertTrue(runCatching{engine.routeRaw(body(Point(-9.4,-40.5),b))}.isFailure)
            Log.i("APOIS_PIAUI_OFFLINE","routes=6; distant_snap_rejected=true; changed_origin=true")
        }
    }
}
