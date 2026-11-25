package br.com.apois.navigation.lab

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.stadiamaps.ferrostar.core.FerrostarCore
import com.stadiamaps.ferrostar.core.NavigationViewModel
import com.stadiamaps.ferrostar.core.AndroidTtsObserver
import com.stadiamaps.ferrostar.maplibreui.views.PortraitNavigationView
import org.maplibre.compose.style.BaseStyle
import uniffi.ferrostar.WellKnownRouteProvider

// Compile-time proof only. No live service is started, no permission or network
// request is made. The eventual route server is supplied by a separate experiment.
internal fun probeProvider(): WellKnownRouteProvider =
    WellKnownRouteProvider.Valhalla("https://navigation.invalid/route", "auto")

internal data class NavigationDependencies(
    val core: FerrostarCore,
    val voice: AndroidTtsObserver
)

@Composable
internal fun NavigationSurface(style: BaseStyle, model: NavigationViewModel, modifier: Modifier = Modifier) {
    PortraitNavigationView(modifier = modifier, baseStyle = style, viewModel = model)
}
