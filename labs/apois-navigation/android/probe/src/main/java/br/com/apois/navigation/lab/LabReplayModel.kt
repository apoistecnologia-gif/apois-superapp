package br.com.apois.navigation.lab

import android.content.Context
import com.stadiamaps.ferrostar.core.NavigationState
import com.stadiamaps.ferrostar.core.NavigationUiState
import com.stadiamaps.ferrostar.core.NavigationViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import uniffi.ferrostar.*

// Uses the actual Rust navigator via Android UniFFI bindings. No network client,
// GPS permission, backend access or automatic rerouting. Fictitious grid only.
internal class LabReplayModel(private val context:Context):NavigationViewModel {
    override val navigationUiState=MutableStateFlow(NavigationUiState.empty())
    val failure=MutableStateFlow<String?>(null)
    private val foreground=MutableStateFlow(false)
    private var muted=false
    private var destination:String?=null
    private var voice:PortugueseVoiceObserver?=null
    override fun setDestination(destination:String?){
        this.destination=destination
        navigationUiState.value=navigationUiState.value.copy(destination=destination)
    }
    override fun toggleMute(){
        muted=!muted
        voice?.setMuted(muted)
        navigationUiState.value=navigationUiState.value.copy(isMuted=muted)
    }
    fun setForeground(value:Boolean){
        foreground.value=value
        if(!value)voice?.stopAndClearQueue()
    }
    override fun stopNavigation(){
        voice?.stopAndClearQueue()
        navigationUiState.value=NavigationUiState.empty().copy(isMuted=muted)
    }
    suspend fun play(token:LegToken, stillCurrent:()->Boolean){
        failure.value=null
        stopNavigation()
        try {
            val adapter=RouteAdapter.fromWellKnownRouteProvider(WellKnownRouteProvider.Valhalla("https://navigation.invalid/route","auto"))
            val bytes=context.assets.open("apois-lab-route.json").use{it.readBytes()}
            val route=adapter.parseResponse(bytes).first()
            val config=NavigationControllerConfig(
                WaypointAdvanceMode.WaypointWithinRange(30.0),
                stepAdvanceDistanceToEndOfStep(15u,25u),
                stepAdvanceDistanceToEndOfStep(15u,25u),
                RouteDeviationTracking.StaticThreshold(25u,50.0),
                CourseFiltering.SNAP_TO_ROUTE
            )
            val navigator=createNavigator(route,config,false)
            var simulation=locationSimulationFromRoute(route,10.0,LocationBias.None)
            var state=navigator.getInitialState(simulation.currentLocation)
            foreground.first{it}
            if(!stillCurrent())return
            val speech=PortugueseVoiceObserver(context)
            voice=speech
            speech.setMuted(muted)
            try {
                for(i in 0..2000){
                    foreground.first{it}
                    if(!stillCurrent())break
                    val ui=NavigationUiState.fromFerrostar(NavigationState(state.tripState,route.geometry,false),muted)
                        .copy(destination=destination)
                    navigationUiState.value=ui
                    if(ui.tripState is TripState.Complete)break
                    if(i==2000){
                        failure.value="Limite de reprodução alcançado."
                        stopNavigation()
                        break
                    }
                    if(foreground.value&&stillCurrent())ui.spokenInstruction?.let{speech.onSpokenInstructionTrigger(it)}
                    delay(750)
                    foreground.first{it}
                    if(!stillCurrent())break
                    val next=advanceLocationSimulation(simulation)
                    if(next==simulation){
                        // Never claim arrival simply because replay input ended.
                        failure.value="Trajeto simulado terminou sem confirmação de chegada."
                        stopNavigation()
                        break
                    }
                    simulation=next
                    state=navigator.updateUserLocation(simulation.currentLocation,state)
                }
            } finally {
                speech.close()
                if(voice===speech)voice=null
            }
        } catch(e:CancellationException){throw e}
        catch(e:Exception){failure.value="Não foi possível iniciar a simulação.";stopNavigation()}
    }
}
