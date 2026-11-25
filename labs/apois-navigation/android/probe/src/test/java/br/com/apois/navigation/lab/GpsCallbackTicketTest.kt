package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test

class GpsCallbackTicketTest {
    @Test fun sameEpochAndConsumerAcceptFreshCapture() {
        val active = GpsCallbackTicket(10, 20, 1000)
        assertTrue(active.accepts(10, 20, 1000))
        assertTrue(active.accepts(10, 20, 1200))
    }
    @Test fun previousServiceEpochRejectedAfterRestart() {
        assertFalse(GpsCallbackTicket(11, 21, 1000).accepts(10, 20, 1200))
    }
    @Test fun previousLegRejectedWithinSameService() {
        assertFalse(GpsCallbackTicket(10, 21, 1000).accepts(10, 20, 1200))
    }
    @Test fun capturePredatingSubscriptionRejectedEvenWithMatchingIds() {
        assertFalse(GpsCallbackTicket(10, 21, 1000).accepts(10, 21, 999))
    }
    @Test fun absentConsumerOrSourceRejected() {
        assertFalse(GpsCallbackTicket(10, 0, 1000).accepts(10, 0, 1200))
        assertFalse(GpsCallbackTicket(0, 20, 1000).accepts(0, 20, 1200))
    }
}
