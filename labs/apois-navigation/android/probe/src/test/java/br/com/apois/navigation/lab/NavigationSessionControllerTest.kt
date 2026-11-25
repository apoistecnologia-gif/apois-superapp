package br.com.apois.navigation.lab
import org.junit.Assert.*
import org.junit.Test
class NavigationSessionControllerTest {
    private fun ride(p:RidePhase=RidePhase.PICKUP,r:Long=1)=RideSnapshot("ride-lab",p,r,"Destino",null,null)
    @Test fun disabledUntilExplicitEnable(){
        val c=NavigationSessionController(ride())
        assertNull(c.token)
        assertEquals(1,c.enable().size)
        assertTrue(c.enable().isEmpty())
    }
    @Test fun waitingPinStopsPickupAndTripStartsFresh(){
        val c=NavigationSessionController(ride())
        c.enable();val first=c.token!!
        assertEquals(listOf(SessionEffect.Stop(first),SessionEffect.ReleaseVoice(first)),c.update(ride(RidePhase.WAITING_PIN,2)))
        assertNull(c.token)
        assertFalse(c.acceptsNavigationEvent(first))
        val pin=c.snapshot.intent(RideAction.OPEN_PIN)!!
        assertEquals(listOf(SessionEffect.Deliver(pin)),c.submit(pin))
        assertTrue(c.submit(pin).isEmpty())
        c.update(ride(RidePhase.TRIP,3))
        assertEquals(Leg.TRIP,c.token!!.leg)
        assertNotEquals(first,c.token)
    }
    @Test fun cancellationStopsAndInvalidatesLateEvents(){
        val c=NavigationSessionController(ride());c.enable();val t=c.token!!
        c.update(ride(RidePhase.CANCELLED,2))
        assertNull(c.token)
        assertFalse(c.acceptsNavigationEvent(t))
        assertFalse(c.acceptsSpeech(t))
        assertTrue(c.update(ride(RidePhase.TRIP,3)).isEmpty())
        assertEquals(RidePhase.CANCELLED,c.snapshot.phase)
    }
    @Test fun arrivalDoesNotCompleteAndFinishIsOnlyRequest(){
        val c=NavigationSessionController(ride(RidePhase.TRIP));c.enable()
        assertTrue(c.acceptsNavigationEvent(c.token!!))
        val i=c.snapshot.intent(RideAction.FINISH)!!
        assertEquals(listOf(SessionEffect.Deliver(i)),c.submit(i))
        assertEquals(RidePhase.TRIP,c.snapshot.phase)
        assertTrue(c.submit(i).isEmpty())
        val t=c.token!!
        assertEquals(listOf(SessionEffect.Stop(t),SessionEffect.ReleaseVoice(t)),c.update(ride(RidePhase.COMPLETED,2)))
        assertFalse(c.acceptsNavigationEvent(t))
        assertNotNull(c.snapshot.intent(RideAction.RATE,5))
    }
    @Test fun staleSnapshotsAndRegressionsCannotRestartPickup(){
        val c=NavigationSessionController(ride(RidePhase.TRIP,5));c.enable();val t=c.token
        assertTrue(c.update(ride(RidePhase.PICKUP,6)).isEmpty())
        assertTrue(c.update(ride(RidePhase.COMPLETED,4)).isEmpty())
        assertTrue(c.update(ride(RidePhase.COMPLETED,6).copy(rideId="other")).isEmpty())
        assertEquals(t,c.token)
    }
    @Test fun backgroundPausesSpeechWithoutChangingRide(){
        val c=NavigationSessionController(ride());c.enable();val t=c.token!!
        assertEquals(listOf(SessionEffect.PauseVoice(t)),c.setForeground(false))
        assertFalse(c.acceptsSpeech(t))
        assertTrue(c.acceptsNavigationEvent(t))
        assertEquals(listOf(SessionEffect.ResumeVoice(t)),c.setForeground(true))
        assertTrue(c.acceptsSpeech(t))
    }
    @Test fun confirmedFallbackReleasesOnlyNavigation(){
        val c=NavigationSessionController(ride(RidePhase.TRIP));c.enable();val t=c.token!!
        val i=c.snapshot.intent(RideAction.REQUEST_EXTERNAL)!!
        assertEquals(listOf(SessionEffect.Deliver(i)),c.submit(i))
        assertEquals(t,c.token)
        assertEquals(listOf(SessionEffect.Stop(t),SessionEffect.ReleaseVoice(t)),c.disable())
        assertEquals(RidePhase.TRIP,c.snapshot.phase)
    }
    @Test fun oldActionRejectedAndHostCanRetryAfterError(){
        val c=NavigationSessionController(ride(RidePhase.TRIP));c.enable()
        val i=c.snapshot.intent(RideAction.FINISH)!!
        c.submit(i)
        c.update(ride(RidePhase.TRIP,2).copy(error="Falha"))
        assertTrue(c.submit(i).isEmpty())
        assertEquals(1,c.submit(c.snapshot.intent(RideAction.FINISH)!!).size)
    }
    @Test fun closeIsIdempotentAndInvalidatesAllCallbacks(){
        val c=NavigationSessionController(ride());c.enable();val t=c.token!!
        assertEquals(2,c.close().size)
        assertTrue(c.close().isEmpty());assertTrue(c.enable().isEmpty())
        assertFalse(c.acceptsNavigationEvent(t))
        assertTrue(c.submit(c.snapshot.intent(RideAction.RETURN)!!).isEmpty())
    }
}
