package br.com.apois.navigation.lab

import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

/** Candidate local routing guard for the existing confirmed Vale ride contract.
 * No host registration, backend mutation, engine or pack downloader.
 * The trusted host supplies authoritative evidence and a pinned pack lease.
 * Offline routing does not authorize offline ride state transitions.
 */
internal class ScopedOfflineCalculation<T:Any>(
    private val target:ApprovedIndependentTarget,
    private val current:()->Boolean,
    private val packCurrent:()->Boolean,
    private val evidence:suspend ()->VerifiedRouteEvidence?,
    private val now:()->Long,
    private val calculate:suspend (RegionalPoint,RegionalPoint)->T,
    private val geometry:(T)->List<RegionalPoint>
){
    private fun allowed(origin:RegionalPoint,destination:RegionalPoint)=
        target.usable()&&origin.valid()&&destination==target.point&&
        runCatching{current()&&packCurrent()}.getOrDefault(false)
    private suspend fun verified(origin:RegionalPoint,destination:RegionalPoint):VerifiedRouteEvidence?{
        if(!allowed(origin,destination))return null
        val e=evidence()?:return null
        currentCoroutineContext().ensureActive()
        return e.takeIf{allowed(origin,destination)&&it.identity==target.identity&&it.ride.rideId==target.rideId&&
            it.ride.phase==target.phase&&it.target==target.point&&it.source==target.source&&it.usable(now())}
    }
    suspend fun resolve(origin:RegionalPoint,destination:RegionalPoint):T{
        val before=checkNotNull(verified(origin,destination)){"Local route authorization unavailable"}
        val result=calculate(origin,destination)
        currentCoroutineContext().ensureActive()
        val after=checkNotNull(verified(origin,destination)){"Local route authorization revoked"}
        check(sameRoutingLeg(before,after)&&after.verifiedAt>=before.verifiedAt&&after.ride.revision>=before.ride.revision&&
            (after.ride.revision>before.ride.revision||after.ride==before.ride)){"Stale ride evidence"}
        check(routeEndpointsMatch(geometry(result),origin,destination)){"Local route outside authorized region"}
        return result
    }
}
