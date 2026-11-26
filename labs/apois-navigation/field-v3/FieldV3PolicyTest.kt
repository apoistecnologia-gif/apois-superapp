package br.com.apois.navigation.lab
import org.junit.Test
import org.junit.Assert.*

class FieldV3PolicyTest {
 @Test fun onlyDedicatedApoisHost(){
    assertEquals("navigation-lab.apoisbrasil.com.br",fieldV3Host("NAVIGATION-LAB.apoisbrasil.com.br"))
    assertNotNull(fieldV3Host("navigation-lab-pi.apoisbrasil.com.br"))
    for(h in listOf("apoisbrasil.com.br","admin.apoisbrasil.com.br","navigation-lab.apoisbrasil.com.br.evil.org","https://navigation-lab.apoisbrasil.com.br","navigation-lab.apoisbrasil.com.br:443","valhalla.example.org","127.0.0.1"))assertNull(fieldV3Host(h))
 }
 @Test fun invalidTargetRejected(){
    assertNull(fieldV3Target("NaN","-41.5"))
    assertNull(fieldV3Target("-23","-46"))
    assertNull(fieldV3Target("","-41.5"))
 }
 @Test fun fixMustBeFreshAndPrecise(){
    val p=RegionalPoint(-7.45,-41.48)
    val f=InitialRouteFix(p,10.0,10000)
    assertTrue(fieldV3FixReady(f,11000))
    assertFalse(fieldV3FixReady(f,15001))
    assertFalse(fieldV3FixReady(f,9999))
    assertFalse(fieldV3FixReady(f.copy(accuracy=21.0),11000))
 }
}
