package br.com.apois.navigation.lab

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.view.Gravity

// Isolated foreground diagnostic: no network, no persisted fixes, no ride data.
class PhysicalGpsActivity : Activity(), LocationListener {
    private lateinit var label: TextView
    private lateinit var manager: LocationManager
    private var source: Long? = null
    private var consumer: Long? = null
    private var foreground = false
    private var accepted = 0
    private var quality = GpsQuality.WAITING
    private var lastAccuracy: Double? = null
    private var inRegion: Boolean? = null
    private var message = "Toque em iniciar GPS."
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(32, 40, 32, 40)
        }
        val title = TextView(this).apply { text = "APOIS • GPS físico"; textSize = 24f }
        val info = TextView(this).apply {
            text = "Teste local, em primeiro plano. Não transmite nem guarda sua posição. Não use enquanto dirige."
            textSize = 16f
        }
        label = TextView(this).apply { textSize = 19f; setPadding(0, 24, 0, 24) }
        val start = Button(this).apply { text = "Iniciar GPS"; setOnClickListener { startGps() } }
        val stop = Button(this).apply { text = "Parar GPS"; setOnClickListener { stopGps(); message = "GPS encerrado."; render() } }
        val close = Button(this).apply { text = "Voltar"; setOnClickListener { finish() } }
        for(view in listOf(title,info,label,start,stop,close)) panel.addView(view)
        setContentView(panel)
        render()
    }
    private fun render() {
        val state = when(quality){
            GpsQuality.WAITING -> "Aguardando localização"
            GpsQuality.IMPRECISE -> "Impreciso"
            GpsQuality.LOST -> "Sem sinal válido"
            GpsQuality.AVAILABLE -> "GPS disponível"
        }
        label.text = "${message}\nEstado: ${state}\nFixações aceitas: ${accepted}\nPrecisão: ${lastAccuracy?.let { String.format(java.util.Locale("pt","BR"),"%.1f m",it) } ?: "—"}\nRegião Petrolina/Juazeiro: ${inRegion?.let { if(it) "dentro" else "fora" } ?: "—"}"
    }
    private fun startGps() {
        if (!foreground || source != null) return
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), 31)
            return
        }
        accepted=0; lastAccuracy=null; inRegion=null; quality=GpsQuality.WAITING
        if (!manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            message="Ative a localização do aparelho e tente novamente.";render();return
        }
        val id=DriverGpsFeed.beginSource();source=id
        consumer=DriverGpsFeed.subscribe(
            current={foreground&&source==id},
            onFix={fix,_->
                accepted++;lastAccuracy=fix.horizontalAccuracy
                inRegion=fix.coordinates.lat in -9.65..-9.10&&fix.coordinates.lng in -40.80..-40.20
                render()
            },
            onQuality={quality=it;render()},
            onRevoked={stopGps();message="Fonte revogada.";render()}
        )
        if(consumer==null){stopGps();message="GPS indisponível.";render();return}
        try{
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,1000L,0f,this,Looper.getMainLooper())
            message="Capturando GPS físico localmente.";render()
        }catch(_:Exception){stopGps();message="Falha ao iniciar o GPS.";render()}
    }
    private fun stopGps(){
        runCatching{manager.removeUpdates(this)}
        consumer?.let{DriverGpsFeed.unsubscribe(it)}
        consumer=null
        val old=source;source=null
        old?.let{DriverGpsFeed.endSource(it)}
        quality=GpsQuality.WAITING;lastAccuracy=null;inRegion=null
    }
    override fun onLocationChanged(location:Location){
        val id=source?:return
        if(!foreground)return
        DriverGpsFeed.publish(id,DriverGpsFeed.consumerTicket(id),location)
    }
    override fun onProviderDisabled(provider:String){quality=GpsQuality.LOST;message="Localização desativada.";render()}
    override fun onProviderEnabled(provider:String){message="Localização ativada.";render()}
    @Deprecated("Legacy callback") override fun onStatusChanged(provider:String?,status:Int,extras:Bundle?){}
    override fun onRequestPermissionsResult(requestCode:Int,permissions:Array<out String>,grantResults:IntArray){
        super.onRequestPermissionsResult(requestCode,permissions,grantResults)
        if(requestCode==31){
            if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED&&foreground)startGps()
            else {message="Permissão de localização precisa não concedida.";render()}
        }
    }
    override fun onResume(){super.onResume();foreground=true}
    override fun onPause(){foreground=false;stopGps();message="GPS pausado. Toque em iniciar para retomar.";render();super.onPause()}
    override fun onDestroy(){stopGps();super.onDestroy()}
}
