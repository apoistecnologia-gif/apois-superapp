package br.com.apois.navigation.lab

import android.content.Context
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext

/** Install the exact APK-bundled Vale candidate. No remote manifests, paths
 * from WebView, activation, network permission, or production registration.
 * The caller must still establish ride authority and a session lease.
 */
internal class VerifiedValeRuntimePack private constructor(
    val directory:File,val identity:String
){
    val graph:File get()=File(directory,"graph.tar")
    val search:File get()=File(directory,"search.json")
    val map:File get()=File(directory,"map.pmtiles")
    companion object{
        private val spec=OfflinePackSpec("vale-pe-ba",
            "c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238","3.6.3",listOf(
                OfflinePackFile("map.pmtiles",3422737,"18dc74cfea6ab6a8365b48df0731173b794825b108ed1f72db740ed16c3490fe"),
                OfflinePackFile("graph.tar",8263680,"38cf6df5fdd080ac4feb5c053a417fb4b814119765bc8214ad7593da985a1433"),
                OfflinePackFile("search.json",1433158,"9864919ce496184b917818f56d00406ef367c1987cdf37f24cc524c324bc08fa")))
        suspend fun install(context:Context):VerifiedValeRuntimePack=withContext(Dispatchers.IO){
            val app=context.applicationContext
            ensureActive()
            val root=File(app.noBackupFilesDir.canonicalFile,"vale-runtime-packs")
            val store=OfflinePackStore(root,32L*1024*1024)
            val id=spec.identity()
            check(id=="89e4ed84a975713e74e67bcdba4b883caf1b85e1348c2496189c153a2629cfad")
            val dir=store.install(spec){name->
                ensureActive()
                app.assets.open(when(name){
                    "map.pmtiles"->"apois-regional/vale.pmtiles"
                    "graph.tar"->"apois-vale-data/graph.tar"
                    "search.json"->"apois-vale-data/search.json"
                    else->error("unknown asset")
                })
            }
            ensureActive()
            check(dir.name=="pack-"+id)
            VerifiedValeRuntimePack(dir,id)
        }
    }
}
