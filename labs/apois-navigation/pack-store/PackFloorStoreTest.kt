package br.com.apois.navigation.lab

import java.io.File
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class PackFloorStoreTest{
    @get:Rule val tmp=TemporaryFolder()
    private val key="a".repeat(64)
    private val one=PackReleaseFloor(1,"b".repeat(64))
    private val two=PackReleaseFloor(2,"c".repeat(64))
    private fun store(root:File)=PackFloorStore(root,"vale-pe-ba",key)
    @Test fun explicitBootstrapAndReopen(){
        val root=tmp.newFolder()
        assertTrue(runCatching{store(root).read()}.isFailure)
        store(root).bootstrap(one)
        assertEquals(one,store(root).read())
        assertTrue(runCatching{store(root).bootstrap(PackReleaseFloor(0,null))}.isFailure)
        store(root).advance(two)
        assertEquals(two,store(root).read())
        store(root).advance(two)
        assertTrue(runCatching{store(root).advance(one)}.isFailure)
        assertTrue(runCatching{store(root).advance(two.copy(identity="d".repeat(64)))}.isFailure)
        assertEquals(two,store(root).read())
        assertTrue(root.list()!!.none{it.startsWith("floor-stage-")})
    }
    @Test fun corruptOrWrongScopeNeverDefaultsToZero(){
        val root=tmp.newFolder();store(root).bootstrap(one)
        assertTrue(runCatching{PackFloorStore(root,"other",key).read()}.isFailure)
        assertTrue(runCatching{PackFloorStore(root,"vale-pe-ba","e".repeat(64)).read()}.isFailure)
        File(root,"floor").writeText("truncated")
        assertTrue(runCatching{store(root).read()}.isFailure)
        assertTrue(runCatching{store(root).advance(two)}.isFailure)
        assertTrue(runCatching{store(root).bootstrap(one)}.isFailure)
    }
}
