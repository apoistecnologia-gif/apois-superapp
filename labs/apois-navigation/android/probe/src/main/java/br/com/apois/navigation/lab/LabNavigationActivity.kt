package br.com.apois.navigation.lab

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.stadiamaps.ferrostar.core.NavigationUiState
import com.stadiamaps.ferrostar.core.NavigationViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import org.maplibre.compose.style.BaseStyle

// Actual native screen, empty SDK state and entirely local style. This tests
// transport and rendering integration only, not turn-by-turn navigation.
class LabNavigationActivity:ComponentActivity(){
    private var sessionId:String?=null
    private val model=object:NavigationViewModel {
        override val navigationUiState=MutableStateFlow(NavigationUiState.empty())
        override fun setDestination(destination:String?){navigationUiState.value=navigationUiState.value.copy(destination=destination)}
        override fun toggleMute(){navigationUiState.value=navigationUiState.value.copy(isMuted=navigationUiState.value.isMuted!=true)}
        override fun stopNavigation(){navigationUiState.value=NavigationUiState.empty()}
    }
    override fun onCreate(savedInstanceState:Bundle?){
        super.onCreate(savedInstanceState)
        val id=intent.getStringExtra("labSession")
        if(id==null||LabNavigationBridge.screen.value?.sessionId!=id){finish();return}
        sessionId=id
        setContent {
            val state by LabNavigationBridge.screen.collectAsState()
            LaunchedEffect(state?.sessionId){if(state?.sessionId!=id)finish()}
            BackHandler { LabNavigationBridge.close(id);finish() }
            state?.takeIf{it.sessionId==id}?.let{current->
                Column(Modifier.fillMaxSize().statusBarsPadding()){
                    Text("LABORATÓRIO • mapa local sem rota real",Modifier.padding(8.dp))
                    ApoisNavigationScreen(
                        baseStyle=BaseStyle.Uri("asset://apois-lab-style.json"),
                        model=model,ride=current.ride,
                        onIntent={LabNavigationBridge.submit(id,it)},
                        modifier=Modifier.weight(1f)
                    )
                }
            }
        }
    }
    override fun onDestroy(){
        if(!isChangingConfigurations)sessionId?.let{LabNavigationBridge.close(it)}
        super.onDestroy()
    }
}
