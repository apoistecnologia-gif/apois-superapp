package br.com.apois.navigation.lab

// Kotlin counterpart of the existing reroute-budget.mjs. All timestamps monotonic.
// This gate counts authorizations, not network success. No endpoint or IO here.
internal class NativeRerouteGate {
    enum class Reason { ON_ROUTE, UNRELIABLE, CONFIRM_DEVIATION, OFFLINE, IN_FLIGHT, RATE_LIMIT, LEG_BUDGET, CLOSED }
    class Ticket internal constructor()
    sealed interface Decision {
        data object Continue : Decision
        data class Hold(val reason: Reason) : Decision
        data class Request(val ticket: Ticket) : Decision
        data object OfferExternal : Decision
    }
    private var lastFix: Long? = null
    private var lastSeen: Long? = null
    private var lastRequest: Long? = null
    private var pending: Ticket? = null
    private var consecutive = 0
    private var total = 0
    private var closed = false
    private val recent = ArrayDeque<Long>()
    val requests: Int get() = total

    fun invalidateFix() { consecutive = 0 }
    fun evaluate(now: Long, captured: Long, accuracy: Double, deviation: Double?, online: Boolean): Decision {
        if (closed) return Decision.Hold(Reason.CLOSED)
        if (now <= 0 || captured <= 0 || captured > now || now - captured > 10_000 ||
            lastSeen?.let { captured <= it } == true ||
            !accuracy.isFinite() || accuracy <= 0 || accuracy > 25.0 ||
            deviation == null || !deviation.isFinite() || deviation < 0) {
            invalidateFix()
            return Decision.Hold(Reason.UNRELIABLE)
        }
        lastSeen = captured
        // A reliable on-route fix must clear evidence immediately, even if it
        // arrives inside the confirmation interval. Only independent off-route
        // fixes count; intermediate reliable fixes must not erase evidence.
        if (deviation <= 50.0) {
            lastFix = captured
            invalidateFix()
            return Decision.Continue
        }
        if (lastFix?.let { captured - it < 1_000 } == true)
            return Decision.Hold(Reason.CONFIRM_DEVIATION)
        lastFix = captured
        consecutive = minOf(consecutive + 1, 2)
        if (consecutive < 2) return Decision.Hold(Reason.CONFIRM_DEVIATION)
        if (!online) return Decision.Hold(Reason.OFFLINE)
        if (pending != null) return Decision.Hold(Reason.IN_FLIGHT)
        while (recent.isNotEmpty() && now - recent.first() >= 60_000) recent.removeFirst()
        if (total >= 20) return Decision.OfferExternal
        if (lastRequest?.let { now - it < 15_000 } == true || recent.size >= 3)
            return Decision.Hold(Reason.RATE_LIMIT)
        lastRequest = now
        recent.add(now)
        total++
        consecutive = 0
        val ticket = Ticket()
        pending = ticket
        return Decision.Request(ticket)
    }
    fun isPending(ticket: Ticket): Boolean = !closed && pending === ticket
    fun settle(ticket: Ticket): Boolean {
        if (closed || pending !== ticket) return false
        pending = null
        return true
    }
    fun close() { closed = true; pending = null; invalidateFix() }
}
