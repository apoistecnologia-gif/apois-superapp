package br.com.apois.navigation.lab

import java.net.URI
import javax.net.ssl.HttpsURLConnection
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.*
import org.json.JSONObject
import org.json.JSONArray

// Explicit host approval, not a host inferred from a WebView request.
// No default production host. Only these three read endpoints can be called.
internal fun approvedReadBase(raw:String,authorizedHost:String):URI{
    val uri=URI(raw)
    require(authorizedHost.matches(Regex("[A-Za-z0-9.-]+"))&&authorizedHost.contains('.'))
    require(uri.scheme=="https"&&uri.host.equals(authorizedHost,ignoreCase=true))
    require(uri.rawUserInfo==null&&uri.rawQuery==null&&uri.rawFragment==null)
    require(uri.port==-1||uri.port==443)
    require(uri.rawPath.isNullOrEmpty()||uri.rawPath=="/")
    return URI("https",null,uri.host,-1,null,null,null)
}
internal class NativeSupabaseRideReader(private val approvedHost:String){
    // Call on main; only the network operation moves to IO. Existing GPS
    // service remains the sole owner of login persistence and token refresh.
    suspend fun verify(rideId:String,phase:RidePhase,expected:RoutingIdentity):NativeVerifiedRide?{
        val capture=NativeDriverReadSource.capture()?:return null
        return try{
            val base=approvedReadBase(capture.base,approvedHost)
            val reader=HttpReads(base,capture)
            withTimeoutOrNull(5_000L){
                verifyNativeRide(reader,rideId,phase,expected,{NativeDriverReadSource.current(capture)},android.os.SystemClock::elapsedRealtime)
            }
        }catch(e:CancellationException){throw e}
        catch(_:Exception){null}
    }
    private class HttpReads(private val base:URI,private val session:NativeDriverReadSource.Capture):NativeRideReads{
        private enum class Endpoint{USER,PROFILE,RIDE}
        private suspend fun read(endpoint:Endpoint,rideId:String?=null):String=runInterruptible(Dispatchers.IO){
            val path=when(endpoint){
                Endpoint.USER->"/auth/v1/user"
                Endpoint.PROFILE->"/rest/v1/rpc/driver_get_profile"
                Endpoint.RIDE->{
                    require(rideId!=null&&nativeRideUuid.matches(rideId))
                    "/rest/v1/rides?select=id,status,driver_id,accepted_driver_id,intermediates&id=eq."+rideId+"&limit=2"
                }
            }
            require(session.access.length in 1..16384&&session.key.length in 1..16384)
            require((session.access+session.key).all{it.code in 33..126})
            val conn=base.resolve(path).toURL().openConnection() as HttpsURLConnection
            try{
                conn.instanceFollowRedirects=false
                conn.connectTimeout=1500;conn.readTimeout=1500;conn.useCaches=false
                conn.setRequestProperty("apikey",session.key)
                conn.setRequestProperty("Authorization","Bearer "+session.access)
                conn.setRequestProperty("Accept","application/json")
                if(endpoint==Endpoint.PROFILE){
                    // Existing STABLE authenticated read RPC; no provisioning.
                    conn.requestMethod="POST";conn.doOutput=true
                    conn.setRequestProperty("Content-Type","application/json")
                    val body="{}".toByteArray(Charsets.UTF_8)
                    conn.setFixedLengthStreamingMode(body.size)
                    conn.outputStream.use{it.write(body)}
                }else conn.requestMethod="GET"
                check(conn.responseCode==200)
                check(conn.contentLength<=131072)
                val deadline=System.nanoTime()+2_000_000_000L
                conn.inputStream.use{input->
                    val output=ByteArrayOutputStream()
                    val buf=ByteArray(4096)
                    while(true){
                        check(!Thread.currentThread().isInterrupted&&System.nanoTime()<deadline)
                        val n=input.read(buf)
                        if(n<0)break
                        check(output.size()+n<=131072)
                        output.write(buf,0,n)
                    }
                    output.toString("UTF-8")
                }
            }finally{conn.disconnect()}
        }
        private fun JSONObject.stringOrNull(key:String)=opt(key) as? String
        override suspend fun userId():String?=JSONObject(read(Endpoint.USER)).stringOrNull("id")
        override suspend fun profile():NativeDriverProfile?{
            val obj=JSONObject(read(Endpoint.PROFILE))
            return NativeDriverProfile(obj.stringOrNull("id")?:return null,obj.stringOrNull("user_id")?:return null)
        }
        override suspend fun ride(id:String):NativeRideRow?{
            val rows=JSONArray(read(Endpoint.RIDE,id))
            if(rows.length()!=1)return null
            val row=rows.getJSONObject(0)
            // Missing owner columns are malformed, distinct from SQL null.
            for(key in listOf("driver_id","accepted_driver_id"))
                if(!row.has(key)||!row.isNull(key)&&row.opt(key) !is String)return null
            return NativeRideRow(row.stringOrNull("id")?:return null,row.stringOrNull("status")?:return null,
                row.stringOrNull("driver_id"),row.stringOrNull("accepted_driver_id"),row.optJSONArray("intermediates")?.length())
        }
    }
}
