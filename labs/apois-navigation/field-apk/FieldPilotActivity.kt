package br.com.apois.navigation.lab

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Bundle
import android.os.Looper
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.stadiamaps.ferrostar.maplibreui.views.PortraitNavigationView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.maplibre.compose.style.BaseStyle
import uniffi.ferrostar.*
import java.io.File
import java.util.Locale

// Standalone disposable APK, with no account, ride commands, network or background location.
class FieldPilotActivity:ComponentActivity(),LocationListener {
    private lateinit var manager:LocationManager
    private val model=LiveGpsNavigationModel()
    private var bundle by mutableStateOf<FieldBundle?>(null)
    private var selected by mutableStateOf<String?>(null)
    private var state by mutableStateOf("Escolha um trajeto de referência.")
    private var distance by mutableStateOf<Double?>(null)
    private var active by mutableStateOf(false)
    private var foreground=false
    private var source:Long?=null
    private var preflight:Long?=null
    private var tts:TextToSpeech?=null
    private var voiceReady by mutableStateOf(false)
    private var generation=0L
    override fun onCreate(savedInstanceState:Bundle?) {
        super.onCreate(savedInstanceState)
        manager=getSystemService(Context.LOCATION_SERVICE) as LocationManager
        tts=TextToSpeech(applicationContext){status->
            runOnUiThread {
                if(!isDestroyed&&status==TextToSpeech.SUCCESS){
                    val engine=tts
                    val voice=engine?.voices?.firstOrNull{it.locale.language=="pt"&&it.locale.country=="BR"&&!it.isNetworkConnectionRequired}
                    voiceReady=voice!=null&&engine.setVoice(voice)==TextToSpeech.SUCCESS
                }
            }
        }
        setContent{
            val quality by model.quality.collectAsState()
            val notice by model.routeNotice.collectAsState()
            val ui by model.navigationUiState.collectAsState()
            LaunchedEffect(Unit){
                bundle=withContext(Dispatchers.IO){runCatching{loadFieldBundle(applicationContext)}.getOrNull()}
                if(bundle==null)state="Falha na integridade do mapa. Teste indisponível."
            }
            BackHandler{if(selected!=null)stopPilot() else finish()}
            MaterialTheme{
                Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(12.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
                    Text("APOIS GPS • Piloto PI",style=MaterialTheme.typography.headlineSmall)
                    Text("Rota pré-calculada · GPS físico · sem recálculo",style=MaterialTheme.typography.bodySmall)
                    if(selected==null){
                        Text("Teste como passageiro ou com o veículo parado. Não opere o celular dirigindo.")
                        Text(if(bundle==null)"Verificando mapas..." else "Mapa local verificado.")
                        for((id,label) in listOf("itainopolis" to "Itainópolis — 1,29 km","picos" to "Picos — 1,18 km","corridor" to "Itainópolis → Picos — 51,32 km")){
                            Button(onClick={startPilot(id)},enabled=bundle!=null,modifier=Modifier.fillMaxWidth()){Text(label)}
                        }
                    }else{
                        Text(state)
                        distance?.let{Text("Distância até o início: "+String.format(Locale("pt","BR"),"%.0f m",it))}
                        if(active){
                            val style=bundle?.style
                            if(style!=null)PortraitNavigationView(modifier=Modifier.weight(1f).fillMaxWidth(),baseStyle=style,viewModel=model,onTapExit={stopPilot()})
                            gpsStatusLabel(quality)?.let{Text(it)}
                            notice?.let{Text(it)}
                            if(ui.tripState is TripState.Complete)Text("Chegada ao destino de teste. Nenhuma corrida real finalizada.")
                        }
                        Text(if(voiceReady)"Voz offline pt-BR disponível" else "Voz offline pt-BR indisponível; orientação visual")
                        Button(onClick={stopPilot()},modifier=Modifier.fillMaxWidth()){Text("Encerrar teste")}
                    }
                    Text("© OpenStreetMap contributors",style=MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
    private fun startPilot(id:String){
        if(!foreground||selected!=null||bundle?.routes?.containsKey(id)!=true)return
        if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION),71)
            state="Conceda localização precisa e selecione novamente.";return
        }
        if(!manager.isProviderEnabled(LocationManager.GPS_PROVIDER)){state="Ative o GPS do aparelho.";return}
        val route=bundle!!.routes.getValue(id)
        val origin=route.geometry.first().let{RegionalPoint(it.lat,it.lng)}
        selected=id;state="Aproxime-se do início da rota e aguarde GPS preciso.";distance=null
        val ticket=++generation
        val sid=DriverGpsFeed.beginSource();source=sid
        preflight=DriverGpsFeed.subscribe(current={foreground&&generation==ticket&&source==sid},
            onFix={fix,captured->
                val point=RegionalPoint(fix.coordinates.lat,fix.coordinates.lng)
                val delta=origin.distanceTo(point);distance=delta
                if(delta<=35.0&&fix.horizontalAccuracy<=20.0&&SystemClock.elapsedRealtime()-captured<=5000){
                    preflight?.let(DriverGpsFeed::unsubscribe);preflight=null
                    active=true;distance=null;state="Orientação por GPS real. Trajeto fixo; sem recálculo."
                    model.setDestination("Destino de teste")
                    model.start(route,{foreground&&generation==ticket&&source==sid},applicationContext,voicePermit(ticket))
                    model.setForeground(true)
                }
            },onQuality={q->if(q!=GpsQuality.AVAILABLE)state=gpsStatusLabel(q)?:"Aguardando GPS."},
            onRevoked={stopPilot()})
        try{
            check(preflight!=null)
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,1000L,0f,this,Looper.getMainLooper())
        }catch(_:Exception){stopPilot();state="Não foi possível iniciar GPS."}
    }
    private fun voicePermit(ticket:Long)=object:NavigationVoicePermit{
        private var released=false
        override fun isCurrent()=!released&&foreground&&generation==ticket&&source!=null
        override fun speak(text:String):Boolean {
            if(!isCurrent())return false
            // Missing offline voice is visual-only, not a request to download a voice.
            if(!voiceReady)return true
            return tts?.speak(text,TextToSpeech.QUEUE_FLUSH,null,"field-"+SystemClock.elapsedRealtime())==TextToSpeech.SUCCESS
        }
        override fun stop()=tts?.stop()==TextToSpeech.SUCCESS
        override fun release(){if(!released){released=true;tts?.stop()}}
    }
    private fun stopPilot(){
        generation++
        model.setForeground(false);model.stopNavigation()
        runCatching{manager.removeUpdates(this)}
        preflight?.let(DriverGpsFeed::unsubscribe);preflight=null
        val old=source;source=null;old?.let(DriverGpsFeed::endSource)
        tts?.stop();active=false;selected=null;distance=null;state="Teste encerrado. Escolha um trajeto."
    }
    override fun onLocationChanged(location:Location){
        if(!foreground)return
        val sid=source?:return
        DriverGpsFeed.publish(sid,DriverGpsFeed.consumerTicket(sid),location)
    }
    override fun onProviderDisabled(provider:String){stopPilot();state="GPS desativado. Teste encerrado."}
    override fun onProviderEnabled(provider:String){}
    @Deprecated("Legacy callback") override fun onStatusChanged(provider:String?,status:Int,extras:Bundle?){}
    override fun onResume(){super.onResume();foreground=true}
    override fun onPause(){foreground=false;stopPilot();super.onPause()}
    override fun onDestroy(){stopPilot();tts?.shutdown();tts=null;super.onDestroy()}
}
private data class FieldBundle(val style:BaseStyle.Json,val routes:Map<String,Route>)
private var fieldStore:PrivateMapStore?=null
private fun loadFieldBundle(context:Context):FieldBundle {
    val root="apois-field-pilot/"
    fun read(path:String,max:Int):ByteArray=context.assets.open(root+path).use{input->
        val b=java.io.ByteArrayOutputStream();val buf=ByteArray(8192)
        while(true){val n=input.read(buf);if(n<0)break;check(n>0&&b.size()+n<=max);b.write(buf,0,n)}
        b.toByteArray()
    }
    val manifest=read("manifest.json",32768)
    require(LocalMapAssetPolicy.sha256(manifest)==FIELD_MANIFEST_SHA256)
    val m=JSONObject(manifest.toString(Charsets.UTF_8));require(m.getString("region")=="itainopolis-picos-lab"&&!m.getBoolean("active"))
    val f=m.getJSONArray("files");require(f.length() in 8..36)
    val entries=(0 until f.length()).map{ val v=f.getJSONObject(it);MapAssetEntry(v.getString("path"),v.getLong("bytes"),v.getString("sha256")) }
    require(entries.map{it.path}.toSet().size==entries.size&&entries.sumOf{it.bytes}<=LocalMapAssetPolicy.MAX_BYTES)
    for(e in entries){
        require(e.path in setOf("pilot.pmtiles","style.json","OSM-NOTICE.txt","glyphs/LICENSE-Open-Sans.txt","itainopolis-route.json","picos-route.json","corridor-route.json")||Regex("glyphs/Open Sans Regular/[0-9]+-[0-9]+[.]pbf").matches(e.path))
        require(context.assets.open(root+e.path).use{LocalMapAssetPolicy.verify(it,e)})
    }
    val map=entries.single{it.path=="pilot.pmtiles"}
    val file=synchronized(FieldPilotActivity::class.java){
        val store=fieldStore?:PrivateMapStore(File(context.noBackupFilesDir,"apois-field-pilot")).also{fieldStore=it}
        store.open(map.copy(path="vale.pmtiles")){context.assets.open(root+map.path)}
    }
    val style=JSONObject(read("style.json",131072).toString(Charsets.UTF_8))
    val sources=style.getJSONObject("sources");require(style.getInt("version")==8&&sources.length()==1&&!style.has("imports")&&!style.has("sprite"))
    val regional=sources.getJSONObject("regional")
    require(regional.getString("type")=="vector"&&regional.getString("url")=="pmtiles://asset://apois-field-pilot/pilot.pmtiles"&&!regional.has("tiles"))
    require(style.getString("glyphs")=="asset://apois-field-pilot/glyphs/{fontstack}/{range}.pbf")
    regional.put("url","pmtiles://"+Uri.fromFile(file).toString())
    val adapter=RouteAdapter.fromWellKnownRouteProvider(WellKnownRouteProvider.Valhalla("https://navigation.invalid/route","auto"))
    val routes=listOf("itainopolis","picos","corridor").associateWith{id->
        require(entries.any{it.path==id+"-route.json"})
        adapter.parseResponse(read(id+"-route.json",1024*1024)).first().also{r->
            require(r.geometry.size in 2..100000&&r.geometry.all{it.lat in -7.75..-6.85&&it.lng in -41.85..-41.15})
        }
    }
    return FieldBundle(BaseStyle.Json(style.toString()),routes)
}
