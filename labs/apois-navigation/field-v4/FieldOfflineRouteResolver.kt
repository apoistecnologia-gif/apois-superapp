package br.com.apois.navigation.lab

import android.content.Context
import com.valhalla.config.ValhallaConfigBuilder
import com.valhalla.valhalla.Valhalla
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.withContext
import kotlinx.coroutines.ensureActive
import org.json.JSONArray
import org.json.JSONObject
import uniffi.ferrostar.*

// One process-wide serial lane for JNI, including actor disposal. No native
// thread interruption claim: cancellation revokes delivery, then close queues
// behind in-flight JNI. A new session cannot race a previous actor's shutdown.
private object FieldOfflineLane {
    val executor=Executors.newSingleThreadExecutor()
    val dispatcher=executor.asCoroutineDispatcher()
}

internal class FieldOfflineRouteResolver(context:Context,private val target:RegionalPoint):LiveRouteResolver {
    private val app=context.applicationContext
    private val closed=AtomicBoolean(false)
    val available:Boolean get()=!closed.get()
    private var actor:Valhalla?=null
    init{require(RouteRegion.FieldPilot.contains(target))}
    override suspend fun resolve(origin:RegionalPoint,destination:RegionalPoint):Route{
        require(available&&destination==target&&RouteRegion.FieldPilot.contains(origin))
        return withContext(FieldOfflineLane.dispatcher){
            ensureActive();check(available)
            val engine=actor?:Valhalla(app,ValhallaConfigBuilder().withTileExtract(verifiedGraph(app).absolutePath).build()).also{actor=it}
            ensureActive();check(available)
            val body=JSONObject().put("locations",JSONArray().apply{
                for(p in listOf(origin,destination))put(JSONObject().put("lat",p.lat).put("lon",p.lng).put("type","break"))
            }).put("costing","auto").put("units","kilometers").put("language","pt-BR")
                .put("format","osrm").put("voice_instructions",true).put("banner_instructions",true).put("shape_format","polyline6")
            val raw=engine.routeRaw(body.toString())
            ensureActive();check(available)
            // Native result must be bounded and meet the same route contract.
            require(raw.length in 1..2_000_000)
            val bytes=raw.toByteArray(Charsets.UTF_8);require(bytes.size<=2_000_000)
            val json=JSONObject(raw);require(json.getString("code")=="Ok")
            val first=json.getJSONArray("routes").getJSONObject(0)
            require(first.getDouble("distance").let{it.isFinite()&&it>0}&&first.getDouble("duration").let{it.isFinite()&&it>0})
            val adapter=RouteAdapter.fromWellKnownRouteProvider(WellKnownRouteProvider.Valhalla("https://navigation.invalid/route","auto"))
            val route=adapter.parseResponse(bytes).first()
            check(routeEndpointsMatch(route.geometry.map{RegionalPoint(it.lat,it.lng)},origin,destination,RouteRegion.FieldPilot))
            ensureActive();check(available);route
        }
    }
    fun dispose(){
        if(!closed.compareAndSet(false,true))return
        FieldOfflineLane.executor.execute{try{actor?.close()}catch(_:Exception){}catch(_:LinkageError){}finally{actor=null}}
    }
}

private fun hex(bytes:ByteArray)=bytes.joinToString(""){"%02x".format(it.toInt() and 255)}
private const val GRAPH_SHA="b0f3de3041ec8994c77eb678e416db86f93e9dc3d95a7416114b55059a393344"
private const val GRAPH_MANIFEST_SHA="3d8ddee2d42886b1846d86477b44ca7fabc050227e48c767836699050b23dd31"
private const val GRAPH_BYTES=3737600L

// Private, non-backed-up storage. No user-supplied file, path or graph.
// Check both the exact OSM source and the version-pinned graph before JNI.
// Never hand an unverified asset to the native parser.
private fun verifiedGraph(context:Context):File{
    val manifest=context.assets.open("apois-field-graph/graph-manifest.json").use{input->
        val out=java.io.ByteArrayOutputStream();val buffer=ByteArray(4096)
        while(true){val n=input.read(buffer);if(n<0)break;check(out.size()+n<=32768);out.write(buffer,0,n)}
        out.toByteArray()
    }
    check(hex(MessageDigest.getInstance("SHA-256").digest(manifest))==GRAPH_MANIFEST_SHA)
    val m=JSONObject(manifest.toString(Charsets.UTF_8));val g=m.getJSONObject("graph")
    check(m.getInt("schema")==1&&!m.getBoolean("active")&&m.getString("engine_version")=="3.6.3"&&m.getString("mobile_wrapper")=="0.6.3")
    check(m.getString("region")=="itainopolis-picos-lab"&&m.getString("extract_sha256")=="fd9182eb0bd8c7c10ee9e1ae493b9b4e7c1b69055e05b6ea5e6ca81a5718273d")
    check(g.getLong("bytes")==GRAPH_BYTES&&g.getString("sha256")==GRAPH_SHA)
    val target=File(context.noBackupFilesDir,"piaui-graph-"+GRAPH_SHA+".tar")
    fun valid(file:File):Boolean {
        if(!file.isFile||file.length()!=GRAPH_BYTES)return false
        val md=MessageDigest.getInstance("SHA-256")
        file.inputStream().use{input->val buf=ByteArray(65536);while(true){val n=input.read(buf);if(n<0)break;md.update(buf,0,n)}}
        return hex(md.digest())==GRAPH_SHA
    }
    if(valid(target))return target
    val temp=File.createTempFile("piaui-graph-",".part",context.noBackupFilesDir)
    try{
        context.assets.open("apois-field-graph/valhalla_tiles.tar").use{input->
            FileOutputStream(temp).use{out->
                val buf=ByteArray(65536);var bytes=0L
                while(true){val n=input.read(buf);if(n<0)break;bytes+=n;check(bytes<=GRAPH_BYTES);out.write(buf,0,n)}
                check(bytes==GRAPH_BYTES);out.fd.sync()
            }
        }
        check(valid(temp));check(temp.renameTo(target));check(valid(target));return target
    }finally{temp.delete()}
}
