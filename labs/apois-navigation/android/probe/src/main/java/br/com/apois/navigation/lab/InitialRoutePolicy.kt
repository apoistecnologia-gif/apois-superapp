package br.com.apois.navigation.lab

// This type is an internal host contract, not an authentication mechanism.
// Only a trusted verifier may construct evidence after reading the assigned
// ride and establishing independent coordinate provenance. Never decode it
// from a WebView call, generic rides coordinates, a Google result or Intent.
internal enum class RoutingTargetSource { INDEPENDENT_GPS, INDEPENDENT_OSM, GOOGLE, UNKNOWN }
internal data class RoutingIdentity(val authUserId:String,val profileUserId:String,val driverId:String)
internal data class VerifiedRouteEvidence(
    val identity:RoutingIdentity, val ride:RideSnapshot,
    val target:RegionalPoint, val source:RoutingTargetSource,
    val intermediateStops:Int, val verifiedAt:Long
)
internal data class InitialRouteFix(val point:RegionalPoint,val accuracy:Double,val captured:Long)

private val routingUuid=Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
internal fun VerifiedRouteEvidence.usable(now:Long):Boolean =
    listOf(identity.authUserId,identity.profileUserId,identity.driverId,ride.rideId).all{routingUuid.matches(it)} &&
    ride.phase in setOf(RidePhase.PICKUP,RidePhase.TRIP) && !ride.busy &&
    ride.revision in 0..1_000_000_000L && target.valid() &&
    source in setOf(RoutingTargetSource.INDEPENDENT_GPS,RoutingTargetSource.INDEPENDENT_OSM) &&
    // Multi-stop rides are not supported by the current two-point resolver.
    intermediateStops==0 && verifiedAt>0 && now>=verifiedAt && now-verifiedAt<=5_000L

internal fun sameRoutingLeg(a:VerifiedRouteEvidence,b:VerifiedRouteEvidence):Boolean =
    a.identity==b.identity && a.ride.rideId==b.ride.rideId && a.ride.phase==b.ride.phase &&
    a.target==b.target && a.source==b.source && a.intermediateStops==b.intermediateStops

internal fun InitialRouteFix.usable(now:Long):Boolean =
    point.valid() && accuracy.isFinite() && accuracy>0 && accuracy<=25.0 &&
    captured>0 && now>=captured && now-captured<=10_000L

internal fun initialRouteMatches(
    evidence:VerifiedRouteEvidence, fix:InitialRouteFix, geometry:List<RegionalPoint>, now:Long
):Boolean = evidence.usable(now) && fix.usable(now) && routeEndpointsMatch(geometry,fix.point,evidence.target)

// A newer authoritative read can renew an unchanged revision (heartbeat), but
// must not smuggle a changed snapshot under the same revision. A changed
// identity, target, phase or provenance always revokes the prepared owner.
internal fun mayRenewRouteEvidence(previous:VerifiedRouteEvidence,next:VerifiedRouteEvidence,now:Long):Boolean =
    next.usable(now) && sameRoutingLeg(previous,next) &&
    next.verifiedAt>previous.verifiedAt && next.ride.revision>=previous.ride.revision &&
    (next.ride.revision>previous.ride.revision||next.ride==previous.ride)

// A failed local calculation may be explicitly retried once with fresh proof
// after a cooldown. Remote requests and successfully prepared legs retain
// the one-attempt rule. No coordinates, credentials, or disk storage.
internal class InitialRouteAdmission(private val capacity:Int=256){
    private data class Attempt(val identity:RoutingIdentity,val at:Long,val local:Boolean,val count:Int,val prepared:Boolean=false)
    private val attempted=mutableMapOf<Pair<String,RidePhase>,Attempt>()
    init{require(capacity>0)}
    fun available(evidence:VerifiedRouteEvidence,now:Long=evidence.verifiedAt,local:Boolean=false):Boolean{
        if(!evidence.usable(now))return false
        val previous=attempted[evidence.ride.rideId to evidence.ride.phase]
        return if(previous==null)attempted.size<capacity else
            local&&previous.local&&!previous.prepared&&previous.count<2&&previous.identity==evidence.identity&&
            now>=previous.at&&now-previous.at>=30_000L&&evidence.verifiedAt>previous.at
    }
    fun reserve(evidence:VerifiedRouteEvidence,now:Long=evidence.verifiedAt,local:Boolean=false):Boolean{
        if(!available(evidence,now,local))return false
        val key=evidence.ride.rideId to evidence.ride.phase
        attempted[key]=Attempt(evidence.identity,now,local,(attempted[key]?.count?:0)+1)
        return true
    }
    fun markPrepared(evidence:VerifiedRouteEvidence){
        val key=evidence.ride.rideId to evidence.ride.phase
        val previous=attempted[key]?:return
        if(previous.identity==evidence.identity)attempted[key]=previous.copy(prepared=true)
    }
}
