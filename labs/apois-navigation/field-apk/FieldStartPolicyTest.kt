package br.com.apois.navigation.lab
import org.junit.Assert.*
import org.junit.Test
class FieldStartPolicyTest{
 @Test fun requiresFreshPreciseFixAtStart(){
  assertTrue(fieldMayStart(35.0,20.0,6000,1000,true))
  assertFalse(fieldMayStart(8294.0,2.0,6000,1000,true))
  assertFalse(fieldMayStart(10.0,21.0,6000,1000,true))
  assertFalse(fieldMayStart(10.0,2.0,6001,1000,true))
  assertFalse(fieldMayStart(10.0,2.0,999,1000,true))
  assertFalse(fieldMayStart(Double.NaN,2.0,6000,1000,true))
  assertFalse(fieldMayStart(10.0,0.0,6000,1000,true))
  assertFalse(fieldMayStart(10.0,2.0,6000,1000,false))
 }
 @Test fun rejectsInvalidAndOutsidePack(){
  assertTrue(fieldPackContains(-7.447933,-41.478544))
  assertFalse(fieldPackContains(-9.4,-40.5))
  assertFalse(fieldPackContains(Double.NaN,-41.5))
 }
}
