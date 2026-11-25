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
 @Test fun replacementDefersIdenticalPhraseButDoesNotConsumeId(){
    val p=VoicePolicy()
    assertNotNull(p.accept("1","In 300 metros, vire.",true,false,1000))
    p.routeReplaced(2000)
    assertNull(p.accept("1","Em 300 metros, vire.",true,false,3000))
    assertNotNull(p.accept("1","Em 300 metros, vire.",true,false,5000))
    assertNull(p.accept("1","Em 300 metros, vire.",true,false,6000))
 }
 @Test fun differentInstructionCanReuseIdImmediatelyAfterReplacement(){
    val p=VoicePolicy()
    assertNotNull(p.accept("1","Vire à esquerda.",true,false,1000))
    p.routeReplaced(2000)
    assertNotNull(p.accept("1","Vire à direita.",true,false,2100))
    assertNotNull(p.accept("2","Vire à esquerda.",true,false,2200))
 }
 @Test fun repeatedRecalculationsCannotExtendSpeechHold(){
    val p=VoicePolicy()
    p.accept("1","Siga.",true,false,1000)
    p.routeReplaced(2000)
    assertNull(p.accept("2","Siga.",true,false,2200))
    p.routeReplaced(4500)
    assertNotNull(p.accept("2","Siga.",true,false,5000))
 }
 @Test fun budgetDoesNotResetWithReplacement(){
    val p=VoicePolicy(1)
    assertNotNull(p.accept("1","Siga.",true,false,1000))
    p.routeReplaced(2000)
    assertNull(p.accept("1","Vire.",true,false,3000))
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
