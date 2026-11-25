package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test

class RerouteResponseGuardTest {
    private val a=RegionalPoint(-9.4039,-40.5040)
    private val b=RegionalPoint(-9.4165,-40.5035)
    private fun accept(current:Boolean=true, foreground:Boolean=true, off:Boolean=true,
        quality:GpsQuality=GpsQuality.AVAILABLE,pending:Boolean=true, now:Long=20000,
        captured:Long=15000,accuracy:Double=5.0,latest:RegionalPoint=a,target:RegionalPoint=b) =
        mayApplyReroute(current,foreground,off,quality,pending,now,captured,accuracy,listOf(a,b),latest,target)
    @Test fun acceptsFreshCurrentRequest() { assertTrue(accept()) }
    @Test fun rejectsCancelledReplacedOrBackgroundRide() {
        assertFalse(accept(current=false)); assertFalse(accept(foreground=false)); assertFalse(accept(pending=false))
    }
    @Test fun rejectsRecoveredRouteOrSignalLoss() {
        assertFalse(accept(off=false)); assertFalse(accept(quality=GpsQuality.LOST))
        assertFalse(accept(quality=GpsQuality.IMPRECISE))
    }
    @Test fun rejectsExpiredFutureOrImpreciseFix() {
        assertFalse(accept(captured=9999)); assertFalse(accept(captured=20001))
        assertFalse(accept(accuracy=26.0)); assertFalse(accept(accuracy=Double.NaN))
    }
    @Test fun rejectsMovementTooFarOrWrongTarget() {
        assertFalse(accept(latest=RegionalPoint(-9.45,-40.50)))
        assertFalse(accept(target=RegionalPoint(-9.45,-40.50)))
    }
}
