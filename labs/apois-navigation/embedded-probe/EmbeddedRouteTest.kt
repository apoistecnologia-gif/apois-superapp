package br.com.apois.navigation.embedded

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.valhalla.config.ValhallaConfigBuilder
import com.valhalla.valhalla.Valhalla
import java.io.File
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import uniffi.ferrostar.*

/** Synthetic upstream graph only, no GPS, accounts, server or network permission. */
@RunWith(AndroidJUnit4::class)
class EmbeddedRouteTest {
 @Test fun calculateTwoOfflineRoutesAndParseForFerrostar(){
    val context=InstrumentationRegistry.getInstrumentation().targetContext
    val tile=File(context.noBackupFilesDir,"valhalla_tiles.tar")
    context.assets.open("valhalla_tiles.tar").use{input->tile.outputStream().use{input.copyTo(it)}}
    assertEquals(2962432L,tile.length())
    val config=ValhallaConfigBuilder().withTileExtract(tile.absolutePath).build()
    val adapter=RouteAdapter.fromWellKnownRouteProvider(WellKnownRouteProvider.Valhalla("https://navigation.invalid/route","auto"))
    fun body(a:Double,b:Double,c:Double,d:Double)=
        """{"locations":[{"lat":$a,"lon":$b,"type":"break"},{"lat":$c,"lon":$d,"type":"break"}],"costing":"auto","units":"kilometers","language":"pt-BR","format":"osrm","voice_instructions":true,"banner_instructions":true,"shape_format":"polyline6"}"""
    Valhalla(context,config).use{ engine ->
        fun route(a:Double,b:Double,c:Double,d:Double):Route {
            val raw=engine.routeRaw(body(a,b,c,d))
            val bytes=raw.toByteArray(Charsets.UTF_8)
            assertTrue(bytes.size in 1..2_000_000)
            assertEquals("Ok",JSONObject(raw).getString("code"))
            val parsed=adapter.parseResponse(bytes).first()
            assertTrue(parsed.geometry.size in 2..100000)
            assertTrue(parsed.geometry.all{it.lat.isFinite()&&it.lng.isFinite()})
            assertTrue(kotlin.math.abs(parsed.geometry.first().lat-a)<0.002)
            assertTrue(kotlin.math.abs(parsed.geometry.first().lng-b)<0.002)
            assertTrue(kotlin.math.abs(parsed.geometry.last().lat-c)<0.002)
            assertTrue(kotlin.math.abs(parsed.geometry.last().lng-d)<0.002)
            return parsed
        }
        val first=route(42.5063,1.5218,42.5086,1.5394)
        val second=route(42.5086,1.5394,42.5063,1.5218)
        assertNotEquals(first.geometry,second.geometry)
        assertTrue(runCatching{engine.routeRaw(body(45.843812,-123.768205,45.869701,-123.766121))}.isFailure)
    }
 }
}
