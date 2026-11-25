package br.com.apois.navigation.lab

import java.net.URI
import java.net.HttpURLConnection
import java.io.ByteArrayOutputStream
import javax.net.ssl.HttpsURLConnection
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runInterruptible
import org.json.JSONObject
import org.json.JSONArray
import uniffi.ferrostar.*
import kotlin.math.*

// No default host. Caller must supply a trusted, explicitly authorized
// first-party endpoint and coordinates with independent/OSM provenance.
internal data class RegionalPoint(val lat: Double, val lng: Double) {
    fun valid(): Boolean = lat.isFinite() && lng.isFinite() &&
        lat in -9.65..-9.10 && lng in -40.80..-40.20
    fun distanceTo(other: RegionalPoint): Double {
        val a = Math.toRadians(other.lat - lat)
        val b = Math.toRadians(other.lng - lng)
        val h = sin(a / 2).pow(2) + cos(Math.toRadians(lat)) *
            cos(Math.toRadians(other.lat)) * sin(b / 2).pow(2)
        return 12_742_000.0 * asin(sqrt(h.coerceIn(0.0, 1.0)))
    }
}

internal fun validatedRouteEndpoint(raw: String, authorizedHost: String): URI {
    val uri = URI(raw)
    require(authorizedHost.isNotBlank() && authorizedHost.matches(Regex("[A-Za-z0-9.-]+")))
    require(uri.scheme == "https" && uri.host.equals(authorizedHost, ignoreCase = true))
    require(uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null)
    require(uri.port == -1 || uri.port == 443)
    require(uri.rawPath == "/route")
    return uri
}

internal fun routeEndpointsMatch(points: List<RegionalPoint>, origin: RegionalPoint, destination: RegionalPoint): Boolean =
    origin.valid() && destination.valid() && points.size in 2..100_000 &&
        points.all { it.valid() } && points.first().distanceTo(origin) <= 150.0 &&
        points.last().distanceTo(destination) <= 150.0

internal fun mayApplyReroute(
    current: Boolean, foreground: Boolean, offRoute: Boolean, quality: GpsQuality,
    pending: Boolean, now: Long, captured: Long, accuracy: Double,
    geometry: List<RegionalPoint>, latest: RegionalPoint, target: RegionalPoint
): Boolean = current && foreground && offRoute && pending &&
    quality == GpsQuality.AVAILABLE && captured > 0 &&
    now >= captured && now - captured <= 10_000L &&
    accuracy.isFinite() && accuracy > 0 && accuracy <= 25.0 &&
    routeEndpointsMatch(geometry,latest,target)

internal fun interface LiveRouteResolver {
    suspend fun resolve(origin: RegionalPoint, destination: RegionalPoint): Route
}

/** Bounded HTTPS client for Valhalla OSRM-compatible guidance, same contract as
 * the regional lab. No retries, redirects, coordinates in logs, or public demo.
 * Only invoked by the explicitly enabled host through a LiveRouteResolver.
 */
internal class ValhallaRouteClient(endpoint: String, authorizedHost: String, private val authorization:RouteCapabilityScope) : LiveRouteResolver {
    private val uri = validatedRouteEndpoint(endpoint, authorizedHost)
    override suspend fun resolve(origin: RegionalPoint, destination: RegionalPoint): Route {
        // Main-dispatcher scope must still be current before and after issuing.
        val permit=checkNotNull(authorization.acquire(origin,destination)){"Route authorization unavailable"}
        check(authorization.authorized(origin,destination)){"Route authorization revoked"}
        val result=runInterruptible(Dispatchers.IO) {
            require(origin.valid() && destination.valid())
            val body = JSONObject().put("locations", JSONArray().apply {
                for (p in listOf(origin, destination)) put(JSONObject().put("lat", p.lat)
                    .put("lon", p.lng).put("type", "break"))
            }).put("costing", "auto").put("units", "kilometers").put("language", "pt-BR")
                .put("format", "osrm").put("voice_instructions", true)
                .put("banner_instructions", true).put("shape_format", "polyline6")
                .toString().toByteArray(Charsets.UTF_8)
            val conn = uri.toURL().openConnection() as HttpsURLConnection
            val deadline = System.nanoTime() + 12_000_000_000L
            try {
                conn.instanceFollowRedirects = false
                conn.connectTimeout = 4_000
                conn.readTimeout = 4_000
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.useCaches = false
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Accept", "application/json")
                conn.setRequestProperty("Authorization",permit.header())
                conn.setFixedLengthStreamingMode(body.size)
                conn.outputStream.use { it.write(body) }
                check(conn.responseCode == HttpURLConnection.HTTP_OK) { "Route unavailable" }
                check(conn.contentLength <= 2_000_000) { "Route response too large" }
                val bytes = conn.inputStream.use { input ->
                    val output = ByteArrayOutputStream()
                    val buf = ByteArray(8192)
                    while (true) {
                        check(!Thread.currentThread().isInterrupted && System.nanoTime() < deadline)
                        val count = input.read(buf)
                        if (count < 0) break
                        check(output.size() + count <= 2_000_000) { "Route response too large" }
                        output.write(buf, 0, count)
                    }
                    output.toByteArray()
                }
                val adapter = RouteAdapter.fromWellKnownRouteProvider(
                    WellKnownRouteProvider.Valhalla(uri.toString(), "auto"))
                val route = adapter.parseResponse(bytes).first()
                check(routeEndpointsMatch(route.geometry.map { RegionalPoint(it.lat,it.lng) },
                    origin,destination)) { "Route geometry outside authorized corridor" }
                route
            } finally { conn.disconnect() }
        }
        check(authorization.authorized(origin,destination)){"Route authorization revoked"}
        return result
    }
}
