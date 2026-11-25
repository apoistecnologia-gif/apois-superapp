package br.com.apois.navigation.lab
import org.junit.Assert.*
import org.junit.Test
class PreparedAuthorityLeaseTest{
    @Test fun expiresAtBoundaryEvenWithoutGpsOrWebView(){
        var now=1000L
        val lease=PreparedAuthorityLease({now})
        now=30999;assertTrue(lease.current())
        now=31000;assertFalse(lease.current());assertFalse(lease.renew())
    }
    @Test fun verifiedRenewalExtendsBeforeExpiryButNotAfter(){
        var now=1000L
        val lease=PreparedAuthorityLease({now})
        now=20000;assertTrue(lease.renew())
        now=49999;assertTrue(lease.current())
        now=50000;assertFalse(lease.current());assertFalse(lease.renew())
    }
    @Test fun revokeCannotBeRenewed(){
        var now=1000L
        val lease=PreparedAuthorityLease({now})
        lease.revoke();now=1100;assertFalse(lease.current());assertFalse(lease.renew())
    }
    @Test fun clockRegressionFailsClosed(){
        var now=1000L
        val lease=PreparedAuthorityLease({now})
        now=999;assertFalse(lease.current());assertFalse(lease.renew())
        now=1000;assertFalse(lease.current())
    }
}
