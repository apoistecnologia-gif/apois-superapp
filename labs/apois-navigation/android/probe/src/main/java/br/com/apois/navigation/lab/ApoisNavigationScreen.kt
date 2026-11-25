package br.com.apois.navigation.lab

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.stadiamaps.ferrostar.composeui.config.NavigationViewComponentBuilder
import com.stadiamaps.ferrostar.composeui.config.withProgressView
import com.stadiamaps.ferrostar.core.NavigationViewModel
import com.stadiamaps.ferrostar.core.NavigationUiState
import com.stadiamaps.ferrostar.maplibreui.NavigationMapPuckStyle
import com.stadiamaps.ferrostar.maplibreui.views.PortraitNavigationView
import org.maplibre.compose.style.BaseStyle
import uniffi.ferrostar.TripState
import java.util.Locale
import kotlin.math.ceil

private val Red=Color(0xFFD50923)
private val Ink=Color(0xFF16191D)
private val Muted=Color(0xFF596474)

// Native MapLibre surface and native Compose controls; no external map launch,
// real location acquisition, payment, PIN validation or Supabase calls here.
// Caller supplies an independently licensed map style and a host ride snapshot.
// Lab-only, not registered in the existing APOIS app or manifest.
@Composable
internal fun ApoisNavigationScreen(
    baseStyle: BaseStyle,
    model: NavigationViewModel,
    ride: RideSnapshot,
    onIntent: (RideIntent) -> Unit,
    modifier: Modifier = Modifier,
    gpsQuality: GpsQuality? = null,
    routeNotice: String? = null
) {
    val ui by model.navigationUiState.collectAsState()
    // Lock immediately on local action until host changes revision, confirms busy/error.
    var sent by remember(ride.rideId,ride.revision,ride.phase,ride.busy,ride.error) { mutableStateOf(false) }
    val dispatch: (RideAction,Int?) -> Unit = { action,rating ->
        if(!sent) ride.intent(action,rating)?.let { sent=true; onIntent(it) }
    }
    val disabled=ride.busy || sent
    val palette=lightColorScheme(primary=Red,onPrimary=Color.White,surface=Color.White,onSurface=Ink)
    MaterialTheme(colorScheme=palette) {
        Box(modifier.fillMaxSize().background(Color(0xFFE5E2D9))) {
            val active=ride.phase in setOf(RidePhase.PICKUP,RidePhase.WAITING_PIN,RidePhase.TRIP)
            val sdkShowingProgress=ui.isNavigating() && active
            val components=NavigationViewComponentBuilder.Default().withProgressView { m,state,_ ->
                if(sdkShowingProgress) RidePanel(ride,state,disabled,dispatch,m.fillMaxWidth(),gpsQuality,routeNotice)
            }
            // Keep one map instance. Ferrostar's own camera, guidance, mute and recenter
            // remain in use, and custom progress size is measured by its overlay.
            PortraitNavigationView(
                modifier=Modifier.fillMaxSize(), baseStyle=baseStyle, viewModel=model,
                views=components, locationPuckStyle=NavigationMapPuckStyle(
                    dotFillColorCurrentLocation=Red,dotFillColorOldLocation=Red,bearingColor=Red
                ),
                onTapExit={dispatch(RideAction.RETURN,null)}
            )
            if(!sdkShowingProgress) {
                Box(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(horizontal=12.dp,vertical=8.dp)) {
                    RidePanel(ride,ui,disabled,dispatch,Modifier.fillMaxWidth(),gpsQuality,routeNotice)
                }
            }
        }
    }
}

