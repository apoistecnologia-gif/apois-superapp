package br.com.apois.navigation.lab

import android.os.Looper
import android.os.SystemClock
import kotlinx.coroutines.*
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import javax.net.ssl.HttpsURLConnection

// Exact evidence revision stays in process. No raw auth token is retained by
// the target, capability, activity, intent, WebView or preference storage.
internal data class DriverControlTarget(
    val approved:ApprovedIndependentTarget,val evidenceId:String,val version:Int
){
    fun usable():Boolean=approved.usable()&&approved.source==RoutingTargetSource.INDEPENDENT_OSM&&
        nativeRideUuid.matches(evidenceId)&&version>0&&
        listOf(approved.identity.authUserId,approved.identity.profileUserId,approved.identity.driverId).all{nativeRideUuid.matches(it)}
    fun matches(request:ConfirmedHostRequest):Boolean=usable()&&request.matches(approved)
    fun currentProof(next:DriverControlTarget?):Boolean=usable()&&next==this
    fun evidence(now:Long,readBegan:Long=now):VerifiedRouteEvidence?{
        if(!usable()||readBegan<=0||now<readBegan||now-readBegan>5_000L)return null
        val a=approved
        // Use the conservative start of the authenticated read, not the
        // arrival time of the response, as the local freshness boundary.
        return routeEvidenceFromRead(NativeVerifiedRide(a.identity,a.rideId,a.phase,0,readBegan,"carros"),a,now)
    }
}
internal data class DriverControlPermit(val rideId:String,val phase:RidePhase,val evidenceId:String,val version:Int,val token:String){
    fun matches(target:DriverControlTarget):Boolean=target.usable()&&rideId==target.approved.rideId&&
        phase==target.approved.phase&&evidenceId==target.evidenceId&&version==target.version&&RouteCapability.parse(token)!=null
    override fun toString()="DriverControlPermit(redacted)"
}
internal class NativeDriverControlClient(private val backendHost:String){
    init{approvedReadBase("https://"+backendHost,backendHost)}
    private fun JSONObject.exact(vararg names:String):Boolean=length()==names.size&&names.all{has(it)}
    private fun JSONObject.str(key:String):String?=opt(key) as? String
    private fun JSONObject.integer(key:String):Int?{
        val n=opt(key) as? Number?:return null
        val d=n.toDouble()
        return if(d.isFinite()&&d>=1&&d<=Int.MAX_VALUE&&d==d.toInt().toDouble())d.toInt() else null
    }
    private suspend fun call(body:JSONObject):JSONObject?{
        check(Looper.myLooper()==Looper.getMainLooper())
        val capture=NativeDriverReadSource.capture()?:return null
        return try{
            val base=approvedReadBase(capture.base,backendHost)
            val bytes=body.toString().toByteArray(Charsets.UTF_8)
            if(bytes.size>2048||capture.access.length !in 1..8192||capture.key.length !in 1..8192||
                !(capture.access+capture.key).all{it.code in 33..126})return null
            val response=withTimeoutOrNull(3000L){runInterruptible(Dispatchers.IO){
                val conn=base.resolve("/functions/v1/apois-navigation-driver-control").toURL().openConnection() as HttpsURLConnection
                val deadline=System.nanoTime()+3_000_000_000L
                try{
                    conn.instanceFollowRedirects=false;conn.connectTimeout=1000;conn.readTimeout=1800
                    conn.useCaches=false;conn.requestMethod="POST";conn.doOutput=true
                    conn.setRequestProperty("Authorization","Bearer "+capture.access)
                    conn.setRequestProperty("apikey",capture.key)
                    conn.setRequestProperty("Content-Type","application/json")
                    conn.setRequestProperty("Accept","application/json")
                    conn.setFixedLengthStreamingMode(bytes.size)
                    conn.outputStream.use{it.write(bytes)}
                    if(conn.responseCode!=200||conn.contentLength>16384)return@runInterruptible null
                    conn.inputStream.use{input->
                        val output=ByteArrayOutputStream();val chunk=ByteArray(4096)
                        while(true){
                            check(!Thread.currentThread().isInterrupted&&System.nanoTime()<deadline)
                            val n=input.read(chunk);if(n<0)break
                            check(output.size()+n<=16384)
                            output.write(chunk,0,n)
                        }
                        output.toString("UTF-8")
                    }
                }finally{conn.disconnect()}
            }}?:return null
            currentCoroutineContext().ensureActive()
            if(!NativeDriverReadSource.current(capture))return null
            JSONObject(response)
        }catch(e:CancellationException){throw e}
        catch(_:Exception){null}
    }
    suspend fun target(request:ConfirmedHostRequest):DriverControlTarget?{
        if(!request.valid())return null
        val response=call(JSONObject().put("action","target").put("rideId",request.rideId).put("phase",request.phase.name))?:return null
        if(!response.exact("ok","target")||response.opt("ok")!=true)return null
        val t=response.optJSONObject("target")?:return null
        if(!t.exact("rideId","phase","identity","evidence")||t.str("rideId")!=request.rideId||t.str("phase")!=request.phase.name)return null
        val i=t.optJSONObject("identity")?:return null
        val e=t.optJSONObject("evidence")?:return null
        if(!i.exact("authUserId","profileUserId","driverId")||!e.exact("id","version","source","point")||e.str("source")!="INDEPENDENT_OSM")return null
        val p=e.optJSONObject("point")?:return null
        if(!p.exact("lat","lon"))return null
        val lat=(p.opt("lat") as? Number)?.toDouble()?:return null
        val lon=(p.opt("lon") as? Number)?.toDouble()?:return null
        val identity=RoutingIdentity(i.str("authUserId")?:return null,i.str("profileUserId")?:return null,i.str("driverId")?:return null)
        val approved=ApprovedIndependentTarget(identity,request.rideId,request.phase,RegionalPoint(lat,lon),RoutingTargetSource.INDEPENDENT_OSM)
        return DriverControlTarget(approved,e.str("id")?:return null,e.integer("version")?:return null).takeIf{it.matches(request)}
    }
    suspend fun permit(target:DriverControlTarget,origin:RegionalPoint):String?{
        if(!target.usable()||!origin.valid())return null
        val a=target.approved
        val response=call(JSONObject().put("action","permit").put("rideId",a.rideId).put("phase",a.phase.name)
            .put("origin",JSONObject().put("lat",origin.lat).put("lon",origin.lng))
            .put("evidenceId",target.evidenceId).put("evidenceVersion",target.version))?:return null
        if(!response.exact("ok","rideId","phase","evidenceId","evidenceVersion","token")||
            response.opt("ok")!=true||response.str("phase")!=a.phase.name)return null
        val grant=DriverControlPermit(response.str("rideId")?:return null,a.phase,response.str("evidenceId")?:return null,
            response.integer("evidenceVersion")?:return null,response.str("token")?:return null)
        return grant.token.takeIf{grant.matches(target)}
    }
}

