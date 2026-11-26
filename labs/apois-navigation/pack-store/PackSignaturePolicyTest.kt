package br.com.apois.navigation.lab
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import org.junit.Assert.*
import org.junit.Test

class PackSignaturePolicyTest{
    private fun key()=KeyPairGenerator.getInstance("EC").apply{initialize(ECGenParameterSpec("secp256r1"))}.generateKeyPair()
    private val keys=key()
    private val spec=OfflinePackSpec("pi-lab","a".repeat(64),"3.6.3",listOf("map.pmtiles","graph.tar","search.json").map{OfflinePackFile(it,10,"b".repeat(64))})
    private fun release(sequence:Long):SignedPackRelease{
        val draft=SignedPackRelease(spec,sequence,byteArrayOf())
        val signer=Signature.getInstance("SHA256withECDSA")
        signer.initSign(keys.private);signer.update(draft.payload())
        return draft.copy(signature=signer.sign())
    }
    private fun verify(r:SignedPackRelease,floor:PackReleaseFloor=PackReleaseFloor(0,null))=PackSignaturePolicy.verify(r,keys.public,PackSignaturePolicy.keyId(keys.public),floor)
    @Test fun validSignatureAndRetry(){
        val r=release(2)
        assertTrue(verify(r))
        assertTrue(verify(r,PackReleaseFloor(2,spec.identity())))
        assertTrue(verify(r,PackReleaseFloor(1,"c".repeat(64))))
    }
    @Test fun rejectChangedSourceFileAndSequence(){
        val r=release(2)
        assertFalse(verify(r.copy(spec=spec.copy(sourceSha="c".repeat(64)))))
        assertFalse(verify(r.copy(spec=spec.copy(files=spec.files.map{it.copy(bytes=11)}))))
        assertFalse(verify(r.copy(sequence=3)))
    }
    @Test fun rejectRollbackAndSameSequenceDifferentIdentity(){
        val r=release(2)
        assertFalse(verify(r,PackReleaseFloor(3,spec.identity())))
        assertFalse(verify(r,PackReleaseFloor(2,"c".repeat(64))))
    }
    @Test fun rejectUntrustedKeyAndBadSignature(){
        val r=release(2);val other=key()
        assertFalse(PackSignaturePolicy.verify(r,other.public,PackSignaturePolicy.keyId(keys.public),PackReleaseFloor(0,null)))
        assertFalse(PackSignaturePolicy.verify(r,keys.public,"d".repeat(64),PackReleaseFloor(0,null)))
        assertFalse(verify(r.copy(signature=ByteArray(64))))
    }
}
