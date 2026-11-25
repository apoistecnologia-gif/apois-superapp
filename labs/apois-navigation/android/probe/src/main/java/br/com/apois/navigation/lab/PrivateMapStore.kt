package br.com.apois.navigation.lab

import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.RandomAccessFile
import java.nio.channels.FileLock

/**
 * Process-lifetime owner of app-private immutable regional map files.
 * Caller must use a singleton for the directory, never close while any renderer
 * may be alive. The OS releases the lock on process exit. No external downloads.
 */
internal class PrivateMapStore(private val dir: File) : AutoCloseable {
    private val archiveName=Regex("vale-[a-f0-9]{64}\\.pmtiles")
    private val stagingName=Regex("vale-[A-Za-z0-9_-]+\\.tmp")
    private val issued=mutableSetOf<String>()
    private var lockFile:RandomAccessFile?=null
    private var lock:FileLock?=null
    private var closed=false
    private var firstSuccess=true
    private fun acquireLock() {
        check(!closed)
        if (lock?.isValid==true) return
        check(dir.isDirectory || dir.mkdirs())
        val handle=RandomAccessFile(File(dir,".store.lock"),"rw")
        try {
            lock=handle.channel.tryLock() ?: error("Map store busy")
            lockFile=handle
        } catch (e:Exception) { handle.close();throw e }
    }
    private fun verify(file:File,entry:MapAssetEntry):Boolean =
        file.isFile && file.length()==entry.bytes &&
            runCatching { file.inputStream().use { LocalMapAssetPolicy.verify(it,entry) } }.getOrDefault(false)

    @Synchronized fun open(entry:MapAssetEntry, source:()->InputStream):File {
        require(entry.path=="vale.pmtiles" && entry.sha256.matches(Regex("[a-f0-9]{64}")) &&
            entry.bytes in 127..LocalMapAssetPolicy.MAX_BYTES)
        acquireLock()
        val name="vale-"+entry.sha256+".pmtiles"
        val file=File(dir,name)
        if (!verify(file,entry)) {
            // Never replace a path already handed to native code in this process.
            check(name !in issued) { "Map in use is corrupt; restart required" }
            // Bound multiple generations in a running process. A new process
            // cleans obsolete generations only after successful verification.
            check(issued.size<3) { "Restart required before next map version" }
            val staging=File.createTempFile("vale-",".tmp",dir)
            try {
                FileOutputStream(staging).use { out ->
                    require(source().use { LocalMapAssetPolicy.verify(it,entry,out) })
                    out.fd.sync()
                }
                check(staging.renameTo(file)) { "Map install failed" }
                require(verify(file,entry))
            } finally { staging.delete() }
        }
        if (firstSuccess) {
            // Exclusive process lock and no issued URLs yet: no renderer from a
            // participating process can be using obsolete paths. Only delete
            // files with our own exact managed names, never arbitrary files.
            dir.listFiles()?.forEach { old ->
                if (old.isFile && old.name!=name &&
                    (archiveName.matches(old.name)||stagingName.matches(old.name))) old.delete()
            }
            firstSuccess=false
        }
        check(name in issued || issued.size<3) { "Restart required before next map version" }
        issued.add(name)
        return file
    }

    // For tests or a host that can prove ALL native readers are destroyed.
    // Production singleton deliberately does not call close during app lifetime.
    @Synchronized override fun close() {
        if(closed)return
        closed=true
        try { lock?.release() } finally { lockFile?.close();lock=null;lockFile=null }
    }
}
