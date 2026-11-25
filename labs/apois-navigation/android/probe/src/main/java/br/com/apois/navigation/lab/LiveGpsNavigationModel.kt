package br.com.apois.navigation.lab

import android.os.Looper
import android.content.Context
import android.os.SystemClock
import com.stadiamaps.ferrostar.core.NavigationState
import com.stadiamaps.ferrostar.core.NavigationUiState
import com.stadiamaps.ferrostar.core.NavigationViewModel
import kotlinx.coroutines.*
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
    private var routeJob: Job? = null
    private var scope: CoroutineScope? = null
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
        if (!value) routeJob?.cancel()
        voice?.setForeground(value)
    }
    override fun stopNavigation() {
        main()
        ++generation
        subscriber?.let(DriverGpsFeed::unsubscribe)
        subscriber = null
        voice?.close()
        voice = null
        routeJob?.cancel()
        routeJob = null
        scope?.cancel()
        scope = null
        rerouteGate?.close()
        rerouteGate = null
        _routeNotice.value = null
        _quality.value = GpsQuality.WAITING
        navigationUiState.value = NavigationUiState.empty().copy(isMuted = muted)
    }

    fun start(route: Route, stillCurrent: () -> Boolean, context: Context? = null, permit: NavigationVoicePermit? = null,
              resolver: LiveRouteResolver? = null, target: RegionalPoint? = null,
              online: () -> Boolean = { false }) {
        main()
        stopNavigation()
        if (!stillCurrent()) { permit?.let { runCatching { it.release() } }; _quality.value = GpsQuality.LOST; return }
        val active = generation
        val budget = NativeRerouteGate()
        rerouteGate = budget
        val sessionScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        scope = sessionScope
        val config = NavigationControllerConfig(
            WaypointAdvanceMode.WaypointWithinRange(30.0),
            stepAdvanceDistanceToEndOfStep(15u, 25u),
            stepAdvanceDistanceToEndOfStep(15u, 25u),
            RouteDeviationTracking.StaticThreshold(25u, 50.0),
            CourseFiltering.SNAP_TO_ROUTE
        )
        var activeRoute = route
        var navigator = createNavigator(activeRoute, config, false)
        var latest: UserLocation? = null
        var latestCaptured = 0L
        var stillOffRoute = false
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
            stillOffRoute = offRoute
            val deviation = when (kind) {
                is DeviationKind.CompletelyOffRoute -> kind.deviationFromRouteLine
                is DeviationKind.OffStepOnRoute -> 0.0
                else -> if (ui.routeDeviation != null) 0.0 else null
            }
            val canRequest = resolver != null && target?.valid() == true &&
                RegionalPoint(raw.coordinates.lat,raw.coordinates.lng).valid() &&
                foreground && runCatching { online() }.getOrDefault(false)
            val decision = budget.evaluate(SystemClock.elapsedRealtime(), captured,
                raw.horizontalAccuracy, deviation, online = canRequest)
            if (!offRoute) routeJob?.cancel()
            if (offRoute && decision is NativeRerouteGate.Decision.Request && resolver != null && target != null) {
                val origin = RegionalPoint(raw.coordinates.lat,raw.coordinates.lng)
                val ticket = decision.ticket
                // Scope and gate belong to the whole leg, not the individual route.
                // Enter try immediately, then yield. Cancellation before the
                // request starts must still settle the budget ticket.
                val job = sessionScope.launch(start = CoroutineStart.UNDISPATCHED) {
                    try {
                        yield()
                        ensureActive()
                        val replacement = withTimeout(15_000) { resolver.resolve(origin,target) }
                        ensureActive()
                        val fix = latest ?: return@launch
                        if (!mayApplyReroute(current(), foreground, stillOffRoute,
                            _quality.value, budget.isPending(ticket), SystemClock.elapsedRealtime(),
                            latestCaptured, fix.horizontalAccuracy,
                            replacement.geometry.map { RegionalPoint(it.lat,it.lng) },
                            RegionalPoint(fix.coordinates.lat,fix.coordinates.lng),target)) return@launch
                        val freshNavigator = createNavigator(replacement, config, false)
                        activeRoute = replacement
                        navigator = freshNavigator
                        nextFix = null // initialize only from the next accepted GPS fix
                        stillOffRoute = false
                        voice?.setGpsAvailable(false)
                        navigationUiState.value = NavigationUiState.empty().copy(
                            routeGeometry = replacement.geometry, destination = destination, isMuted = muted)
                        _routeNotice.value = "Rota atualizada. Aguardando posição."
                    } catch (_: TimeoutCancellationException) {
                        if (current() && stillOffRoute) _routeNotice.value = "Tempo de recálculo excedido. Confira o trajeto."
                    } catch (e: CancellationException) { throw e }
                    catch (_: Exception) {
                        if (current() && stillOffRoute) _routeNotice.value = "Não foi possível recalcular. Confira o trajeto."
                    } finally {
                        budget.settle(ticket)
                        if (current() && stillOffRoute && _routeNotice.value == "Recalculando rota…")
                            _routeNotice.value = "Fora da rota. Aguardando nova posição."
                    }
                }
                routeJob = job
            }
            val hold = offRoute || offStep || (decision is NativeRerouteGate.Decision.Hold &&
                decision.reason == NativeRerouteGate.Reason.UNRELIABLE && ui.isNavigating())
            _routeNotice.value = when {
                offRoute && decision is NativeRerouteGate.Decision.OfferExternal -> "Limite de recálculos atingido. Use outro mapa se necessário."
                offRoute && routeJob?.isActive == true -> "Recalculando rota…"
                offRoute && !canRequest -> "Fora da rota. Recálculo indisponível."
                offRoute -> "Fora da rota. Conferindo desvio."
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
                    latest = location
                    latestCaptured = captured
                    val update = nextFix
                    if (update == null) {
                        var state = navigator.getInitialState(location)
                        show(NavigationState(state.tripState, activeRoute.geometry, false), location, captured)
                        nextFix = { fix, fixCaptured ->
                            if (current() && state.tripState !is TripState.Complete) {
                                state = navigator.updateUserLocation(fix, state)
                                show(NavigationState(state.tripState, activeRoute.geometry, false), fix, fixCaptured)
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
                        stillOffRoute = false
                        latest = null
                        routeJob?.cancel()
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
