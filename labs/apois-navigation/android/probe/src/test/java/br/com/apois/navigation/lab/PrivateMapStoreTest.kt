package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.File

class PrivateMapStoreTest {
    @get:Rule val temp=TemporaryFolder()
    private fun bytes(v:Int)=ByteArray(256){v.toByte()}
    private fun entry(data:ByteArray)=MapAssetEntry("vale.pmtiles",data.size.toLong(),LocalMapAssetPolicy.sha256(data))
    @Test fun installAndReuseVerifiedFileWithoutSource() {
        val dir=temp.newFolder()
        PrivateMapStore(dir).use { store ->
            val data=bytes(1);val e=entry(data)
            val first=store.open(e){ByteArrayInputStream(data)}
            assertArrayEquals(data,first.readBytes())
            assertEquals(first,store.open(e){error("already installed")})
        }
    }
    @Test fun badUpgradePreservesPreviousFileAndCleansStaging() {
        val dir=temp.newFolder()
        PrivateMapStore(dir).use { store ->
            val a=bytes(1);val b=bytes(2)
            val old=store.open(entry(a)){ByteArrayInputStream(a)}
            assertTrue(runCatching { store.open(entry(b)){ByteArrayInputStream(bytes(3))} }.isFailure)
            assertArrayEquals(a,old.readBytes())
            assertFalse(dir.listFiles()!!.any{it.name.endsWith(".tmp")})
        }
    }
    @Test fun activeVersionsNeverDeletedUntilNextProcessOwner() {
        val dir=temp.newFolder()
        val a=bytes(1);val b=bytes(2)
        lateinit var old:File;lateinit var current:File
        PrivateMapStore(dir).use { store ->
            old=store.open(entry(a)){ByteArrayInputStream(a)}
            current=store.open(entry(b)){ByteArrayInputStream(b)}
            assertTrue(old.exists());assertTrue(current.exists())
        }
        val unrelated=File(dir,"other.txt").apply{writeText("keep")}
        PrivateMapStore(dir).use { store ->
            assertEquals(current,store.open(entry(b)){error("reuse")})
            assertFalse(old.exists());assertTrue(unrelated.exists())
        }
    }
    @Test fun corruptedIssuedFileFailsClosedAndColdStartRepairs() {
        val dir=temp.newFolder();val data=bytes(1);val e=entry(data)
        PrivateMapStore(dir).use { store ->
            val f=store.open(e){ByteArrayInputStream(data)}
            f.writeBytes(bytes(2))
            assertTrue(runCatching{store.open(e){ByteArrayInputStream(data)}}.isFailure)
            assertArrayEquals(bytes(2),f.readBytes())
        }
        PrivateMapStore(dir).use { store ->
            assertArrayEquals(data,store.open(e){ByteArrayInputStream(data)}.readBytes())
        }
    }
    @Test fun competingOwnerCannotCleanupOrInstall() {
        val dir=temp.newFolder();val data=bytes(1);val e=entry(data)
        PrivateMapStore(dir).use { first ->
            val f=first.open(e){ByteArrayInputStream(data)}
            PrivateMapStore(dir).use { second ->
                assertTrue(runCatching{second.open(e){ByteArrayInputStream(data)}}.isFailure)
                assertTrue(f.exists())
            }
        }
    }
    @Test fun capsVersionsDuringProcessLifetime() {
        val dir=temp.newFolder()
        PrivateMapStore(dir).use { store ->
            for(i in 1..3)store.open(entry(bytes(i))){ByteArrayInputStream(bytes(i))}
            assertTrue(runCatching{store.open(entry(bytes(4))){ByteArrayInputStream(bytes(4))}}.isFailure)
            assertEquals(3,dir.listFiles()!!.count{it.name.endsWith(".pmtiles")})
        }
    }
}
