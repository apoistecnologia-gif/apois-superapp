package br.com.apois.navigation.lab

import android.os.Looper
import android.os.SystemClock

// This is independent provenance evidence, NOT the generic coordinates from
// rides or a client-supplied source string. A trusted native integration must
// establish it separately. The current project has no such provider installed.
internal data class ApprovedIndependentTarget(
    val identity:RoutingIdentity,val rideId:String,val phase:RidePhase,
    val point:RegionalPoint,val source:RoutingTargetSource
){
    fun usable():Boolean=nativeRideUuid.matches(rideId)&&
        phase in setOf(RidePhase.PICKUP,RidePhase.TRIP)&&point.valid()&&
        source in setOf(RoutingTargetSource.INDEPENDENT_GPS,RoutingTargetSource.INDEPENDENT_OSM)
}

internal fun routeEvidenceFromRead(
    read:NativeVerifiedRide,target:ApprovedIndependentTarget,now:Long
):VerifiedRouteEvidence?{
    if(!target.usable()||read.identity!=target.identity||read.rideId!=target.rideId||
        read.phase!=target.phase||read.intermediateStops!=0)return null
    // Navigation-only generic label, no passenger profile or Google content.
    val label=if(read.phase==RidePhase.PICKUP)"Embarque" else "Destino"
    val ride=RideSnapshot(read.rideId,read.phase,0,label,null,null)
    return VerifiedRouteEvidence(read.identity,ride,target.point,target.source,0,read.verifiedAt)
        .takeIf{it.usable(now)}
}

// Only the internal trusted native host can call this. No public plugin,
// Intent, URL from JS, token bridge, default provider or production registration.
// The identity must match the authenticated host's previously verified identity.
internal suspend fun prepareConfirmedWithNativeReads(
    approvedBackendHost:String,expected:RoutingIdentity,target:ApprovedIndependentTarget,
    resolver:LiveRouteResolver,hostCurrent:()->Boolean,targetCurrent:()->Boolean,
    online:()->Boolean,audioAuthorization:(()->Boolean)?=null
):Boolean{
    check(Looper.myLooper()==Looper.getMainLooper())
    if(!target.usable()||target.identity!=expected)return false
    val stamp=NativeDriverReadSource.stamp()?:return false
    fun current():Boolean=runCatching{
        NativeDriverReadSource.current(stamp)&&hostCurrent()&&targetCurrent()
    }.getOrDefault(false)
    if(!current())return false
    val reader=NativeSupabaseRideReader(approvedBackendHost)
    return ConfirmedLiveNavigationBridge.prepareFromGps(
        verify={
            if(!current())null else {
                val proof=reader.verify(target.rideId,target.phase,expected)
                if(proof==null||!current())null else routeEvidenceFromRead(proof,target,SystemClock.elapsedRealtime())
            }
        },
        resolver=resolver,verifiedCurrent=::current,online=online,
        audioAuthorization=audioAuthorization
    )
}
