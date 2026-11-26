package br.com.apois.navigation.lab

import android.content.Context
import com.valhalla.config.ValhallaConfigBuilder
import com.valhalla.valhalla.Valhalla
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import uniffi.ferrostar.*

/** Candidate engine for the exact Vale laboratory graph.
 * No official registration, download, ride authority, or billing computation.
 * Only a trusted host may supply a private immutable graph lease and evidence.
 */
private object ValeEngineLane {
    val executor=Executors.newSingleThreadExecutor()
    val dispatcher=executor.asCoroutineDispatcher()
}
internal class ValeOfflineResolver(
    context:Context,private val graph:File,private val target:ApprovedIndependentTarget,
    private val hostCurrent:()->Boolean,private val packCurrent:()->Boolean,
    evidence:suspend ()->VerifiedRouteEvidence?,now:()->Long
):ManagedRouteResolver{
    private val app=context.applicationContext
    private val closed=AtomicBoolean(false)
    private var actor:Valhalla?=null
    private fun active()=!closed.get()&&hostCurrent()
    private val guard=ScopedOfflineCalculation(
        target,::active,packCurrent,evidence,now,::calculate,
        {route:Route->route.geometry.map{RegionalPoint(it.lat,it.lng)}}
    )
    init{require(target.usable())}
    override suspend fun resolve(origin:RegionalPoint,destination:RegionalPoint):Route =
        guard.resolve(origin,destination)

    // JNI and its cleanup are serialized process-wide. Never interrupt native
    // code or let a cancelled request publish a late response.
    private suspend fun calculate(origin:RegionalPoint,destination:RegionalPoint):Route =
        withContext(ValeEngineLane.dispatcher){
            ensureActive();check(!closed.get())
            val engine=actor?:Valhalla(app,ValhallaConfigBuilder()
                .withTileExtract(verifiedGraph().absolutePath).build()).also{actor=it}
            ensureActive();check(!closed.get())
            val body=JSONObject().put("locations",JSONArray().apply{
                for(p in listOf(origin,destination))put(JSONObject()
                    .put("lat",p.lat).put("lon",p.lng).put("type","break"))
            }).put("costing","auto").put("units","kilometers").put("language","pt-BR")
                .put("format","osrm").put("voice_instructions",true)
                .put("banner_instructions",true).put("shape_format","polyline6")
            val raw=engine.routeRaw(body.toString())
            ensureActive();check(!closed.get())
            require(raw.length in 1..2_000_000)
            val bytes=raw.toByteArray(Charsets.UTF_8);require(bytes.size<=2_000_000)
            val json=JSONObject(raw);require(json.getString("code")=="Ok")
            val route=json.getJSONArray("routes").getJSONObject(0)
            require(route.getDouble("distance").let{it.isFinite()&&it>0})
            require(route.getDouble("duration").let{it.isFinite()&&it>0})
            val adapter=RouteAdapter.fromWellKnownRouteProvider(
                WellKnownRouteProvider.Valhalla("https://navigation.invalid/route","auto"))
            adapter.parseResponse(bytes).first()
        }

    private fun verifiedGraph():File{
        val root=app.noBackupFilesDir.canonicalFile
        val file=graph.absoluteFile
        require(file==file.canonicalFile&&file.path.startsWith(root.path+File.separator))
        require(file.isFile&&file.length()==8_263_680L)
        val md=MessageDigest.getInstance("SHA-256")
        file.inputStream().use{input->
            val buf=ByteArray(65536)
            var total=0L
            while(true){val n=input.read(buf);if(n<0)break;total+=n;check(total<=8_263_680L);md.update(buf,0,n)}
            check(total==8_263_680L)
        }
        check(md.digest().joinToString(""){"%02x".format(it.toInt() and 255)}==
            "38cf6df5fdd080ac4feb5c053a417fb4b814119765bc8214ad7593da985a1433")
        return file
    }

    override fun dispose(){
        if(!closed.compareAndSet(false,true))return
        ValeEngineLane.executor.execute{
            try{actor?.close()}catch(_:Exception){}catch(_:LinkageError){}finally{actor=null}
        }
    }
}

/** Factory only for the pinned laboratory Vale data pack; map provenance
 * must match the graph before the native actor can be created. No registration.
 */
internal fun valeLocalFactory(context:Context,graph:File,packCurrent:()->Boolean):NativeLocalRouteFactory =
    NativeLocalRouteFactory{target,map,current,verify->
        if(map.extractSha!="c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238"||
            map.mapSha!="18dc74cfea6ab6a8365b48df0731173b794825b108ed1f72db740ed16c3490fe"||
            !runCatching{packCurrent()&&current()}.getOrDefault(false))null
        else ValeOfflineResolver(context,graph,target,current,packCurrent,verify,android.os.SystemClock::elapsedRealtime)
    }
