package br.com.apois.navigation.lab

import android.app.Activity
import android.content.Intent
import android.os.Looper
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
        val ride:RideSnapshot, val route:Route, val target:RegionalPoint,
        val resolver:LiveRouteResolver, val verifiedCurrent:()->Boolean,
        val online:()->Boolean, val acquireVoice:(()->NavigationVoicePermit?)?,
        val controller:NavigationSessionController
    )
    internal data class Screen(
        val id:String, val owner:Prepared, val token:LegToken,
        val resources:LegRouteResources<Route>
    )
    internal val screen=MutableStateFlow<Screen?>(null)
    private var prepared:Prepared?=null
    private var callback:Consumer<JSONObject>?=null
    private val rideIdPattern=Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
    private fun main(){check(Looper.myLooper()==Looper.getMainLooper())}
    private fun current(p:Prepared)=prepared===p && runCatching{p.verifiedCurrent()}.getOrDefault(false)

    // Must be called ONLY after host verified identity, assignment, phase,
    // source provenance and route. Geometry checks alone do not prove any of
    // those things. No API exposed to JS, intents, or replay.
    internal fun prepare(
        ride:RideSnapshot, route:Route, origin:RegionalPoint,target:RegionalPoint,
        resolver:LiveRouteResolver,verifiedCurrent:()->Boolean,
        online:()->Boolean={false},acquireVoice:(()->NavigationVoicePermit?)?=null
    ):Boolean{
        main()
        if(prepared!=null||screen.value!=null||!rideIdPattern.matches(ride.rideId)||
            ride.phase !in setOf(RidePhase.PICKUP,RidePhase.TRIP)||ride.busy||
            !runCatching{verifiedCurrent()}.getOrDefault(false)||
            !routeEndpointsMatch(route.geometry.map{RegionalPoint(it.lat,it.lng)},origin,target))return false
        prepared=Prepared(ride,route,target,resolver,verifiedCurrent,online,acquireVoice,NavigationSessionController(ride))
        return true
    }

    // null is a definitive no-open result; exceptions are ambiguous to JS.
    // No native Activity can start from a bare UUID or a fabricated phase.
    fun openPrepared(activity:Activity,rideId:String,phase:String,revision:Long,events:Consumer<JSONObject>):String?{
        main()
        check(screen.value==null){"Confirmed navigation already open"}
        val p=prepared?:return null
        if(!current(p)){revoke();return null}
        if(p.ride.rideId!=rideId||p.ride.phase.name!=phase||p.ride.revision!=revision)return null
        p.controller.enable()
        val token=p.controller.token?:return null
        val resources=p.controller.routingFor(token,p.target,p.resolver)
        if(resources==null){p.controller.disable();return null}
        val id=UUID.randomUUID().toString()
        callback=events
        screen.value=Screen(id,p,token,resources)
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
        if(s.id!=id||!accepts(id,s.token)||s.owner.controller.submit(intent).isEmpty())return
        // UI intents only. The original host must revalidate and use its own
        // PIN/finish/rating UI; no RPC or arrival authority lives here.
        val event=JSONObject().put("sessionId",id).put("rideId",intent.rideId)
            .put("revision",intent.revision).put("action",intent.action.name)
        intent.rating?.let{event.put("rating",it)}
        runCatching{callback?.accept(event)}
    }

    // Closing UI does not reset the leg budget. The prepared owner remains
    // only until the trusted host revokes it; a new preparation cannot replace
    // it silently. Clear pending intents before re-entry via explicit host revoke.
    fun close(id:String):Boolean{
        main()
        val s=screen.value?:return false
        if(s.id!=id)return false
        val notify=callback
        callback=null
        s.owner.controller.disable()
        screen.value=null
        val event=JSONObject().put("sessionId",id).put("rideId",s.owner.ride.rideId)
            .put("revision",s.owner.ride.revision).put("action","SESSION_CLOSED")
        runCatching{notify?.accept(event)}
        return true
    }

    // Host logout/ownership/phase loss must destroy the prepared leg and
    // cached resources; no reopening from a saved intent or previous process.
    fun revoke(){
        main()
        val p=prepared
        prepared=null
        p?.controller?.close()
        screen.value?.id?.let{close(it)}
    }
}
