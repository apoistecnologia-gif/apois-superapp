package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test

class GpsFixGateTest {
    private val wall = 1_800_000_000_000L
    private fun sample(t: Long = 100_000, accuracy: Double? = 8.0) =
        GpsSample(-9.39, -40.50, accuracy, t, wall)
    @Test fun acceptsFreshStationaryFixes() {
        val gate = GpsFixGate()
        assertEquals(FixDecision.ACCEPT, gate.evaluate(sample(), 100_000, wall))
        assertEquals(FixDecision.ACCEPT, gate.evaluate(sample(105_000), 105_000, wall))
        assertTrue(gate.hasFreshFix(105_000))
    }
    @Test fun ignoresDuplicateOutOfOrderAndBurst() {
        val gate = GpsFixGate()
        assertEquals(FixDecision.ACCEPT, gate.evaluate(sample(), 100_000, wall))
        for (t in listOf(100_000L, 99_999L, 100_200L, 100_100L))
            assertEquals(FixDecision.IGNORE, gate.evaluate(sample(t), 101_000, wall))
        assertEquals(FixDecision.ACCEPT, gate.evaluate(sample(101_000), 101_000, wall))
    }
    @Test fun rejectsStaleFutureAndInvalidTime() {
        val gate = GpsFixGate()
        for (t in listOf(0L, 84_999L, 100_001L))
            assertEquals(FixDecision.IGNORE, gate.evaluate(sample(t), 100_000, wall))
        assertEquals(FixDecision.IGNORE, gate.evaluate(sample().copy(wallMs = wall + 5_001), 100_000, wall))
        assertEquals(FixDecision.IGNORE, gate.evaluate(sample().copy(wallMs = wall - 30_001), 100_000, wall))
        assertFalse(gate.hasFreshFix(100_000))
    }
    @Test fun rejectsMissingNonFiniteAndImpreciseAccuracy() {
        for (a in listOf(null, 0.0, -1.0, Double.NaN, Double.POSITIVE_INFINITY, 36.0)) {
            val gate = GpsFixGate()
            assertEquals(FixDecision.IMPRECISE, gate.evaluate(sample(accuracy = a), 100_000, wall))
            assertFalse(gate.hasFreshFix(100_000))
        }
    }
    @Test fun rejectsInvalidCoordinatesAndMockLocations() {
        for (fix in listOf(sample().copy(lat = Double.NaN), sample().copy(lng = 181.0), sample().copy(mock = true))) {
            assertEquals(FixDecision.LOST, GpsFixGate().evaluate(fix, 100_000, wall))
        }
    }
    @Test fun lossAndRecoveryWithoutReplayingOldFix() {
        val gate = GpsFixGate()
        assertEquals(FixDecision.ACCEPT, gate.evaluate(sample(), 100_000, wall))
        assertTrue(gate.hasFreshFix(115_000))
        assertFalse(gate.hasFreshFix(115_001))
        assertEquals(FixDecision.IGNORE, gate.evaluate(sample(), 116_000, wall))
        assertEquals(FixDecision.ACCEPT, gate.evaluate(sample(116_000), 116_000, wall))
        assertTrue(gate.hasFreshFix(116_000))
    }
    @Test fun poorFixDoesNotExtendFreshness() {
        val gate = GpsFixGate()
        gate.evaluate(sample(), 100_000, wall)
        assertEquals(FixDecision.IMPRECISE, gate.evaluate(sample(114_000, 100.0), 114_000, wall))
        assertFalse(gate.hasFreshFix(115_001))
    }
}
