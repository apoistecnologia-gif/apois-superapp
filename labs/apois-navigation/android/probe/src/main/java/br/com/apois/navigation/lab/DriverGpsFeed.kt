package br.com.apois.navigation.lab

import android.location.Location
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.stadiamaps.ferrostar.core.location.toUserLocation
import uniffi.ferrostar.UserLocation

/**
 * Passive, in-process fan-out for the existing DriverLocationService callback.
 * No location request, permission, background service, network, or disk buffer.
 * Not installed into the production service or synthetic demo by this commit.
 * All calls are serialized on the main looper; source and subscriber IDs differ.
 */
object DriverGpsFeed {
    private val handler = Handler(Looper.getMainLooper())
    private var sequence = 0L
    private var source: Long? = null
    private var subscription: Subscription? = null
    private data class Subscription(
        val id: Long, val current: () -> Boolean,
        val onFix: (UserLocation) -> Unit, val onQuality: (GpsQuality) -> Unit,
        val gate: GpsFixGate = GpsFixGate(),
        var quality: GpsQuality? = null
    )
    private fun main() = check(Looper.myLooper() == Looper.getMainLooper())
    private fun live(s: Subscription): Boolean {
        if (subscription !== s) return false
        if (!runCatching { s.current() }.getOrDefault(false)) {
            unsubscribe(s.id)
            return false
        }
        return true
    }
    private fun status(s: Subscription, quality: GpsQuality) {
        if (!live(s) || s.quality == quality) return
        s.quality = quality
        if (runCatching { s.onQuality(quality) }.isFailure) unsubscribe(s.id)
    }
    private val watchdog = object : Runnable {
        override fun run() {
            val s = subscription ?: return
            if (!live(s)) return
            if (source == null || !s.gate.hasFreshFix(SystemClock.elapsedRealtime()))
                status(s, GpsQuality.LOST)
            if (subscription === s) handler.postDelayed(this, 1_000)
        }
    }
    @JvmStatic fun beginSource(): Long {
        main()
        val id = ++sequence
        source = id
        subscription?.let { status(it, GpsQuality.WAITING) }
        return id
    }
    @JvmStatic fun endSource(id: Long) {
        main()
        if (source != id) return
        source = null
        subscription?.let { status(it, GpsQuality.LOST) }
    }
    internal fun subscribe(
        current: () -> Boolean, onFix: (UserLocation) -> Unit,
        onQuality: (GpsQuality) -> Unit
    ): Long {
        main()
        check(subscription == null) { "GPS navigation consumer already active" }
        val s = Subscription(++sequence, current, onFix, onQuality)
        subscription = s
        status(s, GpsQuality.WAITING)
        if (subscription === s) handler.postDelayed(watchdog, 1_000)
        return s.id
    }
    internal fun unsubscribe(id: Long) {
        main()
        if (subscription?.id != id) return
        subscription = null
        handler.removeCallbacks(watchdog)
    }
    @JvmStatic fun publish(sourceId: Long, original: Location) {
        main()
        if (source != sourceId) return
        val s = subscription ?: return
        if (!live(s)) return
        val fix = Location(original)
        @Suppress("DEPRECATION")
        val mock = if (Build.VERSION.SDK_INT >= 31) fix.isMock else fix.isFromMockProvider
        val sample = GpsSample(fix.latitude, fix.longitude,
            if (fix.hasAccuracy()) fix.accuracy.toDouble() else null,
            fix.elapsedRealtimeNanos / 1_000_000L, fix.time, mock)
        when (s.gate.evaluate(sample, SystemClock.elapsedRealtime(), System.currentTimeMillis())) {
            FixDecision.IGNORE -> return
            FixDecision.IMPRECISE -> status(s, GpsQuality.IMPRECISE)
            FixDecision.LOST -> status(s, GpsQuality.LOST)
            FixDecision.ACCEPT -> {
                if (fix.hasBearing() && (!fix.bearing.isFinite() || fix.bearing < 0f || fix.bearing >= 360f))
                    fix.removeBearing()
                if (fix.hasSpeed() && (!fix.speed.isFinite() || fix.speed < 0f))
                    fix.removeSpeed()
                if (Build.VERSION.SDK_INT >= 26) {
                    if (fix.hasBearingAccuracy() && (!fix.bearingAccuracyDegrees.isFinite() ||
                            fix.bearingAccuracyDegrees !in 0f..360f)) fix.removeBearingAccuracy()
                    if (fix.hasSpeedAccuracy() && (!fix.speedAccuracyMetersPerSecond.isFinite() ||
                            fix.speedAccuracyMetersPerSecond < 0f)) fix.removeSpeedAccuracy()
                }
                status(s, GpsQuality.AVAILABLE)
                if (!live(s) || source != sourceId) return
                if (runCatching { s.onFix(fix.toUserLocation()) }.isFailure) {
                    status(s, GpsQuality.LOST)
                    unsubscribe(s.id)
                }
            }
        }
    }
}
