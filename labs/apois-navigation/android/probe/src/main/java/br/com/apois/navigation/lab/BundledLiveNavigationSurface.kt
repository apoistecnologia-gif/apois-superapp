package br.com.apois.navigation.lab

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import org.maplibre.compose.style.BaseStyle
import uniffi.ferrostar.Route

/** Future host entrypoint; deliberately not called by production or the replay
 * Activity. The map must verify before subscribing to GPS or taking voice.
 * Failure only offers host-mediated return/fallback, never changes ride phase.
 */
@Composable
internal fun BundledLiveNavigationSurface(
    route: Route?, token: LegToken?, ride: RideSnapshot,
    foreground: Boolean, stillCurrent: (LegToken) -> Boolean,
    onIntent: (RideIntent) -> Unit, modifier: Modifier = Modifier,
    acquireVoice: (() -> NavigationVoicePermit?)? = null,
    resources: LegRouteResources<Route>? = null, online: () -> Boolean = { false }, hostOperationsOnly:Boolean=false
) {
    val context = LocalContext.current.applicationContext
    val current by rememberUpdatedState(stillCurrent)
    // Reset synchronously when the ride changes; never render a previous
    // preparation result under a new ride. Phase changes alone may retain map.
    var style by remember(ride.rideId) { mutableStateOf<BaseStyle.Json?>(null) }
    var failed by remember(ride.rideId) { mutableStateOf(false) }
    LaunchedEffect(ride.rideId) {
        val result = BundledRegionalMap.verifiedStyle(context)
        style = result
        failed = result == null
    }
    val ready = style
    if (ready != null) {
        LiveNavigationSurface(ready,route,token,ride,foreground,current,onIntent,modifier,
            acquireVoice,resources,online,hostOperationsOnly)
    } else {
        var sent by remember(ride.rideId,ride.revision,ride.phase,ride.busy,ride.error) { mutableStateOf(false) }
        val dispatch: (RideAction) -> Unit = { action ->
            if (!sent) ride.intent(action)?.let { sent=true;onIntent(it) }
        }
        Column(modifier.fillMaxSize().padding(20.dp), verticalArrangement=Arrangement.Center,
            horizontalAlignment=Alignment.CenterHorizontally) {
            if (!failed) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Preparando mapa regional…")
            } else {
                Text("Mapa regional indisponível.")
                Text("Volte ao APOIS ou escolha outro mapa.")
            }
            Spacer(Modifier.height(16.dp))
            if (failed && ride.intent(RideAction.REQUEST_EXTERNAL)!=null) {
                Button(onClick={dispatch(RideAction.REQUEST_EXTERNAL)},enabled=!sent) { Text(if(hostOperationsOnly)"Outro mapa no APOIS" else "Outro mapa") }
            }
            TextButton(onClick={dispatch(RideAction.RETURN)},enabled=!sent&&!ride.busy) { Text("Voltar ao APOIS") }
        }
    }
}
