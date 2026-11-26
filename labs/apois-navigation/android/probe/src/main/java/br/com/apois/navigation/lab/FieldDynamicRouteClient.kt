package br.com.apois.navigation.lab

import android.os.SystemClock
import java.io.ByteArrayOutputStream
import javax.net.ssl.HttpsURLConnection
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runInterruptible
import org.json.JSONArray
import org.json.JSONObject
import uniffi.ferrostar.*

/** Standalone field testing only. No access to accounts, rides or production
 * authorization. Caller must provision the authorized HTTPS hostname and a
 * temporary operator secret through a trusted native host, not a WebView or
 * exported Intent. No default endpoint or secret; never persisted or logged.
 */
internal class FieldDynamicRouteClient(
    endpoint:String,authorizedHost:String,private val secret:FieldLabSecret,
    private val current:()->Boolean,private val target:RegionalPoint
):LiveRouteResolver {
    private val uri=validatedRouteEndpoint(endpoint,authorizedHost)
    private val region=RouteRegion.FieldPilot
    init{require(region.contains(target))}
    override suspend fun resolve(origin:RegionalPoint,destination:RegionalPoint):Route{
        check(current()&&destination==target&&region.contains(origin)&&secret.valid(SystemClock.elapsedRealtime()))
        val route=runInterruptible(Dispatchers.IO){
            val body=JSONObject().put("locations",JSONArray().apply{
                for(p in listOf(origin,destination))put(JSONObject().put("lat",p.lat).put("lon",p.lng).put("type","break"))
            }).put("costing","auto").put("units","kilometers").put("language","pt-BR")
                .put("format","osrm").put("voice_instructions",true).put("banner_instructions",true).put("shape_format","polyline6")
                .toString().toByteArray(Charsets.UTF_8)
            val conn=uri.toURL().openConnection() as HttpsURLConnection
            // Platform trust + normal hostname verification. Never override either.
            val deadline=System.nanoTime()+12_000_000_000L
            try{
                conn.instanceFollowRedirects=false;conn.connectTimeout=4000;conn.readTimeout=4000
                conn.requestMethod="POST";conn.doOutput=true;conn.useCaches=false
                conn.setRequestProperty("Content-Type","application/json")
                conn.setRequestProperty("Accept","application/json")
                conn.setRequestProperty("Authorization",secret.header())
                conn.setFixedLengthStreamingMode(body.size)
                conn.outputStream.use{it.write(body)}
                check(conn.responseCode==200&&conn.contentLength<=2_000_000)
                val bytes=conn.inputStream.use{input->
                    val output=ByteArrayOutputStream();val buf=ByteArray(8192)
                    while(true){
                        check(!Thread.currentThread().isInterrupted&&System.nanoTime()<deadline)
                        val count=input.read(buf);if(count<0)break
                        check(output.size()+count<=2_000_000);output.write(buf,0,count)
                    }
                    output.toByteArray()
                }
                val adapter=RouteAdapter.fromWellKnownRouteProvider(WellKnownRouteProvider.Valhalla(uri.toString(),"auto"))
                val parsed=adapter.parseResponse(bytes).first()
                check(routeEndpointsMatch(parsed.geometry.map{RegionalPoint(it.lat,it.lng)},origin,destination,region))
                parsed
            }finally{conn.disconnect()}
        }
        check(current()&&secret.valid(SystemClock.elapsedRealtime()))
        return route
    }
}
internal class FieldLabSecret private constructor(private val value:String,private val issued:Long){
    fun valid(now:Long)=now>=issued&&now-issued<900_000
    fun header()="Bearer "+value
    override fun toString()="FieldLabSecret(redacted)"
    companion object{
        fun parse(value:String,now:Long):FieldLabSecret?=
            if(now>0&&Regex("[a-f0-9]{64}").matches(value))FieldLabSecret(value,now) else null
    }
}

/** Recheck against the most recent accepted GPS fix after network IO, not
 * merely the origin captured before the request. No instruction may start
 * if the user has moved too far or GPS quality has deteriorated.
 */
internal fun fieldDynamicCanStart(
    current:Boolean,foreground:Boolean,quality:GpsQuality,now:Long,fix:InitialRouteFix,
    target:RegionalPoint,geometry:List<RegionalPoint>
):Boolean=current&&foreground&&quality==GpsQuality.AVAILABLE&&
    fix.captured>0&&now>=fix.captured&&now-fix.captured<=5000&&
    fix.accuracy.isFinite()&&fix.accuracy>0&&fix.accuracy<=20&&
    routeEndpointsMatch(geometry,fix.point,target,RouteRegion.FieldPilot)&&
    geometry.first().distanceTo(fix.point)<=35.0