// Explicit native build configuration only. No registration call is added to
// the app or bridge. The caller must establish approved host, online state
// and voice ownership through existing trusted native integration.
internal fun installDriverControlCandidate(enabled:Boolean=false,backendHost:String,routeEndpoint:String,routeHost:String,
    online:()->Boolean,hostCurrent:()->Boolean,audioAuthorization:(()->Boolean)?=null):Boolean{
    if(!enabled)return false
    check(Looper.myLooper()==Looper.getMainLooper())
    val client=runCatching{NativeDriverControlClient(backendHost)}.getOrNull()?:return false
    return NativeConfirmedHost.install(NativeHostConfiguration(backendHost,routeEndpoint,routeHost,online,grant={request->
        val stamp=NativeDriverReadSource.stamp()?:return@NativeHostConfiguration null
        fun live()=NativeDriverReadSource.current(stamp)&&runCatching{hostCurrent()}.getOrDefault(false)
        if(!live())return@NativeHostConfiguration null
        val grant=client.target(request)?:return@NativeHostConfiguration null
        if(!live())return@NativeHostConfiguration null
        NativeHostGrant(grant.approved.identity,grant.approved,::live,::live,
            RouteCapabilityIssuer{target,origin->if(live()&&target==grant.approved)client.permit(grant,origin)?.takeIf{live()} else null},
            audioAuthorization=audioAuthorization,
            verifyEvidence={
                if(!live())null else {
                    val began=SystemClock.elapsedRealtime()
                    val next=client.target(request)
                    if(!live()||!grant.currentProof(next))null else next?.evidence(SystemClock.elapsedRealtime(),began)
                }
            }
        )
    }))
}
