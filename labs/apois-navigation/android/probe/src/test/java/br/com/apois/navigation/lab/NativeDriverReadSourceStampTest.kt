package br.com.apois.navigation.lab
import org.junit.Assert.*
import org.junit.Test

class NativeDriverReadSourceStampTest{
    @Test fun unbindAndRebindNeverResurrectOldStamp(){
        val binding=Any()
        val digest=ByteArray(32){7}
        val original=NativeDriverReadSource.Stamp(1,digest,binding)
        assertTrue(original.matches(NativeDriverReadSource.Stamp(1,digest.copyOf(),binding)))
        assertFalse(original.matches(NativeDriverReadSource.Stamp(1,digest.copyOf(),Any())))
        assertFalse(original.matches(NativeDriverReadSource.Stamp(2,digest.copyOf(),binding)))
        assertFalse(original.matches(NativeDriverReadSource.Stamp(1,ByteArray(32){8},binding)))
        assertEquals("NativeDriverSessionStamp(redacted)",original.toString())
    }
}
