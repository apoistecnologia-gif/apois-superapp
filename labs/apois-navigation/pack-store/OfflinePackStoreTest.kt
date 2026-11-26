package br.com.apois.navigation.lab
import java.io.ByteArrayInputStream
import java.io.File
import java.security.MessageDigest
import org.junit.Assert.*
import org.junit.Test
import org.junit.Rule
import org.junit.rules.TemporaryFolder

class OfflinePackStoreTest{
    @get:Rule val tmp=TemporaryFolder()
    private val names=listOf("map.pmtiles","graph.tar","search.json")
    private fun bytes(name:String,revision:String)=("$name-$revision").toByteArray()
    private fun spec(revision:String)=OfflinePackSpec("pi-lab","a".repeat(64),"3.6.3",names.map{
        val b=bytes(it,revision)
        OfflinePackFile(it,b.size.toLong(),MessageDigest.getInstance("SHA-256").digest(b).joinToString(""){v->"%02x".format(v.toInt() and 255)})
    })
    private fun store(root:File)=OfflinePackStore(root,1024,0)
    @Test fun installAndReuse(){
        val s=store(tmp.newFolder());val p=s.install(spec("1")){ByteArrayInputStream(bytes(it,"1"))}
        assertEquals(p,s.install(spec("1")){error("should not download again")})
        assertArrayEquals(bytes("map.pmtiles","1"),File(p,"map.pmtiles").readBytes())
    }
    @Test fun corruptUpdatePreservesOld(){
        val root=tmp.newFolder();val s=store(root);val old=s.install(spec("1")){ByteArrayInputStream(bytes(it,"1"))}
        assertTrue(runCatching{s.install(spec("2")){ByteArrayInputStream(bytes(it,"bad"))}}.isFailure)
        assertEquals(listOf(old.name),root.list()!!.filter{it.startsWith("pack-")})
        assertTrue(root.list()!!.none{it.startsWith("stage-")})
        assertEquals(old,s.install(spec("1")){error("not needed")})
    }
    @Test fun differentVersionsDoNotReplace(){
        val s=store(tmp.newFolder());val a=s.install(spec("1")){ByteArrayInputStream(bytes(it,"1"))}
        val b=s.install(spec("2")){ByteArrayInputStream(bytes(it,"2"))}
        assertNotEquals(a,b);assertTrue(a.isDirectory&&b.isDirectory)
    }
    @Test fun rejectWrongPathAndEngine(){
        val s=spec("1")
        assertTrue(runCatching{s.copy(engine="3.9.1").validated()}.isFailure)
        assertTrue(runCatching{s.copy(files=s.files.map{it.copy(name="../map.pmtiles")}).validated()}.isFailure)
        assertTrue(runCatching{s.copy(files=s.files.map{it.copy(bytes=Long.MAX_VALUE)}).validated()}.isFailure)
    }
    @Test fun corruptPublishedPackFailsClosed(){
        val s=store(tmp.newFolder());val p=s.install(spec("1")){ByteArrayInputStream(bytes(it,"1"))}
        File(p,"graph.tar").writeText("corrupt")
        assertTrue(runCatching{s.install(spec("1")){error("must not overwrite published path")}}.isFailure)
    }
    @Test fun reopenIsReadOnlyAndRejectsSameSizeCorruption(){
        val root=tmp.newFolder();val s=store(root)
        assertTrue(runCatching{s.openVerified(spec("1"))}.isFailure)
        assertEquals(emptyList<String>(),root.list()!!.toList())
        val p=s.install(spec("1")){ByteArrayInputStream(bytes(it,"1"))}
        assertEquals(p,s.openVerified(spec("1")))
        val map=File(p,"map.pmtiles");val original=map.readBytes()
        val corrupt=original.copyOf().also{it[0]=(it[0].toInt() xor 1).toByte()}
        map.writeBytes(corrupt)
        assertTrue(runCatching{s.openVerified(spec("1"))}.isFailure)
        assertArrayEquals(corrupt,map.readBytes())
        map.writeBytes(original)
        assertEquals(p,s.openVerified(spec("1")))
    }
    @Test fun rejectBudgetBeforeReading(){
        val s=OfflinePackStore(tmp.newFolder(),1,0)
        assertTrue(runCatching{s.install(spec("1")){error("not called")}}.isFailure)
    }
}
