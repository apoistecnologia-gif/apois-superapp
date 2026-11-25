package br.com.apois.navigation.lab

import android.app.Activity
import android.content.Intent
import android.os.Looper
import android.os.Handler
import android.os.SystemClock
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.*
import org.json.JSONObject
import uniffi.ferrostar.Route
import java.util.UUID
import java.util.function.Consumer

/**
 * In-process owner for the existing live surface. The only external transport
 * accepts a ride reference; route data and authority must be prepared by a
 * trusted host inside this library. No synthetic replay, GPS acquisition, auth
 * token, network endpoint, or ride mutation is accepted via the bridge.
 * The optional native host is unconfigured by default. Process death deliberately loses everything.
 */
object ConfirmedLiveNavigationBridge {
    internal class Prepared(
        val route:Route, val target:RegionalPoint, val map:BundledRegionalMap.VerifiedMap,
        val resolver:LiveRouteResolver, val verifiedCurrent:()->Boolean,
        val verify:suspend ()->VerifiedRouteEvidence?,
        val online:()->Boolean, val audioAuthorization:(()->Boolean)?,
        val controller:NavigationSessionController,
        val lease:PreparedAuthorityLease,
        var evidence:VerifiedRouteEvidence,val sourceId:Long,val initialFix:InitialRouteFix
    ) {
        val ride:RideSnapshot get()=controller.snapshot
        var pending=false
        var opened=false
        val voice=ConfirmedSessionVoice()
    }
    internal data class Screen(
        val id:String, val owner:Prepared, val token:LegToken,
        val resources:LegRouteResources<Route>,val ride:RideSnapshot,val openingRevision:Long
    )
    internal val screen=MutableStateFlow<Screen?>(null)
    private var prepared:Prepared?=null
    private class Preparation { var job:Job?=null;var invalidated=false;var installed:Prepared?=null }
    private var preparing:Preparation?=null
    private var callback:Consumer<JSONObject>?=null
    private var closing:Screen?=null
    private var closingCallback:Consumer<JSONObject>?=null
    private var waiter:Consumer<Boolean>?=null
    private val handler=Handler(Looper.getMainLooper())
    private var expiryTask:Runnable?=null
    private var renewalJob:Job?=null
    private val initialAdmission=InitialRouteAdmission()
    private val activityOwnership=ConfirmedActivityOwnership()
    internal fun occupied():Boolean=screen.value!=null||closing!=null||preparing!=null
    private fun main(){check(Looper.myLooper()==Looper.getMainLooper())}
    private fun current(p:Prepared)=prepared===p && p.lease.current() && DriverGpsFeed.currentSourceId()==p.sourceId && runCatching{p.verifiedCurrent()}.getOrDefault(false)

    // Also expire a prepared owner while no Activity is visible. A stale
    // callback cannot revoke a newer owner. Elapsed-time checks still gate
    // every access if Android delays a Handler while asleep.
    private fun scheduleExpiry(p:Prepared){
        expiryTask?.let{handler.removeCallbacks(it)}
        val task=Runnable{if(prepared===p){if(current(p))scheduleExpiry(p) else revoke()}}
        expiryTask=task
        handler.postDelayed(task,30_000L)
    }

