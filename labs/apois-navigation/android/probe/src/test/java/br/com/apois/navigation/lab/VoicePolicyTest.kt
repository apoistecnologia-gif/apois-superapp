package br.com.apois.navigation.lab
import org.junit.Assert.*
import org.junit.Test
class VoicePolicyTest {
 @Test fun correctsOnlyKnownDistancePrefix(){
    assertEquals("Em 300 metros, Vire à esquerda para Rua de Teste 105.",normalizeNavigationSpeech("In 300 metros, Vire à esquerda para Rua de Teste 105."))
    assertEquals("Em 1,2 km, vire à direita.",normalizeNavigationSpeech("In 1,2 km, vire à direita."))
    assertEquals("Continue em Rua In 300 metros.",normalizeNavigationSpeech("Continue em Rua In 300 metros."))
    assertEquals("Vire à direita.",normalizeNavigationSpeech("Vire à direita."))
 }
 @Test fun oneUtteranceOnly(){
    val p=VoicePolicy()
    assertEquals("Em 300 metros, vire.",p.accept("1","In 300 metros, vire.",true,false))
    assertNull(p.accept("1","In 300 metros, vire.",true,false))
    assertNotNull(p.accept("2","In 300 metros, vire.",true,false))
 }
 @Test fun unavailableOrMutedDoesNotSpeak(){
    val p=VoicePolicy()
    assertNull(p.accept("1","Vire.",false,false))
    assertNull(p.accept("1","Vire.",true,true))
    assertNotNull(p.accept("1","Vire.",true,false))
 }
 @Test fun terminalSessionRejectsLateInstructions(){val p=VoicePolicy();p.close();assertNull(p.accept("1","Vire.",true,false))}
 @Test fun boundedStorageFailsSilent(){val p=VoicePolicy(1);assertNotNull(p.accept("1","Vire.",true,false));assertNull(p.accept("2","Siga.",true,false));assertNull(p.accept("1","Vire.",true,false))}
 @Test fun blankIdOrTextRejected(){val p=VoicePolicy();assertNull(p.accept("","Vire.",true,false));assertNull(p.accept("1"," ",true,false))}
}
