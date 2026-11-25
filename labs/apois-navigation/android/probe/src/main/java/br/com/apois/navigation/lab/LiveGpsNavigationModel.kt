package br.com.apois.navigation.lab

import android.os.Looper
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

    private fun main() = check(Looper.myLooper() == Looper.getMainLooper())

    override fun setDestination(destination: String?) {
        main()
        this.destination = destination
        navigationUiState.value = navigationUiState.value.copy(destination = destination)
    }
    override fun toggleMute() {
        main()
        muted = !muted
        navigationUiState.value = navigationUiState.value.copy(isMuted = muted)
    }
    override fun stopNavigation() {
        main()
        ++generation
        subscriber?.let(DriverGpsFeed::unsubscribe)
        subscriber = null
        _quality.value = GpsQuality.WAITING
        navigationUiState.value = NavigationUiState.empty().copy(isMuted = muted)
    }

    fun start(route: Route, stillCurrent: () -> Boolean) {
        main()
        stopNavigation()
        check(stillCurrent()) { "Navigation leg no longer active" }
        val active = generation
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
        var nextFix: ((UserLocation) -> Unit)? = null
        fun current() = generation == active && stillCurrent()
        fun show(state: NavigationState) {
            if (!current()) return
            navigationUiState.value = NavigationUiState.fromFerrostar(state, muted)
                .copy(destination = destination)
        }
        subscriber = DriverGpsFeed.subscribe(
            current = ::current,
            onFix = { location ->
                if (current()) {
                    val update = nextFix
                    if (update == null) {
                        var state = navigator.getInitialState(location)
                        show(NavigationState(state.tripState, route.geometry, false))
                        nextFix = { fix ->
                            if (current() && state.tripState !is TripState.Complete) {
                                state = navigator.updateUserLocation(fix, state)
                                show(NavigationState(state.tripState, route.geometry, false))
                            }
                        }
                    } else update(location)
                }
            },
            onQuality = { status ->
                if (current()) {
                    _quality.value = status
                    if (status != GpsQuality.AVAILABLE) {
                        // Keep geometry for context, but do not present stale
                        // instructions or synthesize speech on a lost fix.
                        navigationUiState.value = navigationUiState.value.copy(
                            visualInstruction = null, spokenInstruction = null
                        )
                    }
                }
            }
        )
    }
}
