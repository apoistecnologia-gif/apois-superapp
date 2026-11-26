package br.com.apois.navigation.lab

import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.RandomAccessFile
import java.security.MessageDigest

internal data class OfflinePackFile(val name:String,val bytes:Long,val sha256:String)
internal data class OfflinePackSpec(val region:String,val sourceSha:String,val engine:String,val files:List<OfflinePackFile>){
    fun validated():OfflinePackSpec{
        require(region.matches(Regex("[a-z0-9-]{1,48}"))&&sourceSha.matches(HEX)&&engine=="3.6.3")
        require(files.size==3&&files.map{it.name}.toSet()==LIMITS.keys)
        require(files.all{it.sha256.matches(HEX)&&it.bytes in 1..LIMITS.getValue(it.name)})
        return copy(files=files.sortedBy{it.name}.toList())
    }
    fun identity():String{
        val s=validated()
        val canonical=listOf(s.region,s.sourceSha,s.engine).plus(s.files.map{"${it.name}:${it.bytes}:${it.sha256}"}).joinToString("\n")
        return digest(canonical.toByteArray(Charsets.UTF_8))
    }
    companion object{
        private val HEX=Regex("[a-f0-9]{64}")
        private val LIMITS=mapOf("map.pmtiles" to 1024L*1024*1024,"graph.tar" to 2L*1024*1024*1024,"search.json" to 64L*1024*1024)
    }
}
private fun hex(b:ByteArray)=b.joinToString(""){"%02x".format(it.toInt() and 255)}
private fun digest(b:ByteArray)=hex(MessageDigest.getInstance("SHA-256").digest(b))

/** Only accepts a spec from the caller's trusted, pinned source. This is not
 * a remote manifest signature verifier, downloader, or active-pack selector.
 * Published paths are immutable; no automatic deletion or replacement.
 */
internal class OfflinePackStore(private val root:File,private val maxInstallBytes:Long=3L*1024*1024*1024,private val reserveBytes:Long=64L*1024*1024){
    init{require(maxInstallBytes>0&&reserveBytes>=0&&reserveBytes<=Long.MAX_VALUE-maxInstallBytes)}
    private fun child(parent:File,name:String):File{
        val f=File(parent,name)
        check(f.absoluteFile==f.canonicalFile){"unexpected alias"}
        return f
    }
    private fun copyChecked(input:InputStream,entry:OfflinePackFile,out:FileOutputStream?=null){
        val md=MessageDigest.getInstance("SHA-256");val buf=ByteArray(65536);var total=0L
        while(true){
            val n=input.read(buf);if(n<0)break
            check(n>0&&n.toLong()<=entry.bytes-total){"size mismatch"}
            total+=n;md.update(buf,0,n);out?.write(buf,0,n)
        }
        check(total==entry.bytes&&hex(md.digest())==entry.sha256){"integrity mismatch"}
    }
    private fun verify(dir:File,spec:OfflinePackSpec){
        check(dir.isDirectory&&dir.list()?.toSet()==spec.files.map{it.name}.toSet())
        for(e in spec.files){
            val f=child(dir,e.name);check(f.isFile&&f.length()==e.bytes)
            f.inputStream().use{copyChecked(it,e)}
        }
    }
    /** Read-only revalidation before granting a session. Missing or corrupt
     * data fails closed; never repairs, downloads or replaces an existing pack. */
    @Synchronized fun openVerified(trusted:OfflinePackSpec):File{
        val spec=trusted.validated()
        require(spec.files.sumOf{it.bytes}<=maxInstallBytes)
        check(root.absoluteFile==root.canonicalFile&&root.isDirectory)
        val dir=child(root,"pack-"+spec.identity())
        verify(dir,spec)
        return dir
    }
    @Synchronized fun install(trusted:OfflinePackSpec,source:(String)->InputStream):File{
        val spec=trusted.validated()
        val total=spec.files.sumOf{it.bytes}
        require(total<=maxInstallBytes)
        check(root.absoluteFile==root.canonicalFile)
        check(root.isDirectory||root.mkdirs()||root.isDirectory)
        check(root.absoluteFile==root.canonicalFile&&root.isDirectory)
        val lockFile=child(root,".install.lock")
        check(!lockFile.exists()||lockFile.isFile){"invalid lock file"}
        RandomAccessFile(lockFile,"rw").use{handle->
            val lock=handle.channel.tryLock()?:error("store busy")
            try{
                val final=child(root,"pack-"+spec.identity())
                if(final.exists()){verify(final,spec);return final}
                check(root.usableSpace>=total+reserveBytes){"insufficient storage"}
                val stage=child(root,"stage-"+java.util.UUID.randomUUID().toString())
                check(stage.mkdir())
                try{
                    for(e in spec.files){
                        val f=child(stage,e.name)
                        FileOutputStream(f).use{out->source(e.name).use{copyChecked(it,e,out)};out.fd.sync()}
                    }
                    verify(stage,spec)
                    check(!final.exists()&&stage.renameTo(final)){"publish failed"}
                    return final
                }finally{
                    // Stage contains only our fixed file names; no recursive deletion.
                    for(e in spec.files)File(stage,e.name).delete()
                    stage.delete()
                }
            }finally{lock.release()}
        }
    }
}
