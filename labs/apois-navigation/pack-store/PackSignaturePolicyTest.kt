package br.com.apois.navigation.lab
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import org.junit.Assert.*
import org.junit.Test
import org.junit.Rule
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.File
import java.security.MessageDigest

class PackSignaturePolicyTest{
    @get:Rule val tmp=TemporaryFolder()
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
    @Test fun signedInstallRejectsBeforeReadingAndAcceptsExactBytes(){
        val root=tmp.newFolder()
        val store=OfflinePackStore(root,1024,0)
        val bytes="fixture".toByteArray()
        val hash=MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it.toInt() and 255)}
        val exact=spec.copy(files=spec.files.map{it.copy(bytes=bytes.size.toLong(),sha256=hash)})
        val draft=SignedPackRelease(exact,2,byteArrayOf())
        val signer=Signature.getInstance("SHA256withECDSA")
        signer.initSign(keys.private);signer.update(draft.payload())
        val valid=draft.copy(signature=signer.sign())
        val pin=PackSignaturePolicy.keyId(keys.public)
        var reads=0
        val source:(String)->java.io.InputStream={reads++;ByteArrayInputStream(bytes)}
        for(floor in listOf(PackReleaseFloor(3,exact.identity()),PackReleaseFloor(2,"c".repeat(64)))){
            assertTrue(runCatching{installSignedCandidate(store,valid,keys.public,pin,floor,source)}.isFailure)
        }
        assertTrue(runCatching{installSignedCandidate(store,valid.copy(signature=ByteArray(64)),keys.public,pin,PackReleaseFloor(0,null),source)}.isFailure)
        assertEquals(0,reads);assertTrue(root.list()!!.isEmpty())
        val dir=installSignedCandidate(store,valid,keys.public,pin,PackReleaseFloor(0,null),source)
        assertEquals(3,reads);assertEquals(dir,store.openVerified(exact))
    }
    @Test fun persistentFloorAdvancesOnlyAfterVerifiedInstall(){
        val root=tmp.newFolder()
        val store=OfflinePackStore(File(root,"packs"),1024,0)
        val floorRoot=File(root,"floor").also{assertTrue(it.mkdir())}
        val pin=PackSignaturePolicy.keyId(keys.public)
        val floor=PackFloorStore(floorRoot,spec.region,pin)
        val bytes="fixture".toByteArray()
        val hash=MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it.toInt() and 255)}
        val exact=spec.copy(files=spec.files.map{it.copy(bytes=bytes.size.toLong(),sha256=hash)})
        fun signed(sequence:Long):SignedPackRelease{
            val draft=SignedPackRelease(exact,sequence,byteArrayOf())
            val signer=Signature.getInstance("SHA256withECDSA")
            signer.initSign(keys.private);signer.update(draft.payload())
            return draft.copy(signature=signer.sign())
        }
        val r=signed(2);val initial=PackReleaseFloor(0,null)
        assertTrue(runCatching{installWithPersistedFloor(store,r,keys.public,pin,floor){error("missing floor")}}.isFailure)
        floor.bootstrap(initial)
        assertTrue(runCatching{installWithPersistedFloor(store,r,keys.public,pin,floor){ByteArrayInputStream(byteArrayOf(0))}}.isFailure)
        assertEquals(initial,floor.read())
        val dir=installWithPersistedFloor(store,r,keys.public,pin,floor){ByteArrayInputStream(bytes)}
        assertEquals(PackReleaseFloor(2,exact.identity()),floor.read())
        assertTrue(runCatching{installWithPersistedFloor(store,signed(1),keys.public,pin,floor){error("rollback source")}}.isFailure)
        assertEquals(dir,installWithPersistedFloor(store,r,keys.public,pin,floor){error("already installed")})
    }
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
    @Test fun rejectDifferentCurveEvenWhenPinned(){
        val other=KeyPairGenerator.getInstance("EC").apply{initialize(ECGenParameterSpec("secp384r1"))}.generateKeyPair()
        val draft=SignedPackRelease(spec,2,byteArrayOf())
        val signer=Signature.getInstance("SHA256withECDSA")
        signer.initSign(other.private);signer.update(draft.payload())
        assertFalse(PackSignaturePolicy.verify(draft.copy(signature=signer.sign()),other.public,PackSignaturePolicy.keyId(other.public),PackReleaseFloor(0,null)))
    }
    @Test fun rejectUntrustedKeyAndBadSignature(){
        val r=release(2);val other=key()
        assertFalse(PackSignaturePolicy.verify(r,other.public,PackSignaturePolicy.keyId(keys.public),PackReleaseFloor(0,null)))
        assertFalse(PackSignaturePolicy.verify(r,keys.public,"d".repeat(64),PackReleaseFloor(0,null)))
        assertFalse(verify(r.copy(signature=ByteArray(64))))
    }
}
