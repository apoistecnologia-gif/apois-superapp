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

// Local calculations have two total preparation attempts per ride leg: a
// failed initial attempt OR one explicit re-entry after acknowledged Activity
// destruction. Remote attempts remain single-use. Keep only IDs and budget.
internal class InitialRouteAdmission(private val capacity:Int=256){
    private data class Attempt(val identity:RoutingIdentity,val at:Long,val local:Boolean,val count:Int,
        val budget:NativeRerouteGate?,val marker:Any=Any(),val prepared:Boolean=false,val closedAt:Long?=null)
    internal class CloseTicket internal constructor(internal val key:Pair<String,RidePhase>,internal val marker:Any)
    private val attempted=mutableMapOf<Pair<String,RidePhase>,Attempt>()
    init{require(capacity>0)}
    private fun key(e:VerifiedRouteEvidence)=e.ride.rideId to e.ride.phase
    fun available(evidence:VerifiedRouteEvidence,now:Long=evidence.verifiedAt,local:Boolean=false):Boolean{
        if(!evidence.usable(now))return false
        val previous=attempted[key(evidence)]?:return attempted.size<capacity
        if(!local||!previous.local||previous.count>=2||previous.identity!=evidence.identity)return false
        val boundary=if(previous.prepared)previous.closedAt?:return false else previous.at
        return now>=boundary&&now-boundary>=30_000L&&evidence.verifiedAt>boundary
    }
    fun reserve(evidence:VerifiedRouteEvidence,now:Long=evidence.verifiedAt,local:Boolean=false):Boolean{
        if(!available(evidence,now,local))return false
        val key=key(evidence)
        val previous=attempted[key]
        attempted[key]=Attempt(evidence.identity,now,local,(previous?.count?:0)+1,
            previous?.budget?:if(local)NativeRerouteGate() else null)
        return true
    }
    fun budgetFor(evidence:VerifiedRouteEvidence):NativeRerouteGate?=
        attempted[key(evidence)]?.takeIf{it.local&&it.identity==evidence.identity}?.budget
    fun markPrepared(evidence:VerifiedRouteEvidence){
        val key=key(evidence)
        val previous=attempted[key]?:return
        if(previous.identity==evidence.identity)attempted[key]=previous.copy(prepared=true)
    }
    fun closeTicket(evidence:VerifiedRouteEvidence):CloseTicket?{
        val key=key(evidence)
        val previous=attempted[key]?:return null
        if(!previous.local||!previous.prepared||previous.closedAt!=null||previous.identity!=evidence.identity)return null
        return CloseTicket(key,previous.marker)
    }
    fun markActivityClosed(ticket:CloseTicket,now:Long):Boolean{
        val previous=attempted[ticket.key]?:return false
        if(previous.marker!==ticket.marker||!previous.prepared||previous.closedAt!=null||now<previous.at)return false
        attempted[ticket.key]=previous.copy(closedAt=now)
        return true
    }
}
