package br.com.apois.navigation.lab

import android.app.Activity
import android.content.Intent
import android.os.Looper
import android.os.Handler
import android.os.SystemClock
import kotlinx.coroutines.flow.MutableStateFlow
import org.json.JSONObject
import uniffi.ferrostar.Route
import java.util.UUID
import java.util.function.Consumer

/**
 * In-process owner for the existing live surface. The only external transport
 * accepts a ride reference; route data and authority must be prepared by a
 * trusted host inside this library. No synthetic replay, GPS acquisition, auth
 * token, network endpoint, or ride mutation is accepted via the bridge.
 * No real host calls prepare yet. Process death deliberately loses everything.
 */
object ConfirmedLiveNavigationBridge {
    internal class Prepared(
        val route:Route, val target:RegionalPoint,
        val resolver:LiveRouteResolver, val verifiedCurrent:()->Boolean,
        val online:()->Boolean, val acquireVoice:(()->NavigationVoicePermit?)?,
        val controller:NavigationSessionController,
        val lease:PreparedAuthorityLease
    ) {
        val ride:RideSnapshot get()=controller.snapshot
        var pending=false
    }
    internal data class Screen(
        val id:String, val owner:Prepared, val token:LegToken,
        val resources:LegRouteResources<Route>,val ride:RideSnapshot
    )
    internal val screen=MutableStateFlow<Screen?>(null)
    private var prepared:Prepared?=null
    private var callback:Consumer<JSONObject>?=null
    private var closing:Screen?=null
    private var closingCallback:Consumer<JSONObject>?=null
    private var waiter:Consumer<Boolean>?=null
    private val handler=Handler(Looper.getMainLooper())
    internal fun occupied():Boolean=screen.value!=null||closing!=null
    private val rideIdPattern=Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
    private fun main(){check(Looper.myLooper()==Looper.getMainLooper())}
    private fun current(p:Prepared)=prepared===p && p.lease.current() && runCatching{p.verifiedCurrent()}.getOrDefault(false)

    // Must be called ONLY after host verified identity, assignment, phase,
    // source provenance and route. Geometry checks alone do not prove any of
    // those things. No API exposed to JS, intents, or replay.
    internal fun prepare(
        ride:RideSnapshot, route:Route, origin:RegionalPoint,target:RegionalPoint,
        resolver:LiveRouteResolver,verifiedCurrent:()->Boolean,
        online:()->Boolean={false},acquireVoice:(()->NavigationVoicePermit?)?=null
    ):Boolean{
        main()
        if(prepared!=null||occupied()||!rideIdPattern.matches(ride.rideId)||
            acquireVoice!=null|| // until the explicit native audio stop ACK is wired
            ride.phase !in setOf(RidePhase.PICKUP,RidePhase.TRIP)||ride.busy||
            !runCatching{verifiedCurrent()}.getOrDefault(false)||
            !routeEndpointsMatch(route.geometry.map{RegionalPoint(it.lat,it.lng)},origin,target))return false
        prepared=Prepared(route,target,resolver,verifiedCurrent,online,acquireVoice,NavigationSessionController(ride),PreparedAuthorityLease(SystemClock::elapsedRealtime))
        return true
    }

    // null is a definitive no-open result; exceptions are ambiguous to JS.
    // No native Activity can start from a bare UUID or a fabricated phase.
    fun openPrepared(activity:Activity,rideId:String,phase:String,revision:Long,events:Consumer<JSONObject>):String?{
        main()
        check(!occupied()&&LabNavigationBridge.screen.value==null){"Navigation already open or closing"}
        val p=prepared?:return null
        if(!current(p)){revoke();return null}
        if(p.pending||p.ride.rideId!=rideId||p.ride.phase.name!=phase||p.ride.revision!=revision)return null
        p.controller.enable()
        val token=p.controller.token?:return null
        val resources=p.controller.routingFor(token,p.target,p.resolver)
        if(resources==null){p.controller.disable();return null}
        val id=UUID.randomUUID().toString()
        callback=events
        screen.value=Screen(id,p,token,resources,p.ride)
        try{
            activity.startActivity(Intent(activity,ConfirmedLiveNavigationActivity::class.java).putExtra("confirmedSession",id))
        }catch(e:Exception){
            close(id)
            throw e // never advertise definitive unavailable after attempting start
        }
        return id
    }

    internal fun accepts(id:String,token:LegToken):Boolean{
        main()
        val s=screen.value?:return false
        return s.id==id && s.token==token && current(s.owner) && s.owner.controller.acceptsNavigationEvent(token)
    }

    internal fun submit(id:String,intent:RideIntent){
        main()
        val s=screen.value?:return
        if(s.id!=id||!accepts(id,s.token)||intent!=s.ride.intent(intent.action,intent.rating))return
        // Until original handlers are bound, every allowed button returns to
        // the host, never confirms an operation or opens a second navigator.
        if(intent.action==RideAction.RETURN||intent.action==RideAction.REQUEST_EXTERNAL){close(id);return}
        // Operational intents remain blocked until original UI integration.
    }

    // Only the trusted host may acknowledge an intent with a newer verified
    // same-leg row. Changed phase revokes rather than reusing the old route.
    internal fun refreshPrepared(ride:RideSnapshot):Boolean{
        main()
        val p=prepared?:return false
        if(!current(p)){revoke();return false}
        if(ride.rideId!=p.ride.rideId||ride.revision<=p.ride.revision)return false
        if(ride.phase!=p.ride.phase){revoke();return false}
        p.controller.update(ride)
        if(p.controller.snapshot!==ride)return false
        if(!p.lease.renew()){revoke();return false}
        p.pending=false
        screen.value?.takeIf{it.owner===p}?.let{
            // New Screen identity ensures Compose sees the refreshed snapshot.
            screen.value=it.copy(ride=ride)
        }
        return true
    }

    // Immediately revoke navigation token and detach the surface, but do not
    // acknowledge closure until the actual Activity destruction callback.
    // Closing UI retains the leg budget and pending intent until refresh.
    fun close(id:String):Boolean{
        main()
        if(closing?.id==id)return true
        val s=screen.value?:return false
        if(s.id!=id)return false
        closing=s
        closingCallback=callback
        callback=null
        s.owner.controller.disable()
        screen.value=null
        return true
    }

    fun closeAcknowledged(id:String,completion:Consumer<Boolean>){
        main()
        if(waiter!=null||!close(id)){completion.accept(false);return}
        waiter=completion
        handler.postDelayed({
            if(waiter===completion&&closing?.id==id){
                waiter=null
                completion.accept(false)
                // Keep closing occupied until actual destruction; no new UI.
            }
        },5_000)
    }

    internal fun activityDestroyed(id:String){
        main()
        if(screen.value?.id==id)close(id)
        val s=closing?:return
        if(s.id!=id)return
        val notify=closingCallback
        val done=waiter
        closing=null
        closingCallback=null
        waiter=null
        val event=JSONObject().put("sessionId",id).put("rideId",s.ride.rideId)
            .put("revision",s.ride.revision).put("action","SESSION_CLOSED")
        runCatching{notify?.accept(event)}
        runCatching{done?.accept(true)}
    }

    // Host logout/ownership/phase loss must destroy the prepared leg and
    // cached resources; no reopening from a saved intent or previous process.
    fun revoke(){
        main()
        val p=prepared
        prepared=null
        p?.lease?.revoke()
        p?.controller?.close()
        screen.value?.id?.let{close(it)}
    }
}
