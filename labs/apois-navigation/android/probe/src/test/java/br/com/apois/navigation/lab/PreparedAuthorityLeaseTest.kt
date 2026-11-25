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
    @Test fun expirationDoesNotResurrectAfterClockRegression(){
        var now=1000L
        val lease=PreparedAuthorityLease({now})
        now=31000;assertFalse(lease.current())
        now=2000;assertFalse(lease.current());assertFalse(lease.renew())
    }
    @Test fun regressionWithinLeaseAlsoRevokesWithoutRenewal(){
        var now=1000L
        val lease=PreparedAuthorityLease({now})
        now=2000;assertTrue(lease.current())
        now=1500;assertFalse(lease.current())
        now=3000;assertFalse(lease.current());assertFalse(lease.renew())
    }
    @Test fun renewalReadsClockExactlyOnce(){
        var reads=0
        val lease=PreparedAuthorityLease({1000L+(reads++).toLong()})
        assertTrue(lease.renew());assertEquals(2,reads)
    }
}