    // Native-only entry. No default resolver or evidence source; the trusted
    // host must provide both. The passive subscription is released before the
    // Activity can acquire its own consumer, without starting another GPS.
    internal suspend fun prepareFromGps(
        verify:suspend ()->VerifiedRouteEvidence?,resolver:LiveRouteResolver,
        map:BundledRegionalMap.VerifiedMap,
        verifiedCurrent:()->Boolean,online:()->Boolean={false},
        // Trusted host must explicitly attest Web Speech is stopped and the
        // user's original voice preference permits speech. No JS/Intent flag.
        audioAuthorization:(()->Boolean)?=null
    ):Boolean{
        main()
        if(prepared!=null||occupied()||LabNavigationBridge.screen.value!=null)return false
        val attempt=Preparation()
        preparing=attempt
        var success=false
        try{
            return withTimeoutOrNull(25_000L){
                attempt.job=coroutineContext[Job]
                val sourceId=DriverGpsFeed.currentSourceId()?:return@withTimeoutOrNull false
                fun current()=preparing===attempt&&!attempt.invalidated&&
                    DriverGpsFeed.currentSourceId()==sourceId&&runCatching{verifiedCurrent()}.getOrDefault(false)
                fun connected()=runCatching{online()}.getOrDefault(false)
                val firstEvidence=verify()?:return@withTimeoutOrNull false
                if(!current()||!connected()||!firstEvidence.usable(SystemClock.elapsedRealtime())||
                    !initialAdmission.available(firstEvidence))return@withTimeoutOrNull false
                var latest:InitialRouteFix?=null
                var quality=GpsQuality.WAITING
                val first=CompletableDeferred<Unit>()
                val id=DriverGpsFeed.subscribe(
                    current=::current,
                    onFix={location,captured->
                        val candidate=InitialRouteFix(RegionalPoint(location.coordinates.lat,location.coordinates.lng),
                            location.horizontalAccuracy,captured)
                        latest=candidate.takeIf{it.usable(SystemClock.elapsedRealtime())}
                        if(latest!=null)first.complete(Unit)
                    },
                    onQuality={value->quality=value;if(value!=GpsQuality.AVAILABLE)latest=null},
                    onRevoked={attempt.invalidated=true;attempt.job?.cancel()}
                )?:return@withTimeoutOrNull false
                try{
                    first.await()
                    val before=verify()?:return@withTimeoutOrNull false
                    val fix=latest?:return@withTimeoutOrNull false
                    val now=SystemClock.elapsedRealtime()
                    if(!current()||!connected()||quality!=GpsQuality.AVAILABLE||!fix.usable(now)||
                        !before.usable(now)||!sameRoutingLeg(firstEvidence,before)||
                        before.ride.revision!=firstEvidence.ride.revision||before.verifiedAt<firstEvidence.verifiedAt)return@withTimeoutOrNull false
                    // Exactly one initial route request. No retry, persisted
                    // location, cached Google polyline or invented destination.
                    if(!initialAdmission.reserve(before))return@withTimeoutOrNull false
                    val route=withTimeoutOrNull(15_000L){resolver.resolve(fix.point,before.target)}
                        ?:return@withTimeoutOrNull false
                    val after=verify()?:return@withTimeoutOrNull false
                    val last=latest?:return@withTimeoutOrNull false
                    val geometry=route.geometry.map{RegionalPoint(it.lat,it.lng)}
                    ensureActive()
                    if(!current()||quality!=GpsQuality.AVAILABLE||
                        !sameRoutingLeg(before,after)||after.ride.revision!=before.ride.revision||
                        after.verifiedAt<before.verifiedAt||
                        !routeEndpointsMatch(geometry,fix.point,before.target)||
                        !initialRouteMatches(after,last,geometry,SystemClock.elapsedRealtime()))return@withTimeoutOrNull false
                    val owner=Prepared(route,after.target,map,resolver,verifiedCurrent,verify,online,audioAuthorization,
                        NavigationSessionController(after.ride),PreparedAuthorityLease(SystemClock::elapsedRealtime),after,sourceId,last)
                    attempt.installed=owner
                    prepared=owner
                    prepared?.let(::scheduleExpiry)
                    true
                }finally{DriverGpsFeed.unsubscribe(id)}
            }.let{it?:false}.also{success=it}
        }catch(e:CancellationException){
            currentCoroutineContext().ensureActive()
            if(attempt.invalidated)return false
            throw e
        }catch(_:Exception){return false}
        finally{
            if(preparing===attempt)preparing=null
            if(!success&&attempt.installed!=null&&prepared===attempt.installed)revoke()
        }
    }

    // null is a definitive no-open result; exceptions are ambiguous to JS.
    // No native Activity can start from a bare UUID or a fabricated phase.
    fun openPrepared(activity:Activity,rideId:String,phase:String,revision:Long,events:Consumer<JSONObject>):String?{
        main()
        check(!occupied()&&LabNavigationBridge.screen.value==null){"Navigation already open or closing"}
        val p=prepared?:return null
        if(!current(p)){revoke();return null}
        if(p.pending||p.opened||p.ride.rideId!=rideId||p.ride.phase.name!=phase||p.ride.revision!=revision)return null
        val now=SystemClock.elapsedRealtime()
        if(!p.initialFix.usable(now)||!p.evidence.usable(now)){revoke();return null}
        p.controller.enable()
        val token=p.controller.token?:return null
        val resources=p.controller.routingFor(token,p.target,p.resolver)
        if(resources==null){p.controller.disable();return null}
        val id=UUID.randomUUID().toString()
        check(activityOwnership.begin(id)){"Navigation Activity ownership occupied"}
        p.opened=true // no stale initial route on re-entry; use original map until fresh re-entry is implemented
        callback=events
        screen.value=Screen(id,p,token,resources,p.ride,p.ride.revision)
        try{
            activity.startActivity(Intent(activity,ConfirmedLiveNavigationActivity::class.java).putExtra("confirmedSession",id))
        }catch(e:Exception){
            close(id)
            throw e // never advertise definitive unavailable after attempting start
        }
        startRenewal(p)
        return id
    }

    // Claim before rendering or installing any GPS/audio consumer. A late
    // Activity for a closing session may claim only to finish and acknowledge
    // destruction; it cannot pass accepts(). Duplicate intents are inert.
    internal fun claimActivity(id:String,activity:Any):Boolean{
        main()
        if(screen.value?.id!=id&&closing?.id!=id)return false
        return activityOwnership.claim(id,activity)
    }