@Composable
private fun RidePanel(ride: RideSnapshot, ui: NavigationUiState, disabled: Boolean,
                      dispatch:(RideAction,Int?)->Unit, modifier: Modifier=Modifier, gpsQuality: GpsQuality?=null, routeNotice: String?=null) {
    val arrived=ui.tripState is TripState.Complete
    val title=when(ride.phase) {
        RidePhase.PICKUP -> if(arrived) "Próximo ao embarque • aguardando confirmação" else "Indo ao passageiro"
        RidePhase.WAITING_PIN -> "Aguardando passageiro"
        RidePhase.TRIP -> if(arrived) "Chegada ao destino" else "Corrida em andamento"
        RidePhase.COMPLETED -> "Corrida concluída"
        RidePhase.CANCELLED -> "Corrida cancelada"
    }
    Surface(modifier=modifier,shape=RoundedCornerShape(20.dp),color=Color.White,shadowElevation=5.dp) {
        Column(Modifier.heightIn(max=300.dp).verticalScroll(rememberScrollState()).padding(14.dp),verticalArrangement=Arrangement.spacedBy(8.dp)) {
            Text(title,fontWeight=FontWeight.Bold,fontSize=17.sp,color=Ink)
            if(ride.phase in setOf(RidePhase.PICKUP,RidePhase.WAITING_PIN,RidePhase.TRIP)) {
                if(ride.phase != RidePhase.WAITING_PIN) gpsQuality?.let { quality ->
                    gpsStatusLabel(quality)?.let { Text(it, color=Muted, fontSize=13.sp) }
                }
                if(ride.phase != RidePhase.WAITING_PIN) routeNotice?.let { Text(it,color=Muted,fontSize=13.sp) }
                ui.progress?.let { progress ->
                    if(progress.distanceRemaining.isFinite() && progress.durationRemaining.isFinite() && progress.distanceRemaining>=0 && progress.durationRemaining>=0) {
                        val distance=if(progress.distanceRemaining<1000) "${progress.distanceRemaining.toInt()} m"
                            else String.format(Locale("pt","BR"),"%.1f km",progress.distanceRemaining/1000)
                        Text("${ceil(progress.durationRemaining/60).toInt()} min • $distance",fontSize=21.sp,fontWeight=FontWeight.Bold)
                    }
                }
                Text(ride.destination,maxLines=2,overflow=TextOverflow.Ellipsis,color=Muted,fontSize=14.sp)
            }
            ride.error?.let {Text(it,color=Red,fontSize=13.sp)}
            when(ride.phase) {
                RidePhase.PICKUP -> Text("A chegada depende da confirmação do sistema.",fontSize=12.sp,color=Muted)
                RidePhase.WAITING_PIN -> Button(onClick={dispatch(RideAction.OPEN_PIN,null)},enabled=!disabled,modifier=Modifier.fillMaxWidth().heightIn(min=48.dp)) { Text("Informar PIN de embarque") }
                RidePhase.TRIP -> {
                    // Slider is an explicit confirmation gesture, not arrival-driven.
                    // Early finish is still subject to existing server/host confirmation.
                    var slide by remember(ride.rideId,ride.revision,disabled) { mutableFloatStateOf(0f) }
                    Text("Deslize para finalizar corrida",fontWeight=FontWeight.SemiBold)
                    Slider(value=slide,onValueChange={slide=it},enabled=!disabled,
                        onValueChangeFinished={val confirm=slide>=0.97f;slide=0f;if(confirm)dispatch(RideAction.FINISH,null)})
                    Text("Finalização depende de confirmação do sistema.",fontSize=12.sp,color=Muted)
                }
                RidePhase.COMPLETED -> {
                    ride.totalLabel?.let { Text(it,fontSize=25.sp,color=Ink,fontWeight=FontWeight.Bold) }
                    Text("Avalie o passageiro",fontWeight=FontWeight.SemiBold)
                    var rating by remember(ride.rideId){mutableIntStateOf(0)}
                    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
                        for(n in 1..5) TextButton(onClick={rating=n},enabled=!disabled,contentPadding=PaddingValues(0.dp),modifier=Modifier.weight(1f).heightIn(min=48.dp)) {
                            Text(if(n<=rating)"★" else "☆",fontSize=26.sp,color=if(n<=rating)Red else Muted)
                        }
                    }
                    Button(onClick={dispatch(RideAction.RATE,rating)},enabled=!disabled&&rating>0,modifier=Modifier.fillMaxWidth().heightIn(min=48.dp)){Text("Enviar avaliação")}
                    TextButton(onClick={dispatch(RideAction.SKIP_RATING,null)},enabled=!disabled,modifier=Modifier.align(Alignment.CenterHorizontally)){Text("Agora não")}
                }
                RidePhase.CANCELLED -> Button(onClick={dispatch(RideAction.RETURN,null)},enabled=!disabled,modifier=Modifier.fillMaxWidth().heightIn(min=48.dp)){Text("Voltar")}
            }
            if(ride.phase in setOf(RidePhase.PICKUP,RidePhase.WAITING_PIN,RidePhase.TRIP)) {
                Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween) {
                    TextButton(onClick={dispatch(RideAction.RETURN,null)},enabled=!disabled){Text("Voltar ao APOIS")}
                    TextButton(onClick={dispatch(RideAction.REQUEST_EXTERNAL,null)},enabled=!disabled){Text("Outro mapa")}
                }
            }
            if(disabled) LinearProgressIndicator(Modifier.fillMaxWidth())
            // OSM attribution remains visible even with the operational panel expanded.
            Text("© OpenStreetMap contributors",fontSize=10.sp,color=Muted)
        }
    }
}
