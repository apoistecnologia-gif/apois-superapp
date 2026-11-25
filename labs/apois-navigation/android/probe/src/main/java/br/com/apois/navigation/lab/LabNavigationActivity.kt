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

// Local map and real navigation engine with a fictional route. No live trips.
class LabNavigationActivity:ComponentActivity(){
    private var sessionId:String?=null
    private val model by lazy { LabReplayModel(applicationContext) }
    override fun onCreate(savedInstanceState:Bundle?){
        super.onCreate(savedInstanceState)
        val id=intent.getStringExtra("labSession")
        if(id==null||LabNavigationBridge.screen.value?.sessionId!=id){finish();return}
        sessionId=id
        setContent {
            val state by LabNavigationBridge.screen.collectAsState()
            LaunchedEffect(state?.sessionId){if(state?.sessionId!=id)finish()}
            BackHandler { LabNavigationBridge.close(id);finish() }
            val failure by model.failure.collectAsState()
            state?.takeIf{it.sessionId==id}?.let{current->
                LaunchedEffect(current.token){
                    val token=current.token
                    if(token==null)model.stopNavigation()
                    else model.play(token){LabNavigationBridge.accepts(id,token)}
                }
                LaunchedEffect(current.ride.destination){model.setDestination(current.ride.destination)}
                Column(Modifier.fillMaxSize().statusBarsPadding()){
                    Text("LABORATÓRIO • trajeto fictício, sem GPS real",Modifier.padding(8.dp))
                    failure?.let{Text(it,Modifier.padding(8.dp))}
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
    override fun onResume(){super.onResume();model.setForeground(true)}
    override fun onPause(){model.setForeground(false);super.onPause()}
    override fun onDestroy(){
        if(!isChangingConfigurations)sessionId?.let{LabNavigationBridge.close(it)}
        super.onDestroy()
    }
}
