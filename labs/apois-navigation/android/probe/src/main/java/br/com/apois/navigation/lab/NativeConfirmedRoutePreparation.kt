package br.com.apois.navigation.lab

import android.os.Looper
import android.os.SystemClock
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

// This is independent provenance evidence, NOT the generic coordinates from
// rides or a client-supplied source string. A trusted native integration must
// establish it separately. The current project has no such provider installed.
internal data class ApprovedIndependentTarget(
    val identity:RoutingIdentity,val rideId:String,val phase:RidePhase,
    val point:RegionalPoint,val source:RoutingTargetSource
){
    fun usable(region:RouteRegion=RouteRegion.Vale):Boolean=nativeRideUuid.matches(rideId)&&
        phase in setOf(RidePhase.PICKUP,RidePhase.TRIP)&&region.contains(point)&&
        source in setOf(RoutingTargetSource.INDEPENDENT_GPS,RoutingTargetSource.INDEPENDENT_OSM)
}

internal fun routeEvidenceFromRead(
    read:NativeVerifiedRide,target:ApprovedIndependentTarget,now:Long
):VerifiedRouteEvidence?{
    if(!target.usable()||read.identity!=target.identity||read.rideId!=target.rideId||
        read.phase!=target.phase||read.intermediateStops!=0||read.category!="carros")return null
    // Navigation-only generic label, no passenger profile or Google content.
    val label=if(read.phase==RidePhase.PICKUP)"Embarque" else "Destino"
    val ride=RideSnapshot(read.rideId,read.phase,0,label,null,null)
    return VerifiedRouteEvidence(read.identity,ride,target.point,target.source,0,read.verifiedAt)
        .takeIf{it.usable(now)}
}

// Native-only factory. The host explicitly supplies a verified, immutable
// local pack lease; no default, JS parameter or automatic server fallback.
internal fun interface NativeLocalRouteFactory{
    fun open(target:ApprovedIndependentTarget,map:BundledRegionalMap.VerifiedMap,
        current:()->Boolean,verify:suspend ()->VerifiedRouteEvidence?):ManagedRouteResolver?
}
internal fun nativeRoutingModeMatches(localOnly:Boolean,hasLocal:Boolean,hasIssuer:Boolean):Boolean =
    if(localOnly)hasLocal&&!hasIssuer else !hasLocal&&hasIssuer

// Only the internal trusted native host can call this. No public plugin,
// Intent, URL from JS, token bridge, default provider or production registration.
// The identity must match the authenticated host's previously verified identity.
internal suspend fun prepareConfirmedWithNativeReads(
    approvedBackendHost:String,expected:RoutingIdentity,target:ApprovedIndependentTarget,
    routeEndpoint:String,routeHost:String,issuer:RouteCapabilityIssuer?,
    map:BundledRegionalMap.VerifiedMap,hostCurrent:()->Boolean,targetCurrent:()->Boolean,
    online:()->Boolean,audioAuthorization:(()->Boolean)?=null,
    verifyEvidence:(suspend ()->VerifiedRouteEvidence?)?=null,
    localFactory:NativeLocalRouteFactory?=null
):Boolean{
    check(Looper.myLooper()==Looper.getMainLooper())
    if(!target.usable()||target.identity!=expected)return false
    val stamp=NativeDriverReadSource.stamp()?:return false
    fun current():Boolean=runCatching{
        NativeDriverReadSource.current(stamp)&&hostCurrent()&&targetCurrent()
    }.getOrDefault(false)
    if(!current())return false
    val reader=NativeSupabaseRideReader(approvedBackendHost)
    if(!nativeRoutingModeMatches(localFactory!=null,localFactory!=null,issuer!=null))return false
    val verify:suspend ()->VerifiedRouteEvidence?={
        if(!current())null else if(verifyEvidence!=null){
            val evidence=verifyEvidence()
            evidence?.takeIf{current()&&it.identity==expected&&it.ride.rideId==target.rideId&&it.ride.phase==target.phase&&it.target==target.point&&it.source==target.source&&it.usable(SystemClock.elapsedRealtime())}
        }else{
            val proof=reader.verify(target.rideId,target.phase,expected)
            if(proof==null||!current())null else routeEvidenceFromRead(proof,target,SystemClock.elapsedRealtime())
        }
    }
    currentCoroutineContext().ensureActive()
    val resolver=if(localFactory!=null){
        if(routeEndpoint.isNotEmpty()||routeHost.isNotEmpty())return false
        localFactory.open(target,map,::current,verify)?:return false
    }else ValhallaRouteClient(routeEndpoint,routeHost,RouteCapabilityScope(target,::current,checkNotNull(issuer)))
    return ConfirmedLiveNavigationBridge.prepareFromGps(
        verify=verify,
        resolver=resolver,map=map,verifiedCurrent=::current,online=online,
        audioAuthorization=audioAuthorization,localInitialRetry=localFactory!=null
    )
}
