package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

class LocalMapAssetPolicyTest {
    private val data="test".toByteArray()
    private val hash=LocalMapAssetPolicy.sha256(data)
    private fun entry(path:String)=MapAssetEntry(path,data.size.toLong(),hash)
    private fun entries()=listOf("vale.pmtiles","style.json","LICENSE-Open-Sans.txt","OSM-NOTICE.txt",
        "glyphs/Open Sans Regular/0-255.pbf").map(::entry)
    @Test fun requiredAssetsAndValidGlyphs() {
        assertTrue(LocalMapAssetPolicy.valid(entries()))
        assertTrue(LocalMapAssetPolicy.valid(entries()+entry("glyphs/Open Sans Regular/8192-8447.pbf")))
        assertFalse(LocalMapAssetPolicy.valid(entries().drop(1)))
    }
    @Test fun rejectsTraversalDuplicateAndMalformedRange() {
        for(p in listOf("../style.json","/style.json","glyphs/Open Sans Regular/1-256.pbf",
            "glyphs/Open Sans Regular/0000-255.pbf","glyphs/Other/0-255.pbf","https://example.invalid/map"))
            assertFalse(p,LocalMapAssetPolicy.valid(entries()+entry(p)))
        assertFalse(LocalMapAssetPolicy.valid(entries()+entries().first()))
    }
    @Test fun rejectsOversizedAndInvalidHashes() {
        val e=entries()
        assertFalse(LocalMapAssetPolicy.valid(e.drop(1)+e.first().copy(bytes=LocalMapAssetPolicy.MAX_BYTES)))
        assertFalse(LocalMapAssetPolicy.valid(e.drop(1)+e.first().copy(sha256="bad")))
    }
    @Test fun verifiedCopyDoesNotAcceptCorruptOrOversizedSource() {
        val e=entry("vale.pmtiles")
        val out=ByteArrayOutputStream()
        assertTrue(LocalMapAssetPolicy.verify(ByteArrayInputStream(data),e,out))
        assertArrayEquals(data,out.toByteArray())
        val oversized=ByteArrayOutputStream()
        assertFalse(LocalMapAssetPolicy.verify(ByteArrayInputStream("tests".toByteArray()),e,oversized))
        assertEquals(0,oversized.size())
        assertFalse(LocalMapAssetPolicy.verify(ByteArrayInputStream("xxxx".toByteArray()),e,ByteArrayOutputStream()))
    }
    @Test fun verifiesExactBytesAndHash() {
        val e=entry("style.json")
        assertTrue(LocalMapAssetPolicy.verify(ByteArrayInputStream(data),e))
        assertFalse(LocalMapAssetPolicy.verify(ByteArrayInputStream("xxxx".toByteArray()),e))
        assertFalse(LocalMapAssetPolicy.verify(ByteArrayInputStream("tes".toByteArray()),e))
        assertFalse(LocalMapAssetPolicy.verify(ByteArrayInputStream("tests".toByteArray()),e))
    }
}
