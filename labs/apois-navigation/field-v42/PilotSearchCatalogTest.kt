package br.com.apois.navigation.lab
import org.junit.Assert.*
import org.junit.Test
class PilotSearchCatalogTest{
    private fun row(id:String,kind:String,label:String,n:String="")=PilotSearchCandidate(id,kind,label,-7.45,-41.48,n,"Centro")
    private val catalog=PilotSearchCatalog(listOf(row("a","address","Rua São José, 12","12"),row("b","address","Rua São José, 120","120"),row("c","street","Rua São José"),row("d","place","Itainópolis")))
    @Test fun exactNumberAndAccent(){
        assertEquals(listOf("a"),catalog.find("sao jose 12").map{it.id})
        assertEquals(listOf("b"),catalog.find("sao jose 120").map{it.id})
        assertTrue(catalog.find("sao jose 1").isEmpty())
        assertEquals("d",catalog.find("Itainopolis").first().id)
        assertEquals(3,catalog.find("sao jose centro").size)
    }
    @Test fun emptyAndBounds(){
        assertTrue(catalog.find("").isEmpty())
        assertTrue(catalog.find("a").isEmpty())
        assertTrue(catalog.find("x".repeat(121)).isEmpty())
        assertEquals(1,catalog.find("sao jose",1).size)
        assertTrue(catalog.find("sao jose",0).isEmpty())
    }
    @Test(expected=IllegalArgumentException::class) fun duplicateIdsRejected(){
        PilotSearchCatalog(listOf(row("a","street","A"),row("a","street","B")))
    }
}
