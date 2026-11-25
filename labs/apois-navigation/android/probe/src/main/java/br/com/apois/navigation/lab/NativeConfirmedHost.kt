package br.com.apois.navigation.lab

import android.app.Activity
import android.os.Looper
import kotlinx.coroutines.*
import org.json.JSONObject
import java.util.function.BooleanSupplier
import java.util.function.Consumer

// Native configuration is deliberately not exposed as a Capacitor method.
// Only a future trusted in-process host may install it. No default endpoints,
// credentials, Google-derived targets, real account, or mock routing grant.
internal data class NativeHostGrant(
    val identity:RoutingIdentity,val target:ApprovedIndependentTarget,
    val current:()->Boolean,val targetCurrent:()->Boolean,
    val issuer:RouteCapabilityIssuer,
    val audioAuthorization:(()->Boolean)?=null,
    val verifyEvidence:(suspend ()->VerifiedRouteEvidence?)?=null
)
internal data class NativeHostConfiguration(
    val approvedBackendHost:String,val routeEndpoint:String,val routeHost:String,
    val online:()->Boolean,
    val grant:suspend (ConfirmedHostRequest)->NativeHostGrant?
)
object NativeConfirmedHost{
    private var configuration:NativeHostConfiguration?=null
    private val gate=ConfirmedOpeningGate()
    private var pending:Job?=null
    private var pendingTicket:ConfirmedOpeningGate.Ticket?=null
    private fun main(){check(Looper.myLooper()==Looper.getMainLooper())}
    internal fun install(config:NativeHostConfiguration):Boolean{
        main()
        if(configuration!=null||pending!=null||ConfirmedLiveNavigationBridge.occupied())return false
        // Validate the exact backend origin at setup, before any read.
        if(runCatching{
            approvedReadBase("https://"+config.approvedBackendHost,config.approvedBackendHost)
            validatedRouteEndpoint(config.routeEndpoint,config.routeHost)
        }.isFailure)return false
        configuration=config
        return true
    }
    // Read-only capability check. It never configures the host or starts GPS.
    fun configured():Boolean{main();return configuration!=null}
    private fun request(id:String,phase:String,revision:Long):ConfirmedHostRequest?{
        val leg=when(phase){"PICKUP"->RidePhase.PICKUP;"TRIP"->RidePhase.TRIP;else->return null}
        return ConfirmedHostRequest(id,leg,revision).takeIf{it.valid()}
    }
    // null success value means definitively no Activity was attempted.
    // Any exception AFTER the start attempt is ambiguous and must not fallback.
    fun open(activity:Activity,id:String,phase:String,revision:Long,listener: BooleanSupplier,
             events:Consumer<JSONObject>,opened:Consumer<String?>,uncertain:Runnable){
        main()
        val req=request(id,phase,revision)?:run{uncertain.run();return}
        val config=configuration?:run{opened.accept(null);return}
        if(ConfirmedLiveNavigationBridge.occupied()||LabNavigationBridge.screen.value!=null){uncertain.run();return}
        val ticket=gate.begin(req)?:run{uncertain.run();return}
        pendingTicket=ticket
        val job=CoroutineScope(Dispatchers.Main.immediate).launch(start=CoroutineStart.UNDISPATCHED){
            var prepared=false
            var startAttempted=false
            var session:String?=null
            var ambiguous=false
            try{
                fun available()=configuration===config&&gate.current(ticket)&&
                    !activity.isFinishing&&!activity.isDestroyed&&runCatching{listener.asBoolean}.getOrDefault(false)
                if(!available())return@launch
                val grant=withTimeoutOrNull(5_000L){config.grant(req)}?:return@launch
                if(!available()||!req.matches(grant.target)||grant.identity!=grant.target.identity)return@launch
                fun authorized()=configuration===config&&runCatching{grant.current()}.getOrDefault(false)
                if(!authorized())return@launch
                // No backend reads, GPS subscription or routing request if the
                // packaged regional assets cannot be verified and installed.
                // Use the verified immutable style in the eventual Activity.
                val map=preflightRegionalMap(
                    current={available()&&authorized()&&runCatching{grant.targetCurrent()}.getOrDefault(false)},
                    load={withTimeoutOrNull(8_000L){BundledRegionalMap.VerifiedMap.load(activity.applicationContext)}}
                )?:return@launch
                prepared=prepareConfirmedWithNativeReads(config.approvedBackendHost,grant.identity,grant.target,
                    config.routeEndpoint,config.routeHost,grant.issuer,map,::authorized,grant.targetCurrent,config.online,grant.audioAuthorization,grant.verifyEvidence)
                ensureActive()
                if(!prepared||!available()||!authorized())return@launch
                startAttempted=true
                session=ConfirmedLiveNavigationBridge.openPrepared(activity,id,phase,revision,events)
            }catch(_:CancellationException){
                ambiguous=startAttempted
            }catch(_:Exception){
                ambiguous=startAttempted
            }finally{
                // If no Activity was attempted/created, drop any prepared route.
                // Never clear a possibly active Activity just to allow fallback.
                if(prepared&&session==null&&!ambiguous)ConfirmedLiveNavigationBridge.revoke()
                gate.finish(ticket)
                if(pendingTicket===ticket){pendingTicket=null;pending=null}
                if(ambiguous)uncertain.run() else opened.accept(session)
            }
        }
        if(pendingTicket===ticket)pending=job
    }
    // Cancellation is tied to the exact pending request. No new request can
    // begin before cleanup. Active sessions use closeAcknowledged instead.
    fun cancelPending(id:String,phase:String,revision:Long):Boolean{
        main()
        val req=request(id,phase,revision)?:return false
        if(!gate.cancel(req))return false
        pending?.cancel()
        return true
    }
    fun destroy(){
        main()
        configuration=null
        pendingTicket?.let{gate.cancel(it.request)}
        pending?.cancel()
        ConfirmedLiveNavigationBridge.revoke()
    }
}
