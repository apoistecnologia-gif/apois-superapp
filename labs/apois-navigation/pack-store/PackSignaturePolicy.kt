package br.com.apois.navigation.lab

import java.security.MessageDigest
import java.security.AlgorithmParameters
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.PublicKey
import java.security.Signature
import java.security.interfaces.ECPublicKey

/** Trusted release key must be pinned by the host; no key or signing service
 * is provisioned by this laboratory. Caller supplies the trusted rollback floor.
 */
internal data class SignedPackRelease(val spec:OfflinePackSpec,val sequence:Long,val signature:ByteArray){
    fun payload():ByteArray{
        require(sequence>0)
        return ("APOIS-OFFLINE-PACK-RELEASE-v1\n"+sequence+"\n"+spec.identity()+"\n").toByteArray(Charsets.UTF_8)
    }
}
internal data class PackReleaseFloor(val sequence:Long,val identity:String?){
    init{
        require(sequence>=0)
        require(if(sequence==0L)identity==null else identity?.matches(Regex("[a-f0-9]{64}"))==true)
    }
}
internal object PackSignaturePolicy{
    private val p256:ECParameterSpec by lazy{
        AlgorithmParameters.getInstance("EC").apply{init(ECGenParameterSpec("secp256r1"))}.getParameterSpec(ECParameterSpec::class.java)
    }
    private fun supported(key:ECPublicKey):Boolean{
        val p=key.params;val q=p256
        return p.curve==q.curve&&p.generator==q.generator&&p.order==q.order&&p.cofactor==q.cofactor
    }
    fun keyId(key:PublicKey):String=MessageDigest.getInstance("SHA-256").digest(key.encoded).joinToString(""){"%02x".format(it.toInt() and 255)}
    fun verify(release:SignedPackRelease,key:PublicKey,pinnedKeyId:String,floor:PackReleaseFloor):Boolean=runCatching{
        require(key is ECPublicKey&&supported(key)&&key.encoded.size in 1..512)
        require(pinnedKeyId.matches(Regex("[a-f0-9]{64}"))&&keyId(key)==pinnedKeyId)
        require(release.signature.size in 8..80)
        val id=release.spec.identity()
        require(release.sequence>floor.sequence||(release.sequence==floor.sequence&&id==floor.identity))
        val verifier=Signature.getInstance("SHA256withECDSA")
        verifier.initVerify(key);verifier.update(release.payload());verifier.verify(release.signature)
    }.getOrDefault(false)
}


/** Only for a caller that supplies a trusted rollback floor. Snapshot mutable
 * inputs before verifying and reading source. Does not persist or activate
 * a release, provision a key or perform network IO. */
internal fun installSignedCandidate(
    store:OfflinePackStore,release:SignedPackRelease,key:PublicKey,pinnedKeyId:String,
    floor:PackReleaseFloor,source:(String)->java.io.InputStream
):java.io.File{
    val candidate=release.copy(spec=release.spec.validated(),signature=release.signature.copyOf())
    check(PackSignaturePolicy.verify(candidate,key,pinnedKeyId,floor)){"untrusted pack release"}
    return store.install(candidate.spec,source)
}


/** Uses the private scoped floor. Does not expose a selected/active pointer.
 * Caller must explicitly bootstrap trusted baseline, never on a failed read. */
internal fun installWithPersistedFloor(
    store:OfflinePackStore,release:SignedPackRelease,key:PublicKey,pinnedKeyId:String,
    floor:PackFloorStore,source:(String)->java.io.InputStream
):java.io.File{
    val candidate=release.copy(spec=release.spec.validated(),signature=release.signature.copyOf())
    check(floor.matchesScope(candidate.spec.region,pinnedKeyId))
    val next=PackReleaseFloor(candidate.sequence,candidate.spec.identity())
    return floor.accept(next){current->installSignedCandidate(store,candidate,key,pinnedKeyId,current,source)}
}
