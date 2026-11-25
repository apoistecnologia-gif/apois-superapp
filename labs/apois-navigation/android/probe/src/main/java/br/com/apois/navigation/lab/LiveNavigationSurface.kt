package br.com.apois.navigation.lab

import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import org.maplibre.compose.style.BaseStyle
import uniffi.ferrostar.Route

internal fun gpsStatusLabel(quality: GpsQuality): String? = when (quality) {
    GpsQuality.WAITING -> "Aguardando localização GPS…"
    GpsQuality.IMPRECISE -> "GPS impreciso. Orientação pausada."
    GpsQuality.LOST -> "Sinal GPS indisponível. Orientação pausada."
    GpsQuality.AVAILABLE -> null
}

/** Native MapLibre surface for the future authenticated host. No Activity or
 * manifest registration. Route and leg must be provided by that host.
 * A route replacement disposes the old subscription and exclusive voice lease.
 */
@Composable
internal fun LiveNavigationSurface(
    baseStyle: BaseStyle, route: Route?, token: LegToken?, ride: RideSnapshot,
    foreground: Boolean, stillCurrent: (LegToken) -> Boolean,
    onIntent: (RideIntent) -> Unit, modifier: Modifier = Modifier,
    acquireVoice: (() -> NavigationVoicePermit?)? = null,
    resources: LegRouteResources<Route>? = null,
    online: () -> Boolean = { false }, hostOperationsOnly:Boolean=false
) {
    val context = LocalContext.current.applicationContext
    val model = remember { LiveGpsNavigationModel() }
    val current by rememberUpdatedState(stillCurrent)
    val connectivity by rememberUpdatedState(online)
    val validLeg = token?.takeIf {
        it.rideId == ride.rideId &&
            ((it.leg == Leg.PICKUP && ride.phase == RidePhase.PICKUP) ||
             (it.leg == Leg.TRIP && ride.phase == RidePhase.TRIP))
    }
    val quality by model.quality.collectAsState()
    val routeNotice by model.routeNotice.collectAsState()
    // A replacement is owned by the model. Do not reset the leg budget for a new route object.
    DisposableEffect(model, route != null, validLeg, resources) {
        if (route != null && validLeg != null && current(validLeg)) {
            val lease = runCatching { acquireVoice?.invoke()?.let(::OnceNavigationVoicePermit) }.getOrNull()
            // Transfer ownership only when model.start succeeds; otherwise release.
            try { model.start(route, { current(validLeg) }, context, lease, resources, validLeg, { connectivity() }) }
            catch (_: Exception) {
                model.stopNavigation()
                lease?.let { runCatching { it.release() } }
            }
        } else model.stopNavigation()
        onDispose { model.stopNavigation() }
    }
    SideEffect {
        model.setDestination(ride.destination)
        model.setForeground(foreground && validLeg != null && current(validLeg))
    }
    ApoisNavigationScreen(baseStyle, model, ride, onIntent, modifier,
        gpsQuality = if (validLeg != null) quality else null,
        routeNotice = if (validLeg != null) routeNotice else null, hostOperationsOnly=hostOperationsOnly)
}
