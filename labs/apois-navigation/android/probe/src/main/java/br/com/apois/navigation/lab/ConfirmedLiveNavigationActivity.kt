package br.com.apois.navigation.lab

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import kotlinx.coroutines.delay

// Non-exported. The intent only identifies the process-local prepared session.
// After process death or a stale intent there is no matching state: finish.
class ConfirmedLiveNavigationActivity:ComponentActivity(){
    private var sessionId:String?=null
    private var claimed=false
    private var foreground by mutableStateOf(false)

    override fun onCreate(savedInstanceState:Bundle?){
        super.onCreate(savedInstanceState)
        val id=intent.getStringExtra("confirmedSession")
        sessionId=id
        if(id==null||!ConfirmedLiveNavigationBridge.claimActivity(id,this)){finish();return}
        claimed=true
        val initial=ConfirmedLiveNavigationBridge.screen.value
        if(initial?.id!=id||!ConfirmedLiveNavigationBridge.accepts(id,initial.token)){
            finish();return
        }
        setContent{
            val state by ConfirmedLiveNavigationBridge.screen.collectAsState()
            LaunchedEffect(state?.id){if(state?.id!=id)finish()}
            // GPS may not be available. Check authority even with no callbacks.
            LaunchedEffect(id){
                while(true){
                    val s=ConfirmedLiveNavigationBridge.screen.value
                    if(s?.id!=id)break
                    if(!ConfirmedLiveNavigationBridge.accepts(id,s.token)){
                        ConfirmedLiveNavigationBridge.revoke()
                        break
                    }
                    delay(1000)
                }
            }
            BackHandler{ConfirmedLiveNavigationBridge.close(id);finish()}
            state?.takeIf{it.id==id}?.let{s->
                Column(Modifier.fillMaxSize().statusBarsPadding()){
                    LiveNavigationSurface(
                        baseStyle=s.owner.map.style,route=s.owner.route,token=s.token,ride=s.ride,
                        foreground=foreground,stillCurrent={ConfirmedLiveNavigationBridge.accepts(id,it)},
                        onIntent={ConfirmedLiveNavigationBridge.submit(id,it)},
                        modifier=Modifier.weight(1f),acquireVoice={ConfirmedLiveNavigationBridge.acquireVoice(id)},
                        resources=s.resources,online=s.owner.online,hostOperationsOnly=true
                    )
                }
            }
        }
    }
    override fun onResume(){super.onResume();foreground=true}
    override fun onPause(){foreground=false;super.onPause()}
    override fun onDestroy(){
        // Configuration recreation is deliberately a new entry, not an
        // inherited route/voice authority. Close this owner and acknowledge
        // only after super.onDestroy; any recreated stale Intent is inert.
        if(claimed)sessionId?.let{ConfirmedLiveNavigationBridge.close(it)}
        super.onDestroy()
        if(claimed)sessionId?.let{ConfirmedLiveNavigationBridge.activityDestroyed(it,this)}
        claimed=false
    }
}
