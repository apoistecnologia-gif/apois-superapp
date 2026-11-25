package br.com.apois.navigation.lab
import org.junit.Assert.*
import org.junit.Test
class RideControlsTest {
    private fun ride(phase:RidePhase, revision:Long=1,busy:Boolean=false)=RideSnapshot("fake",phase,revision,"Destino de teste",null,null,busy)
    @Test fun onlyConfirmedPickupAllowsPin(){
        assertNull(ride(RidePhase.PICKUP).intent(RideAction.OPEN_PIN))
        assertNotNull(ride(RidePhase.WAITING_PIN).intent(RideAction.OPEN_PIN))
        assertNull(ride(RidePhase.TRIP).intent(RideAction.OPEN_PIN))
    }
    @Test fun finishRequiresActiveTrip(){
        for(p in RidePhase.entries) assertEquals(p==RidePhase.TRIP,ride(p).intent(RideAction.FINISH)!=null)
    }
    @Test fun onlyCompletedAllowsValidRating(){
        assertNull(ride(RidePhase.TRIP).intent(RideAction.RATE,5))
        assertNull(ride(RidePhase.COMPLETED).intent(RideAction.RATE,0))
        assertNull(ride(RidePhase.COMPLETED).intent(RideAction.RATE,6))
        assertEquals(4,ride(RidePhase.COMPLETED).intent(RideAction.RATE,4)?.rating)
    }
    @Test fun busyBlocksAllActions(){for(a in RideAction.entries)assertNull(ride(RidePhase.TRIP,busy=true).intent(a))}
    @Test fun oldOrOtherRideIgnored(){
        val current=ride(RidePhase.TRIP,3)
        assertEquals(current,acceptSnapshot(current,ride(RidePhase.PICKUP,2)))
        assertEquals(current,acceptSnapshot(current,ride(RidePhase.COMPLETED,4).copy(rideId="other")))
    }
    @Test fun terminalCannotBeResurrected(){
        val current=ride(RidePhase.CANCELLED,4)
        assertEquals(current,acceptSnapshot(current,ride(RidePhase.TRIP,5)))
    }
    @Test fun actionKeepsIdentityAndRevision(){
        assertEquals(RideIntent("fake",7,RideAction.FINISH),ride(RidePhase.TRIP,7).intent(RideAction.FINISH))
    }
}
