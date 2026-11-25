package br.com.apois.navigation.lab

import android.os.Looper
import java.util.function.Supplier
import java.security.MessageDigest

// Source registry points to the existing native location-session storage.
// It stores no access/refresh tokens. Captures are internal, short lived,
// never serialized or sent to JavaScript or to a routing provider.
object NativeDriverReadSource{
    private class Source(val id:Long,val base:String,val key:String,val access:Supplier<String>)
    private var source:Source?=null
    private fun main(){check(Looper.myLooper()==Looper.getMainLooper())}
    fun bind(id:Long,baseUrl:String,publishableKey:String,access:Supplier<String>):Boolean{
        main()
        if(id<=0||DriverGpsFeed.currentSourceId()!=id)return false
        if(source?.id==id)return false
        source=Source(id,baseUrl,publishableKey,access)
        return true
    }
    fun unbind(id:Long){main();if(source?.id==id)source=null}
    internal class Capture(val sourceId:Long,val base:String,val key:String,val access:String){
        override fun toString()="NativeDriverReadCapture(redacted)"
    }
    internal fun capture():Capture?{
        main()
        val s=source?:return null
        if(DriverGpsFeed.currentSourceId()!=s.id)return null
        val token=runCatching{s.access.get()}.getOrNull()?.takeIf{it.isNotBlank()}?:return null
        return Capture(s.id,s.base,s.key,token)
    }
    // In-memory fingerprint only. Fail closed if the access token changes,
    // even on a legitimate refresh. No raw credential retained by a route.
    internal class Stamp(val sourceId:Long,private val digest:ByteArray){
        fun matches(other:Stamp)=sourceId==other.sourceId&&MessageDigest.isEqual(digest,other.digest)
        override fun toString()="NativeDriverSessionStamp(redacted)"
    }
    internal fun stamp():Stamp?{
        val c=capture()?:return null
        return Stamp(c.sourceId,MessageDigest.getInstance("SHA-256").digest(c.access.toByteArray(Charsets.UTF_8)))
    }
    internal fun current(stamp:Stamp):Boolean=stamp()?.let{stamp.matches(it)}==true

    internal fun current(c:Capture):Boolean{
        main()
        val s=source?:return false
        return s.id==c.sourceId&&DriverGpsFeed.currentSourceId()==s.id&&s.base==c.base&&s.key==c.key&&
            runCatching{s.access.get()==c.access}.getOrDefault(false)
    }
}
