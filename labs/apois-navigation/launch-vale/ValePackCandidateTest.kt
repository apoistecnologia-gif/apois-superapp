package br.com.apois.navigation.lab

import java.io.File
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class ValePackCandidateTest{
    @get:Rule val tmp=TemporaryFolder()
    private val source=File(checkNotNull(System.getenv("APOIS_VALE_CANDIDATE")))
    private val spec=OfflinePackSpec("vale-pe-ba","c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238","3.6.3",listOf(
        OfflinePackFile("map.pmtiles",3422737,"18dc74cfea6ab6a8365b48df0731173b794825b108ed1f72db740ed16c3490fe"),
        OfflinePackFile("graph.tar",8263680,"38cf6df5fdd080ac4feb5c053a417fb4b814119765bc8214ad7593da985a1433"),
        OfflinePackFile("search.json",1433158,"9864919ce496184b917818f56d00406ef367c1987cdf37f24cc524c324bc08fa")
    ))
    @Test fun actualFilesInstallUnderCanonicalIdentity(){
        val store=OfflinePackStore(tmp.newFolder(),32*1024*1024L,0)
        val dir=store.install(spec){File(source,it).inputStream()}
        assertEquals("pack-"+spec.identity(),dir.name)
        assertTrue(File(source,"candidate.json").readText().contains(spec.identity()))
        assertEquals(dir,store.install(spec){error("already installed")})
        for(e in spec.files)assertEquals(e.bytes,File(dir,e.name).length())
        // A modified installed graph cannot be silently used/replaced.
        java.io.RandomAccessFile(File(dir,"graph.tar"),"rw").use{f->val b=f.read();f.seek(0);f.write(b xor 1)}
        assertTrue(runCatching{store.install(spec){error("must reject corrupt pack")}}.isFailure)
    }
}
