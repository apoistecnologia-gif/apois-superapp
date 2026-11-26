package br.com.apois.navigation.lab

// Host-owned, process-memory-only resources for ONE verified ride leg.
// The authenticated host retains this object across Activity recreation,
// fallback and re-entry, and closes it on terminal phase or account change.
// All methods are called on one dispatcher (Android main thread in the model).
internal class LegRouteResources<T : Any>(
    private val rideId: String, private val leg: Leg,
    val target: RegionalPoint,
    val region: RouteRegion,
    private val resolver: suspend (RegionalPoint, RegionalPoint) -> T
) {
    constructor(rideId:String, leg:Leg, target:RegionalPoint,
        resolver:suspend (RegionalPoint,RegionalPoint)->T):this(rideId,leg,target,RouteRegion.Vale,resolver)
    class Attachment internal constructor()
    private data class Entry<T>(val value: T, val insertedAt: Long)
    private val cache = LinkedHashMap<RegionalPoint, Entry<T>>(4, 0.75f, true)
    val budget = NativeRerouteGate()
    private var attachment: Attachment? = null
    private var closed = false

    init { require(rideId.isNotBlank() && region.contains(target)) }
    fun attach(token: LegToken): Attachment? {
        if (closed || attachment != null || token.rideId != rideId || token.leg != leg) return null
        budget.invalidateFix()
        return Attachment().also { attachment = it }
    }
    fun accepts(candidate: Attachment): Boolean = !closed && attachment === candidate
    fun detach(candidate: Attachment) {
        if (!accepts(candidate)) return
        suspendAttachment()
    }
    fun suspendAttachment() {
        attachment = null
        budget.invalidateFix()
        // Remove cached coordinates when leaving the map; retain only the budget.
        cache.clear()
        // Do NOT clear pending request here. Its job must settle the ticket
        // when transport completes or is cancelled, even after UI detaches.
    }
    private fun purge(now: Long) {
        cache.entries.removeAll { now < it.value.insertedAt || now - it.value.insertedAt >= 30_000L }
    }
    fun cached(candidate: Attachment, origin: RegionalPoint, now: Long): T? {
        if (!accepts(candidate) || !region.contains(origin) || now <= 0) return null
        purge(now)
        return cache[origin]?.value
    }
    fun remember(candidate: Attachment, origin: RegionalPoint, value: T, now: Long) {
        if (!accepts(candidate) || !region.contains(origin) || now <= 0) return
        purge(now)
        cache[origin] = Entry(value, now)
        while (cache.size > 4) cache.remove(cache.entries.first().key)
    }
    suspend fun resolve(candidate: Attachment, origin: RegionalPoint): T {
        check(accepts(candidate) && region.contains(origin)) { "Inactive route attachment" }
        return resolver(origin, target)
    }
    fun close() {
        closed = true
        attachment = null
        budget.close()
        cache.clear()
    }
}
