package br.com.apois.navigation.lab

import android.app.Activity
import android.content.Intent
import android.os.Looper
import org.json.JSONObject
import kotlinx.coroutines.flow.MutableStateFlow
import java.util.UUID

// Synthetic laboratory only; all calls serialized on Android main thread.
// No production IDs, real coordinates, network or privileged ride actions.
object LabNavigationBridge {
    internal data class Screen(val sessionId:String,val ride:RideSnapshot,val token:LegToken?)
    internal val screen=MutableStateFlow<Screen?>(null)
    private var controller:NavigationSessionController?=null
    private var callback:java.util.function.Consumer<JSONObject>?=null
    private fun main(){check(Looper.myLooper()==Looper.getMainLooper())}
    private fun parse(data:JSONObject):RideSnapshot {
        val id=data.get("rideId") as? String ?: error("invalid ride id")
        require(id.matches(Regex("lab-[A-Za-z0-9_-]{1,64}")))
        val rev=data.get("revision") as? Number ?: error("invalid revision")
        require(rev.toDouble().isFinite() && rev.toDouble()==rev.toLong().toDouble() && rev.toLong() in 0..1_000_000_000)
        val phase=RidePhase.valueOf(data.getString("phase"))
        val destination=data.optString("destination","Destino de demonstração").take(120)
        return RideSnapshot(id,phase,rev.toLong(),destination,null,null,data.optBoolean("busy",false),
            if(data.isNull("error"))null else data.optString("error","").take(160).ifBlank{null})
    }
    fun open(activity:Activity,data:JSONObject,events:java.util.function.Consumer<JSONObject>):String {
        main();check(screen.value==null){"lab session already active"}
        val ride=parse(data)
        require(ride.phase in setOf(RidePhase.PICKUP,RidePhase.WAITING_PIN,RidePhase.TRIP))
        val id=UUID.randomUUID().toString()
        controller=NavigationSessionController(ride).also{it.enable()}
        callback=events
        screen.value=Screen(id,ride,controller?.token)
        try{activity.startActivity(Intent(activity,LabNavigationActivity::class.java).putExtra("labSession",id))}
        catch(e:Exception){close(id);throw e}
        return id
    }
    fun update(sessionId:String,data:JSONObject):Boolean{
        main()
        val existing=screen.value?:return false
        if(existing.sessionId!=sessionId)return false
        val c=controller?:return false
        val next=parse(data)
        c.update(next)
        if(c.snapshot!==next)return false
        screen.value=Screen(sessionId,c.snapshot,c.token)
        return true
    }
    internal fun accepts(sessionId:String,token:LegToken):Boolean = screen.value?.sessionId==sessionId && controller?.acceptsNavigationEvent(token)==true
    internal fun submit(sessionId:String,intent:RideIntent){
        main()
        if(screen.value?.sessionId!=sessionId)return
        val c=controller?:return
        if(c.submit(intent).isEmpty())return
        val event=JSONObject().put("sessionId",sessionId).put("rideId",intent.rideId)
            .put("revision",intent.revision).put("action",intent.action.name)
        intent.rating?.let{event.put("rating",it)}
        callback?.accept(event)
    }
    fun close(sessionId:String):Boolean{
        main()
        val previous=screen.value ?: return false
        if(previous.sessionId!=sessionId)return false
        val notify=callback
        controller?.close()
        controller=null
        callback=null
        screen.value=null
        // Close first, then notify. Back or Activity destruction must not leave
        // a stale fake session in the WebView. The host checks session identity.
        val event=JSONObject().put("sessionId",sessionId).put("rideId",previous.ride.rideId)
            .put("revision",previous.ride.revision).put("action","SESSION_CLOSED")
        runCatching { notify?.accept(event) }
        return true
    }
    fun closeActive(){
        main()
        screen.value?.sessionId?.let{close(it)}
    }
}
