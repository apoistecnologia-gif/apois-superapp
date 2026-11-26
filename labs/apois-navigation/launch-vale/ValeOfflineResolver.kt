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
    evidence:suspend ()->VerifiedRouteEvidence?,now:()->Long,
    private val onDispose:()->Unit={}
):ManagedRouteResolver{
    private val app=context.applicationContext
    private val closed=AtomicBoolean(false)
    private var actor:Valhalla?=null
    override fun resourcesCurrent()=!closed.get()&&runCatching{packCurrent()}.getOrDefault(false)
    private fun active()=resourcesCurrent()&&hostCurrent()
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
        try{onDispose()}finally{ValeEngineLane.executor.execute{
            try{actor?.close()}catch(_:Exception){}catch(_:LinkageError){}finally{actor=null}
        }}
    }
}

/** Factory only for the pinned laboratory Vale data pack; map provenance
 * must match the graph before the native actor can be created. No registration.
 */
internal fun valeLocalFactory(context:Context,lease:VerifiedValeRuntimePack.Lease):NativeLocalRouteFactory =
    NativeLocalRouteFactory{target,map,current,verify->
        if(map.extractSha!="c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238"||
            map.mapSha!="18dc74cfea6ab6a8365b48df0731173b794825b108ed1f72db740ed16c3490fe"||
            !runCatching{current()&&target.usable()&&lease.claim()}.getOrDefault(false))null
        else try{
            ValeOfflineResolver(context,lease.graph,target,current,lease::current,verify,
                android.os.SystemClock::elapsedRealtime,lease::close)
        }catch(e:Exception){lease.close();throw e}
    }


/** Native-only binding to the existing driver-control target contract. The
 * caller supplies a trusted source; no permit or origin is sent for routing.
 * An exact evidence ID, version, ride, phase, point and identity must match
 * every subsequent read. This is not an offline ride authorization. */
internal suspend fun valeDriverGrant(
    context:Context,pack:VerifiedValeRuntimePack,request:ConfirmedHostRequest,
    live:()->Boolean,readTarget:suspend (ConfirmedHostRequest)->DriverControlTarget?,
    audioAuthorization:(()->Boolean)?=null
):NativeHostGrant?{
    fun available()=runCatching{live()}.getOrDefault(false)
    if(!request.valid()||!available())return null
    val firstRead=android.os.SystemClock.elapsedRealtime()
    val target=readTarget(request)?.takeIf{it.matches(request)}?:return null
    if(!available()||target.evidence(android.os.SystemClock.elapsedRealtime(),firstRead)==null)return null
    val lease=pack.acquireLease()
    var handedOff=false
    try{
        ensureActiveForValeGrant()
        fun current():Boolean{
            if(!available()||!lease.current()){lease.close();return false}
            return true
        }
        if(!current())return null
        val grant=NativeHostGrant(target.approved.identity,target.approved,::current,::current,null,
            audioAuthorization=audioAuthorization,
            verifyEvidence={
                if(!current())null else{
                    val began=android.os.SystemClock.elapsedRealtime()
                    val next=readTarget(request)
                    if(!current()||!target.currentProof(next)){lease.close();null}
                    else next?.evidence(android.os.SystemClock.elapsedRealtime(),began).also{if(it==null)lease.close()}
                }
            },
            localFactory=NativeLocalRouteFactory{approved,map,owner,verify->
                if(approved!=target.approved||!current())null
                else valeLocalFactory(context,lease).open(approved,map,{current()&&owner()},verify)
            },discard=lease::close)
        handedOff=true
        return grant
    }finally{if(!handedOff)lease.close()}
}
private suspend fun ensureActiveForValeGrant(){kotlinx.coroutines.currentCoroutineContext().ensureActive()}

/** Deliberately disabled unless a trusted native build explicitly enables it.
 * No registration in official apps, endpoint deployment or credentials.
 * Only the existing authenticated driver-control target endpoint is consulted;
 * calculation is local and never falls back to remote routing. */
internal suspend fun installValeLocalDriverControlCandidate(
    enabled:Boolean=false,context:Context,backendHost:String,
    online:()->Boolean,hostCurrent:()->Boolean,audioAuthorization:(()->Boolean)?=null
):Boolean{
    if(!enabled)return false
    check(android.os.Looper.myLooper()==android.os.Looper.getMainLooper())
    val client=runCatching{NativeDriverControlClient(backendHost)}.getOrNull()?:return false
    val pack=try{VerifiedValeRuntimePack.install(context.applicationContext)}
        catch(e:kotlinx.coroutines.CancellationException){throw e}
        catch(_:Exception){return false}
    ensureActiveForValeGrant()
    if(!runCatching{hostCurrent()}.getOrDefault(false))return false
    val app=context.applicationContext
    return NativeConfirmedHost.install(NativeHostConfiguration(
        backendHost,"","",online,grant={request->
            val stamp=NativeDriverReadSource.stamp()?:return@NativeHostConfiguration null
            fun live()=NativeDriverReadSource.current(stamp)&&
                runCatching{hostCurrent()&&online()}.getOrDefault(false)
            valeDriverGrant(app,pack,request,::live,client::target,audioAuthorization)
        },localRoutingOnly=true))
}


/** Entry point for a future trusted native application module. Not a
 * Capacitor plugin, preference, remote flag or credential receiver. A host
 * must explicitly opt in and keep its own lifecycle scope current. */
object ValeNativeHostBootstrap{
    suspend fun install(
        context:Context,backendHost:String,online:()->Boolean,
        hostCurrent:()->Boolean,enabled:Boolean=false,
        audioAuthorization:(()->Boolean)?=null
    ):Boolean=installValeLocalDriverControlCandidate(
        enabled,context,backendHost,online,hostCurrent,audioAuthorization)
}
