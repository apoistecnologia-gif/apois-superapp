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
