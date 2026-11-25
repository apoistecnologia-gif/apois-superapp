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
    private var sourceStartedAt = 0L
    private var subscription: Subscription? = null
    private data class Subscription(
        val id: Long, val sourceId: Long, val startedAt: Long, val current: () -> Boolean,
        val onFix: (UserLocation) -> Unit, val onQuality: (GpsQuality) -> Unit,
        val gate: GpsFixGate = GpsFixGate(),
        var quality: GpsQuality? = null
    )
    private fun main() = check(Looper.myLooper() == Looper.getMainLooper())
    private fun live(s: Subscription): Boolean {
        if (subscription !== s || source != s.sourceId) return false
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
            val now = SystemClock.elapsedRealtime()
            if (now - s.startedAt > 15_000 && !s.gate.hasFreshFix(now))
                status(s, GpsQuality.LOST)
            if (subscription === s) handler.postDelayed(this, 1_000)
        }
    }
    @JvmStatic fun beginSource(): Long {
        main()
        invalidateSource()
        val id = ++sequence
        sourceStartedAt = SystemClock.elapsedRealtime()
        source = id
        return id
    }
    @JvmStatic fun endSource(id: Long) {
        main()
        if (source != id) return
        invalidateSource()
    }
    // A source change (including account restart) never inherits a consumer.
    @JvmStatic fun invalidateSource() {
        main()
        val old = subscription
        source = null
        subscription = null
        handler.removeCallbacks(watchdog)
        if (old != null && runCatching { old.current() }.getOrDefault(false))
            runCatching { old.onQuality(GpsQuality.LOST) }
    }
    // Capture both IDs before posting work; a later leg must not inherit a queued fix.
    @JvmStatic fun consumerTicket(sourceId: Long): Long {
        main()
        val s = subscription ?: return 0L
        return if (source == sourceId && live(s)) s.id else 0L
    }
    internal fun subscribe(
        current: () -> Boolean, onFix: (UserLocation) -> Unit,
        onQuality: (GpsQuality) -> Unit
    ): Long? {
        main()
        check(subscription == null) { "GPS navigation consumer already active" }
        val activeSource = source ?: return null
        val s = Subscription(++sequence, activeSource, SystemClock.elapsedRealtime(), current, onFix, onQuality)
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
    @JvmStatic fun publish(sourceId: Long, consumerId: Long, original: Location) {
        main()
        if (source != sourceId) return
        val s = subscription ?: return
        if (!live(s)) return
        val ticket = GpsCallbackTicket(s.sourceId, s.id, maxOf(sourceStartedAt, s.startedAt))
        if (!ticket.accepts(sourceId, consumerId, original.elapsedRealtimeNanos / 1_000_000L)) return
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
                // Reconstruct only validated fields; Android's remove*Accuracy
                // methods are not part of the public SDK on all supported APIs.
                val clean = Location("apois-navigation").apply {
                    latitude = fix.latitude
                    longitude = fix.longitude
                    accuracy = fix.accuracy
                    time = fix.time
                    elapsedRealtimeNanos = fix.elapsedRealtimeNanos
                    if (fix.hasBearing() && fix.bearing.isFinite() && fix.bearing >= 0f && fix.bearing < 360f) {
                        bearing = fix.bearing
                        if (Build.VERSION.SDK_INT >= 26 && fix.hasBearingAccuracy() &&
                            fix.bearingAccuracyDegrees.isFinite() && fix.bearingAccuracyDegrees in 0f..360f)
                            bearingAccuracyDegrees = fix.bearingAccuracyDegrees
                    }
                    if (fix.hasSpeed() && fix.speed.isFinite() && fix.speed >= 0f) {
                        speed = fix.speed
                        if (Build.VERSION.SDK_INT >= 26 && fix.hasSpeedAccuracy() &&
                            fix.speedAccuracyMetersPerSecond.isFinite() && fix.speedAccuracyMetersPerSecond >= 0f)
                            speedAccuracyMetersPerSecond = fix.speedAccuracyMetersPerSecond
                    }
                }
                status(s, GpsQuality.AVAILABLE)
                if (!live(s) || source != sourceId) return
                if (runCatching { s.onFix(clean.toUserLocation()) }.isFailure) {
                    status(s, GpsQuality.LOST)
                    unsubscribe(s.id)
                }
            }
        }
    }
}
