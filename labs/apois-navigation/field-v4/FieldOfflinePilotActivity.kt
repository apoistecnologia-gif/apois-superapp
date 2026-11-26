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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.stadiamaps.ferrostar.maplibreui.views.PortraitNavigationView
import com.stadiamaps.ferrostar.maplibreui.NavigationMapView
import org.maplibre.compose.map.MapOptions
import com.stadiamaps.ferrostar.maplibreui.runtime.rememberNavigationMapState
import com.stadiamaps.ferrostar.core.NavigationUiState
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.maplibre.compose.style.BaseStyle
import uniffi.ferrostar.*
import java.io.File
import java.util.Locale

// Standalone V4 only: no network permission, accounts, ride commands, background location or production authority.
class FieldOfflinePilotActivity:ComponentActivity(),LocationListener {
    private lateinit var manager:LocationManager
    private val model=LiveGpsNavigationModel()
    private var bundle by mutableStateOf<FieldBundle?>(null)
    private var selected by mutableStateOf<String?>(null)
    private var state by mutableStateOf("Escolha um destino dentro do mapa piloto.")
    private var lat by mutableStateOf("")
    private var lon by mutableStateOf("")
    private var latest:InitialRouteFix?=null
    private var qualityNow=GpsQuality.WAITING
    private var initialJob:Job?=null
    private var owner:LegRouteResources<Route>?=null
    private var resolver:FieldOfflineRouteResolver?=null
    private var requestInFlight by mutableStateOf(false)
    private val requestGate=FieldInitialRequestGate()
    private var accuracy by mutableStateOf<Double?>(null)
    private var mapStatus by mutableStateOf("Carregando mapa local…")
    private var outsidePack by mutableStateOf(false)
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
                    voiceReady=voice!=null&&engine?.setVoice(voice)==TextToSpeech.SUCCESS
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
                Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(12.dp).then(if(selected==null)Modifier.verticalScroll(rememberScrollState()) else Modifier),verticalArrangement=Arrangement.spacedBy(8.dp)){
                    Text("APOIS GPS • Piloto PI V4",style=MaterialTheme.typography.headlineSmall)
                    Text("Rota dinâmica offline · GPS físico · sem servidor",style=MaterialTheme.typography.bodySmall)
                    if(selected==null){
                        Text("Teste como passageiro ou com o veículo parado. Não opere o celular dirigindo.")
                        Text(if(bundle==null)"Verificando mapas..." else "Mapa local verificado.")
                        Text(state)
                        Text("Mapa e cálculo de rotas no aparelho. Não requer internet, conta ou servidor.")
                        Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
                            OutlinedTextField(value=lat,onValueChange={lat=it.take(24)},label={Text("Latitude")},singleLine=true,modifier=Modifier.weight(1f))
                            OutlinedTextField(value=lon,onValueChange={lon=it.take(24)},label={Text("Longitude")},singleLine=true,modifier=Modifier.weight(1f))
                        }
                        Row{
                            TextButton(onClick={choose("itainopolis")}){Text("Itainópolis")}
                            TextButton(onClick={choose("picos")}){Text("Picos")}
                        }
                        Button(onClick={startOffline()},enabled=bundle!=null,modifier=Modifier.fillMaxWidth()){Text("Calcular rota offline pelo GPS")}
                    }else{
                        Text(state)
                        if(!active&&!requestInFlight&&requestGate.attempted)TextButton(onClick={if(requestGate.allowRetry())state="Aguardando posição GPS para nova tentativa."}){Text("Tentar novamente")}
                        accuracy?.let{Text("Precisão do GPS: "+String.format(Locale("pt","BR"),"%.1f m",it))}
                        if(outsidePack)Text("Posição fora da área do mapa piloto. Não há orientação.")
                        val style=bundle?.style
                        if(style!=null){
                            if(active){
                                PortraitNavigationView(modifier=Modifier.weight(1f).fillMaxWidth(),baseStyle=style,viewModel=model,views=com.stadiamaps.ferrostar.composeui.config.NavigationViewComponentBuilder.Default(),onTapExit={stopPilot()})
                            }else{
                                val camera=rememberNavigationMapState()
                                Box(Modifier.weight(1f).fillMaxWidth()){
                                    NavigationMapView(baseStyle=style,navigationMapState=camera,uiState=ui,mapOptions=MapOptions(),routeOverlayBuilder=null,onMapLoadFinished={mapStatus="Mapa local carregado."},onMapLoadFailed={mapStatus="Falha ao renderizar mapa local."})
                                }
                                Text(mapStatus,style=MaterialTheme.typography.bodySmall)
                                TextButton(onClick={camera.recenter(false)},modifier=Modifier.fillMaxWidth()){Text("Centralizar minha posição")}
                            }
                        }
                        if(active){
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
    private fun choose(id:String){
        bundle?.routes?.get(id)?.geometry?.lastOrNull()?.let{lat=it.lat.toString();lon=it.lng.toString()}
    }
    private fun startOffline(){
        if(!foreground||selected!=null||bundle==null)return
        val destination=fieldV3Target(lat,lon)
        if(destination==null){state="Destino inválido ou fora do mapa piloto.";return}
        if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION),71)
            state="Conceda localização precisa e selecione novamente.";return
        }
        if(!manager.isProviderEnabled(LocationManager.GPS_PROVIDER)){state="Ative o GPS do aparelho.";return}
        selected="offline";state="Aguardando GPS preciso.";accuracy=null;outsidePack=false
        model.navigationUiState.value=NavigationUiState.empty()
        val ticket=++generation
        val sid=DriverGpsFeed.beginSource();source=sid
        fun current()=foreground&&generation==ticket&&source==sid
        val client=FieldOfflineRouteResolver(applicationContext,destination)
        resolver=client
        preflight=DriverGpsFeed.subscribe(current=::current,
            onFix={fix,captured->
                val point=RegionalPoint(fix.coordinates.lat,fix.coordinates.lng)
                accuracy=fix.horizontalAccuracy;outsidePack=!fieldPackContains(point.lat,point.lng)
                latest=InitialRouteFix(point,fix.horizontalAccuracy,captured)
                model.navigationUiState.value=NavigationUiState.empty().copy(location=fix,isMuted=true)
                if(!requestGate.attempted&&!requestInFlight){
                    val f=latest!!
                    when{
                        outsidePack -> state="GPS fora do mapa piloto."
                        !fieldV3FixReady(f,SystemClock.elapsedRealtime()) -> state="Aguardando GPS preciso e atual."
                        else -> {
                            val request=checkNotNull(requestGate.begin());requestInFlight=true;state="Calculando rota no próprio celular…"
                            initialJob=lifecycleScope.launch(start=CoroutineStart.UNDISPATCHED){
                                try {
                                    yield()
                                    ensureActive()
                                    if(!requestGate.accepts(request)||!current()||!client.available){
                                        if(current())state="Motor ou posição indisponível. Tente novamente."
                                        return@launch
                                    }
                                    val route=withTimeout(15_000){client.resolve(f.point,destination)}
                                    ensureActive()
                                    if(!current()||!requestGate.accepts(request))return@launch
                                    val fresh=latest
                                    if(fresh==null||!fieldDynamicCanStart(current(),foreground,qualityNow,SystemClock.elapsedRealtime(),fresh,destination,route.geometry.map{RegionalPoint(it.lat,it.lng)})){
                                        state="Posição mudou ou perdeu precisão. Solicite nova rota.";return@launch
                                    }
                                    val leg=LegToken("field-pilot-"+ticket,Leg.TRIP,ticket)
                                    val resources=LegRouteResources(leg.rideId,leg.leg,destination,RouteRegion.FieldPilot,client::resolve)
                                    owner=resources
                                    preflight?.let(DriverGpsFeed::unsubscribe);preflight=null
                                    active=true;state="Rota offline. Orientação por GPS real."
                                    model.setDestination("Destino de teste")
                                    model.start(route,::current,applicationContext,voicePermit(ticket),resources,leg,
                                        online={client.available})
                                    model.setForeground(true)
                                }catch(_:TimeoutCancellationException){if(current())state="Cálculo demorou demais. Tente novamente."}
                                catch(e:CancellationException){throw e}
                                catch(_:LinkageError){if(current())state="Motor offline incompatível com este aparelho."}
                                catch(_:Exception){if(current())state="Rota offline indisponível. Confira posição e destino."}
                                finally{if(requestGate.finish(request)&&current())requestInFlight=false}
                            }
                        }
                    }
                }
            },onQuality={q->
                qualityNow=q
                if(q!=GpsQuality.AVAILABLE){
                    latest=null;requestGate.invalidate();initialJob?.cancel()
                    state=gpsStatusLabel(q)?:"Aguardando GPS.";accuracy=null;outsidePack=false
                    model.navigationUiState.value=NavigationUiState.empty()
                }
            },onRevoked={stopPilot()})
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
        requestGate.reset();initialJob?.cancel();initialJob=null;requestInFlight=false;latest=null
        qualityNow=GpsQuality.WAITING
        model.setForeground(false);model.stopNavigation()
        owner?.close();owner=null
        resolver?.dispose();resolver=null
        runCatching{manager.removeUpdates(this)}
        preflight?.let(DriverGpsFeed::unsubscribe);preflight=null
        val old=source;source=null;old?.let(DriverGpsFeed::endSource)
        tts?.stop();active=false;selected=null;accuracy=null;outsidePack=false;state="Teste encerrado. Escolha um destino."
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
    val file=synchronized(FieldOfflinePilotActivity::class.java){
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
