package br.com.apois.navigation.lab

import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withTimeoutOrNull

// This capability is for the routing gateway ONLY. Not an auth JWT, not a
// key, and never sent through Capacitor, Intent, preferences or telemetry.
internal class RouteCapability private constructor(private val token:String){
    internal fun header()="Bearer "+token
    override fun toString()="RouteCapability(redacted)"
    companion object{
        private val format=Regex("^[A-Za-z0-9_-]{1,1500}\\.[A-Za-z0-9_-]{86}$")
        internal fun parse(value:String?):RouteCapability?=
            value?.takeIf{format.matches(it)}?.let(::RouteCapability)
    }
}

// The future issuer must reverify assignment and independent source evidence
// and sign the exact normalized two-point request using the server's contract.
// This callback only receives the bound native leg and origin, not a JS claim.
// No issuer installed, no default URL, and no persisted capability cache.
internal fun interface RouteCapabilityIssuer{
    suspend fun issue(target:ApprovedIndependentTarget,origin:RegionalPoint):String?
}
internal class RouteCapabilityScope(
    private val target:ApprovedIndependentTarget,
    private val current:()->Boolean,
    private val issuer:RouteCapabilityIssuer,
    val region:RouteRegion
){
    constructor(target:ApprovedIndependentTarget,current:()->Boolean,issuer:RouteCapabilityIssuer):
        this(target,current,issuer,RouteRegion.Vale)
    fun authorized(origin:RegionalPoint,destination:RegionalPoint):Boolean=
        target.usable(region)&&region.contains(origin)&&destination==target.point&&
            runCatching{current()}.getOrDefault(false)

    suspend fun acquire(origin:RegionalPoint,destination:RegionalPoint):RouteCapability?{
        if(!authorized(origin,destination))return null
        val raw=withTimeoutOrNull(3_000L){issuer.issue(target,origin)}
        currentCoroutineContext().ensureActive()
        if(!authorized(origin,destination))return null
        return RouteCapability.parse(raw)
    }
}
