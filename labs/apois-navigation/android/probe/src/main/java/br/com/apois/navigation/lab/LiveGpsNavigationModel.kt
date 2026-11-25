package br.com.apois.navigation.lab

import android.os.Looper
import android.content.Context
import android.os.SystemClock
import com.stadiamaps.ferrostar.core.NavigationState
import com.stadiamaps.ferrostar.core.NavigationUiState
import com.stadiamaps.ferrostar.core.NavigationViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import uniffi.ferrostar.*

/**
 * Experimental live-location counterpart to LabReplayModel. Receives a route
 * already parsed by the caller; no routing HTTP, GPS acquisition, ride commands,
 * or TTS ownership. Not registered with the demo or production activity.
 */
internal class LiveGpsNavigationModel : NavigationViewModel {
    override val navigationUiState = MutableStateFlow(NavigationUiState.empty())
    private val _quality = MutableStateFlow(GpsQuality.WAITING)
    val quality = _quality.asStateFlow()
    private var subscriber: Long? = null
    private var generation = 0L
    private var muted = false
    private var destination: String? = null
    private var voice: LiveNavigationVoice? = null
    private var foreground = false
    private var rerouteGate: NativeRerouteGate? = null
    private val _routeNotice = MutableStateFlow<String?>(null)
    val routeNotice = _routeNotice.asStateFlow()

    private fun main() = check(Looper.myLooper() == Looper.getMainLooper())

    override fun setDestination(destination: String?) {
        main()
        this.destination = destination
        navigationUiState.value = navigationUiState.value.copy(destination = destination)
    }
    override fun toggleMute() {
        main()
        muted = !muted
        voice?.setMuted(muted)
        navigationUiState.value = navigationUiState.value.copy(isMuted = muted)
    }
    fun setForeground(value: Boolean) {
        main()
        foreground = value
        voice?.setForeground(value)
    }
    override fun stopNavigation() {
        main()
        ++generation
        subscriber?.let(DriverGpsFeed::unsubscribe)
        subscriber = null
        voice?.close()
        voice = null
        rerouteGate?.close()
        rerouteGate = null
        _routeNotice.value = null
        _quality.value = GpsQuality.WAITING
        navigationUiState.value = NavigationUiState.empty().copy(isMuted = muted)
    }

    fun start(route: Route, stillCurrent: () -> Boolean, context: Context? = null, permit: NavigationVoicePermit? = null) {
        main()
        stopNavigation()
        if (!stillCurrent()) { permit?.let { runCatching { it.release() } }; _quality.value = GpsQuality.LOST; return }
        val active = generation
        val budget = NativeRerouteGate()
        rerouteGate = budget
        val config = NavigationControllerConfig(
            WaypointAdvanceMode.WaypointWithinRange(30.0),
            stepAdvanceDistanceToEndOfStep(15u, 25u),
            stepAdvanceDistanceToEndOfStep(15u, 25u),
            RouteDeviationTracking.StaticThreshold(25u, 50.0),
            CourseFiltering.SNAP_TO_ROUTE
        )
        val navigator = createNavigator(route, config, false)
        // The first accepted physical fix initializes the Rust navigator.
        // No simulated location or last persisted location is used.
        var nextFix: ((UserLocation, Long) -> Unit)? = null
        fun current() = generation == active && stillCurrent()
        fun show(state: NavigationState, raw: UserLocation, captured: Long) {
            if (!current()) return
            val ui = NavigationUiState.fromFerrostar(state, muted).copy(destination = destination)
            val kind = (ui.routeDeviation as? RouteDeviation.Deviation)?.kind
            val offRoute = kind is DeviationKind.CompletelyOffRoute
            val offStep = kind is DeviationKind.OffStepOnRoute
            val deviation = when (kind) {
                is DeviationKind.CompletelyOffRoute -> kind.deviationFromRouteLine
                is DeviationKind.OffStepOnRoute -> kind.deviationFromStepLine
                else -> if (ui.routeDeviation != null) 0.0 else null
            }
            // The endpoint/provider is not wired yet. Evaluate the native policy
            // in offline mode and do not spend a route request authorization.
            val decision = budget.evaluate(SystemClock.elapsedRealtime(), captured,
                raw.horizontalAccuracy, deviation, online = false)
            val hold = offRoute || offStep || (decision is NativeRerouteGate.Decision.Hold &&
                decision.reason == NativeRerouteGate.Reason.UNRELIABLE && ui.isNavigating())
            _routeNotice.value = when {
                offRoute -> "Fora da rota. Recálculo ainda indisponível no laboratório."
                offStep -> "Conferindo o trajeto."
                hold -> "Conferindo a precisão da rota."
                else -> null
            }
            navigationUiState.value = if (hold) ui.copy(visualInstruction = null,
                spokenInstruction = null, progress = null, currentStepRoadName = null) else ui
            voice?.setGpsAvailable(!hold && ui.tripState !is TripState.Complete)
            if (!hold && ui.tripState !is TripState.Complete)
                ui.spokenInstruction?.let { voice?.speak(it) }
        }
        subscriber = DriverGpsFeed.subscribe(
            current = ::current,
            onFix = { location, captured ->
                if (current()) {
                    val update = nextFix
                    if (update == null) {
                        var state = navigator.getInitialState(location)
                        show(NavigationState(state.tripState, route.geometry, false), location, captured)
                        nextFix = { fix, fixCaptured ->
                            if (current() && state.tripState !is TripState.Complete) {
                                state = navigator.updateUserLocation(fix, state)
                                show(NavigationState(state.tripState, route.geometry, false), fix, fixCaptured)
                            }
                        }
                    } else update(location, captured)
                }
            },
            onQuality = { status ->
                if (current()) {
                    _quality.value = status
                    voice?.setGpsAvailable(status == GpsQuality.AVAILABLE)
                    if (status != GpsQuality.AVAILABLE) {
                        budget.invalidateFix()
                        _routeNotice.value = null
                        // Keep geometry for context, but do not present stale
                        // instructions or synthesize speech on a lost fix.
                        navigationUiState.value = navigationUiState.value.copy(
                            location = null, heading = null, tripState = null,
                            visualInstruction = null, spokenInstruction = null, progress = null,
                            routeDeviation = null, currentStepRoadName = null,
                            currentStepGeometryIndex = null, remainingSteps = null, currentAnnotation = null
                        )
                    }
                }
            },
            onRevoked = {
                if (generation == active) {
                    stopNavigation()
                    _quality.value = GpsQuality.LOST
                }
            }
        )
        val id = subscriber
        if (id == null || !current()) {
            stopNavigation()
            permit?.let { runCatching { it.release() } }
            _quality.value = GpsQuality.LOST
        } else if (permit != null) {
            // No implicit grant: the future host must first stop its legacy voice.
            if (context != null && runCatching { permit.isCurrent() }.getOrDefault(false)) {
                voice = try { LiveNavigationVoice(context, permit) }
                catch (_: Exception) { runCatching { permit.release() }; null }
                voice?.setMuted(muted)
                voice?.setForeground(foreground)
            } else runCatching { permit.release() }
        }
    }
}
