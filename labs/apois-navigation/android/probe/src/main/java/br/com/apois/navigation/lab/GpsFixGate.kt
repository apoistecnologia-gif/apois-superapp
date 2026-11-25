package br.com.apois.navigation.lab

// Navigation-only limits. Never used to filter driver presence uploads.
internal enum class GpsQuality { WAITING, AVAILABLE, IMPRECISE, LOST }
internal enum class FixDecision { ACCEPT, IGNORE, IMPRECISE, LOST }
internal data class GpsSample(
    val lat: Double, val lng: Double, val accuracy: Double?,
    val elapsedMs: Long, val wallMs: Long, val mock: Boolean = false
)

internal class GpsFixGate(
    private val maxAgeMs: Long = 15_000,
    private val maxAccuracyMeters: Double = 35.0,
    private val minIntervalMs: Long = 750
) {
    private var lastAccepted: Long? = null
    private var lastSeen: Long? = null

    fun evaluate(fix: GpsSample, nowElapsed: Long, nowWall: Long): FixDecision {
        if (fix.elapsedMs <= 0 || fix.elapsedMs > nowElapsed ||
            nowElapsed - fix.elapsedMs > maxAgeMs || fix.wallMs <= 0 ||
            fix.wallMs > nowWall + 5_000 || nowWall - fix.wallMs > 30_000)
            return FixDecision.IGNORE
        if (lastSeen?.let { fix.elapsedMs <= it } == true) return FixDecision.IGNORE
        lastSeen = fix.elapsedMs
        if (fix.mock || !fix.lat.isFinite() || !fix.lng.isFinite() ||
            fix.lat !in -90.0..90.0 || fix.lng !in -180.0..180.0)
            return FixDecision.LOST
        val accuracy = fix.accuracy
        if (accuracy == null || !accuracy.isFinite() ||
            accuracy <= 0.0 || accuracy > maxAccuracyMeters) return FixDecision.IMPRECISE
        if (lastAccepted?.let { fix.elapsedMs - it < minIntervalMs } == true)
            return FixDecision.IGNORE
        lastAccepted = fix.elapsedMs
        return FixDecision.ACCEPT
    }

    fun hasFreshFix(nowElapsed: Long): Boolean =
        lastAccepted?.let { nowElapsed >= it && nowElapsed - it <= maxAgeMs } ?: false
}
