package br.com.apois.navigation.lab

import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.file.Files
import java.nio.file.StandardCopyOption

/** Private candidate rollback floor, not an active-pack selector. Explicit
 * bootstrap required; a missing/corrupt floor never implies sequence zero.
 * JVM proof only; Android API/provider durability still needs validation. */
internal class PackFloorStore(private val root:File,private val region:String,private val keyId:String){
    init{require(region.matches(Regex("[a-z0-9-]{1,48}"))&&keyId.matches(Regex("[a-f0-9]{64}")))}
    private fun child(name:String):File=File(root,name).also{check(it.absoluteFile==it.canonicalFile)}
    private fun <T> locked(block:()->T):T{
        check(root.absoluteFile==root.canonicalFile&&root.isDirectory)
        val file=child(".floor.lock")
        check(!file.exists()||file.isFile)
        RandomAccessFile(file,"rw").use{h->
            val lock=h.channel.tryLock()?:error("floor busy")
            try{return block()}finally{lock.release()}
        }
    }
    private fun decode(file:File):PackReleaseFloor{
        check(file.isFile&&file.length() in 1..512)
        val text=file.readText(Charsets.UTF_8)
        val lines=text.split('\n')
        check(lines.size==6&&lines[0]=="APOIS-PACK-FLOOR-v1"&&lines[1]==region&&lines[2]==keyId&&lines[5].isEmpty())
        val seq=lines[3].toLong()
        check(seq.toString()==lines[3])
        val identity=lines[4].takeUnless{it=="-"}
        return PackReleaseFloor(seq,identity)
    }
    private fun write(floor:PackReleaseFloor){
        val target=child("floor")
        val stage=child("floor-stage-"+java.util.UUID.randomUUID())
        check(stage.createNewFile())
        try{
            val data="APOIS-PACK-FLOOR-v1\n$region\n$keyId\n${floor.sequence}\n${floor.identity?:"-"}\n".toByteArray(Charsets.UTF_8)
            FileOutputStream(stage).use{it.write(data);it.fd.sync()}
            check(decode(stage)==floor)
            // No non-atomic fallback. Old floor remains on move failure.
            Files.move(stage.toPath(),target.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING)
            check(decode(target)==floor)
        }finally{stage.delete()}
    }
    fun matchesScope(region:String,keyId:String)=this.region==region&&this.keyId==keyId
    fun bootstrap(initial:PackReleaseFloor)=locked{
        check(!child("floor").exists()){"floor already exists"}
        write(initial)
    }
    fun read():PackReleaseFloor=locked{decode(child("floor"))}
    // Serialize verification, immutable installation and floor advancement
    // against competing cooperative installers. A failed callback cannot
    // advance the floor. A crash after install leaves an inactive candidate.
    fun <T> accept(next:PackReleaseFloor,install:(PackReleaseFloor)->T):T=locked{
        val current=decode(child("floor"))
        require(next.sequence>current.sequence||next==current){"rollback or conflict"}
        val result=install(current)
        if(next!=current)write(next)
        result
    }
    fun advance(next:PackReleaseFloor)=locked{
        val current=decode(child("floor"))
        require(next.sequence>current.sequence||next==current){"rollback or conflict"}
        if(next!=current)write(next)
    }
}
