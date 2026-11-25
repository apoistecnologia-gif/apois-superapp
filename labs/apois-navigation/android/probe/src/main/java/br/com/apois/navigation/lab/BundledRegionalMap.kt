package br.com.apois.navigation.lab

import android.content.Context
import android.net.Uri
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.maplibre.compose.style.BaseStyle

/** Opt-in verified bundled basemap. No downloader, permission, Activity or
 * production registration. Call from a trusted host before opening navigation.
 * A failure returns null, not a network style or silent demo fallback.
 */
internal object BundledRegionalMap {
    private fun boundedRead(context: Context, path: String, max: Int): ByteArray =
        context.assets.open(LocalMapAssetPolicy.ROOT+path).use { input ->
            val out = java.io.ByteArrayOutputStream()
            val buf = ByteArray(8192)
            while (true) {
                val n=input.read(buf)
                if (n<0) break
                check(n>0 && out.size()+n<=max)
                out.write(buf,0,n)
            }
            out.toByteArray()
        }

    private val installLock = Any()
    private var store: PrivateMapStore? = null

    suspend fun verifiedStyle(context: Context): BaseStyle.Json? = withContext(Dispatchers.IO) {
        try {
            val manifest=JSONObject(boundedRead(context,"manifest.json",32_768).toString(Charsets.UTF_8))
            require(manifest.getInt("schema")==1 && manifest.getString("region")=="vale-pe-ba")
            val files=manifest.getJSONArray("files")
            require(files.length()<=LocalMapAssetPolicy.MAX_FILES)
            val entries=(0 until files.length()).map {
                val item=files.getJSONObject(it)
                MapAssetEntry(item.getString("path"),item.getLong("bytes"),item.getString("sha256"))
            }
            require(LocalMapAssetPolicy.valid(entries))
            require(manifest.getString("pack_id")==LocalMapAssetPolicy.sha256(
                entries.sortedBy { it.path }.joinToString("") { it.sha256 }.toByteArray(Charsets.UTF_8)))
            for (entry in entries) require(context.assets.open(LocalMapAssetPolicy.ROOT+entry.path).use {
                LocalMapAssetPolicy.verify(it,entry)
            })
            val style=JSONObject(boundedRead(context,"style.json",131_072).toString(Charsets.UTF_8))
            val sources=style.getJSONObject("sources")
            require(style.getInt("version")==8 && sources.length()==1 && sources.has("regional"))
            val regional=sources.getJSONObject("regional")
            require(regional.getString("type")=="vector" && regional.getString("url")==LocalMapAssetPolicy.MAP_URI)
            require(!regional.has("tiles") && !style.has("sprite") && !style.has("imports"))
            require(style.getString("glyphs")==LocalMapAssetPolicy.GLYPH_URI)
            // Android 13.0.2's AAssetManager source ignores Resource.dataRange.
            // A PMTiles reader needs ranged file access. Keep map in app-private,
            // no-backup storage and use file://, not the asset URL in the template.
            val mapEntry=entries.single { it.path=="vale.pmtiles" }
            val file=synchronized(installLock) {
                val owner=store ?: PrivateMapStore(File(context.noBackupFilesDir,"apois-regional"))
                    .also { store=it }
                owner.open(mapEntry) { context.assets.open(LocalMapAssetPolicy.ROOT+mapEntry.path) }
            }
            regional.put("url","pmtiles://"+Uri.fromFile(file).toString())
            BaseStyle.Json(style.toString())
        } catch (e:kotlinx.coroutines.CancellationException) { throw e }
        catch (_:Exception) { null }
    }

}
