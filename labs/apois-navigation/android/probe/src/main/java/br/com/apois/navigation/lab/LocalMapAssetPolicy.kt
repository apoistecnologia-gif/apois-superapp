package br.com.apois.navigation.lab

import java.io.InputStream
import java.security.MessageDigest

internal data class MapAssetEntry(val path: String, val bytes: Long, val sha256: String)

internal object LocalMapAssetPolicy {
    const val ROOT = "apois-regional/"
    const val MAX_BYTES = 16L * 1024 * 1024
    const val MAX_FILES = 36
    const val STYLE_URI = "asset://apois-regional/style.json"
    const val MAP_URI = "pmtiles://asset://apois-regional/vale.pmtiles"
    const val GLYPH_URI = "asset://apois-regional/glyphs/{fontstack}/{range}.pbf"
    private val required = setOf("vale.pmtiles","style.json","LICENSE-Open-Sans.txt","OSM-NOTICE.txt",
        "glyphs/Open Sans Regular/0-255.pbf")
    private val hex = Regex("[a-f0-9]{64}")
    private val glyph = Regex("glyphs/Open Sans Regular/([0-9]{1,5})-([0-9]{1,5})\\.pbf")
    private fun pathAllowed(path: String): Boolean {
        if (path in required) return true
        val match = glyph.matchEntire(path) ?: return false
        val start = match.groupValues[1].toInt()
        val end = match.groupValues[2].toInt()
        return start in 0..65280 && start % 256 == 0 && end == start + 255 &&
            path == "glyphs/Open Sans Regular/$start-$end.pbf"
    }
    fun valid(entries: List<MapAssetEntry>): Boolean {
        if (entries.size !in required.size..MAX_FILES || entries.map { it.path }.toSet().size != entries.size) return false
        if (!entries.map { it.path }.containsAll(required)) return false
        return entries.all { pathAllowed(it.path) && it.bytes in 1..MAX_BYTES && hex.matches(it.sha256) } &&
            entries.sumOf { it.bytes } <= MAX_BYTES
    }
    fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).toHex()
    private fun ByteArray.toHex() = joinToString("") { "%02x".format(it.toInt() and 255) }
    fun verify(input: InputStream, entry: MapAssetEntry): Boolean {
        if (entry.bytes !in 1..MAX_BYTES || !hex.matches(entry.sha256)) return false
        val digest = MessageDigest.getInstance("SHA-256")
        val buf = ByteArray(8192)
        var read = 0L
        while (true) {
            val n = input.read(buf)
            if (n < 0) break
            if (n == 0) return false
            read += n
            if (read > entry.bytes) return false
            digest.update(buf,0,n)
        }
        return read == entry.bytes && digest.digest().toHex() == entry.sha256
    }
}