    internal fun accepts(id:String,token:LegToken):Boolean{
        main()
        val s=screen.value?:return false
        return s.id==id && s.token==token && current(s.owner) && s.owner.controller.acceptsNavigationEvent(token)
    }

    internal fun acquireVoice(id:String):NavigationVoicePermit?{
        main()
        val s=screen.value?:return null
        val p=s.owner
        if(s.id!=id||!accepts(id,s.token))return null
        val approved=p.audioAuthorization?:return null
        // One attempt per opened session. An operational interruption or
        // failed stop never causes automatic reacquisition or repeated speech.
        fun allowed()=accepts(id,s.token)&&runCatching{approved()}.getOrDefault(false)
        return p.voice.acquire{
            if(!allowed())null else SharedGuidanceAudio.acquire(webStopped=true,stillCurrent=::allowed)
        }
    }

    internal fun checkVoice(id:String){
        main()
        screen.value?.takeIf{it.id==id}?.owner?.voice?.checkAuthority()
    }

    internal fun pauseVoice(id:String){
        main()
        screen.value?.takeIf{it.id==id}?.owner?.voice?.pause()
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

    // Renew from the same trusted native verifier that supplied the route.
    // No WebView message or GPS callback may extend authority. The operation
    // is scoped to the visible session, not a new Android service.
    private fun startRenewal(p:Prepared){
        stopRenewal()
        renewalJob=CoroutineScope(Dispatchers.Main.immediate).launch{
            while(isActive&&screen.value?.owner===p){
                delay(15_000L)
                if(screen.value?.owner!==p)return@launch
                if(!current(p)){revoke();return@launch}
                val next=try{withTimeoutOrNull(5_000L){p.verify()}}
                    catch(e:CancellationException){throw e}
                    catch(_:Exception){null}
                ensureActive()
                if(screen.value?.owner!==p||prepared!==p)return@launch
                if(next==null||!refreshPrepared(p,next)){revoke();return@launch}
            }
        }
    }
    private fun stopRenewal(){renewalJob?.cancel();renewalJob=null}

    private fun refreshPrepared(p:Prepared,evidence:VerifiedRouteEvidence):Boolean{
        main()
        if(!current(p)||!mayRenewRouteEvidence(p.evidence,evidence,SystemClock.elapsedRealtime()))return false
        val ride=evidence.ride
        if(ride.revision>p.ride.revision){
            p.controller.update(ride)
            if(p.controller.snapshot!==ride)return false
        }
        if(!p.lease.renew())return false
        p.evidence=evidence
        scheduleExpiry(p)
        p.pending=false
        screen.value?.takeIf{it.owner===p}?.let{
            screen.value=it.copy(ride=ride)
        }
        return true
    }

    // Immediately revoke navigation token and detach the surface, but do not
    // acknowledge closure until the actual Activity destruction callback.
    // Closing UI drops the route owner; initialAdmission retains the per-leg budget.
    fun close(id:String):Boolean{
        main()
        if(closing?.id==id)return true
        val s=screen.value?:return false
        if(s.id!=id)return false
        stopRenewal()
        closing=s
        closingCallback=callback
        callback=null
        // No reopened prepared route is allowed; release immediately so a
        // distinct next leg can prepare after actual Activity destruction.
        if(prepared===s.owner){
            expiryTask?.let{handler.removeCallbacks(it)}
            expiryTask=null
            prepared=null
            s.owner.lease.revoke()
        }
        s.owner.voice.close()
        s.owner.controller.close()
        screen.value=null
        return true
    }

    fun closeAcknowledged(id:String,completion:Consumer<Boolean>){
        main()
        if(activityOwnership.acknowledged(id)){completion.accept(true);return}
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

    internal fun activityDestroyed(id:String,activity:Any){
        main()
        if(!activityOwnership.owns(id,activity))return
        if(screen.value?.id==id)close(id)
        val s=closing?:return
        if(s.id!=id||!activityOwnership.destroyed(id,activity))return
        val notify=closingCallback
        val done=waiter
        closing=null
        closingCallback=null
        waiter=null
        val event=JSONObject().put("sessionId",id).put("rideId",s.ride.rideId)
            .put("revision",s.openingRevision).put("action","SESSION_CLOSED")
        runCatching{notify?.accept(event)}
        runCatching{done?.accept(true)}
    }

    // Host logout/ownership/phase loss must destroy the prepared leg and
    // cached resources; no reopening from a saved intent or previous process.
    fun revoke(){
        main()
        preparing?.let{it.invalidated=true;it.job?.cancel()}
        stopRenewal()
        expiryTask?.let{handler.removeCallbacks(it)}
        expiryTask=null
        val p=prepared
        prepared=null
        p?.lease?.revoke()
        p?.voice?.close()
        p?.controller?.close()
        screen.value?.id?.let{close(it)}
    }
}
