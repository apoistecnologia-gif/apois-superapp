package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test
import br.com.apois.navigation.lab.NativeRerouteGate.Decision
import br.com.apois.navigation.lab.NativeRerouteGate.Reason

class NativeRerouteGateTest {
    private fun NativeRerouteGate.fix(t: Long, deviation: Double = 80.0, online: Boolean = true, accuracy: Double = 5.0) =
        evaluate(t,t,accuracy,deviation,online)
    @Test fun twoIndependentFixesRequired() {
        val g = NativeRerouteGate()
        assertEquals(Decision.Hold(Reason.CONFIRM_DEVIATION), g.fix(1000))
        assertTrue(g.fix(2000) is Decision.Request)
        assertEquals(1,g.requests)
    }
    @Test fun offlineAndImpreciseDoNotSpendBudget() {
        val g=NativeRerouteGate()
        g.fix(1000,online=false)
        assertEquals(Decision.Hold(Reason.OFFLINE),g.fix(2000,online=false))
        assertEquals(Decision.Hold(Reason.UNRELIABLE),g.fix(3000,accuracy=35.0))
        assertEquals(0,g.requests)
    }
    @Test fun staleAndFutureFixesAreRejected() {
        val g=NativeRerouteGate()
        assertEquals(Decision.Hold(Reason.UNRELIABLE),g.evaluate(12000,1000,5.0,80.0,true))
        assertEquals(Decision.Hold(Reason.UNRELIABLE),g.evaluate(12000,13000,5.0,80.0,true))
        assertEquals(0,g.requests)
    }
    @Test fun oneInFlightAndCooldownAfterFailure() {
        val g=NativeRerouteGate()
        g.fix(1000)
        val first=(g.fix(2000) as Decision.Request).ticket
        g.fix(3000)
        assertEquals(Decision.Hold(Reason.IN_FLIGHT),g.fix(4000))
        assertTrue(g.settle(first))
        assertEquals(Decision.Hold(Reason.RATE_LIMIT),g.fix(5000))
        assertTrue(g.fix(17000) is Decision.Request)
    }
    @Test fun slidingWindowAndLegBudget() {
        val g=NativeRerouteGate()
        for (start in listOf(1000L,16000L,31000L)) {
            g.fix(start)
            val r=g.fix(start+1000) as Decision.Request
            assertTrue(g.settle(r.ticket))
        }
        g.fix(46000)
        assertEquals(Decision.Hold(Reason.RATE_LIMIT),g.fix(47000))
        assertTrue(g.settle((g.fix(62000) as Decision.Request).ticket))
        for(i in 0 until 16) {
            val start=100000L+i*61000L
            g.fix(start)
            assertTrue(g.settle((g.fix(start+1000) as Decision.Request).ticket))
        }
        g.fix(1200000)
        assertEquals(Decision.OfferExternal,g.fix(1201000))
        assertEquals(20,g.requests)
    }
    @Test fun returningToRouteAndSignalLossResetConfirmation() {
        val g=NativeRerouteGate()
        g.fix(1000)
        assertEquals(Decision.Continue,g.fix(2000,deviation=5.0))
        assertEquals(Decision.Hold(Reason.CONFIRM_DEVIATION),g.fix(3000))
        g.invalidateFix()
        assertEquals(Decision.Hold(Reason.CONFIRM_DEVIATION),g.fix(4000))
    }
    @Test fun closedOrForeignTicketCannotSettle() {
        val g=NativeRerouteGate()
        val h=NativeRerouteGate()
        g.fix(1000);h.fix(1000)
        val a=(g.fix(2000) as Decision.Request).ticket
        val b=(h.fix(2000) as Decision.Request).ticket
        assertFalse(g.settle(b))
        g.close()
        assertFalse(g.settle(a))
        assertEquals(Decision.Hold(Reason.CLOSED),g.fix(3000))
    }
}
