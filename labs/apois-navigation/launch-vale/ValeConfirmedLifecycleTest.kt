package br.com.apois.navigation.lab

import android.location.Location
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Actual confirmed Activity, passive feed, Compose, map, engine and bridge.
 * All ride authority and Location samples are synthetic CI fixtures. No
 * production registration, credentials, network, or physical GPS claim. */
@RunWith(AndroidJUnit4::class)
class ValeConfirmedLifecycleTest{
    @Test fun openBackReopenOtherLegAndRevoke(){
        val inst=InstrumentationRegistry.getInstrumentation()
        val app=inst.targetContext.applicationContext
        val device=UiDevice.getInstance(inst)
        val pack=runBlocking{VerifiedValeRuntimePack.install(app)}
        val identity=RoutingIdentity("00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000003")
        val rideId="00000000-0000-4000-8000-000000000084"
        val evidenceId="00000000-0000-4000-8000-000000000085"
        val origin=RegionalPoint(-9.403901,-40.5040233)
        val targetPoint=RegionalPoint(-9.4165,-40.5035)
        val active=AtomicBoolean(true)
        val handler=Handler(Looper.getMainLooper())
        var source=0L
        var tick:Runnable?=null
        val scenario=ActivityScenario.launch(ValeLifecycleFixtureActivity::class.java)
        try{
            scenario.onActivity{
                source=DriverGpsFeed.beginSource()
                assertTrue(NativeDriverReadSource.bind(source,"https://fixture.invalid","synthetic-ci-key"){ "synthetic-ci-token" })
                assertTrue(NativeConfirmedHost.install(NativeHostConfiguration("fixture.invalid","","",{true},grant={req->
                    valeDriverGrant(app,pack,req,active::get,{r->
                        if(!active.get())null else DriverControlTarget(
                            ApprovedIndependentTarget(identity,rideId,r.phase,targetPoint,RoutingTargetSource.INDEPENDENT_OSM),evidenceId,1)
                    })
                },localRoutingOnly=true)))
                tick=object:Runnable{
                    override fun run(){
                        val ticket=DriverGpsFeed.consumerTicket(source)
                        if(ticket!=0L){
                            val fix=Location("ci-synthetic-fixture").apply{
                                latitude=origin.lat;longitude=origin.lng
                                accuracy=6f;speed=0f;bearing=90f
                                time=System.currentTimeMillis();elapsedRealtimeNanos=SystemClock.elapsedRealtimeNanos()
                            }
                            DriverGpsFeed.publish(source,ticket,fix)
                        }
                        handler.postDelayed(this,1000L)
                    }
                }.also{handler.post(it)}
            }
            fun open(phase:RidePhase,expected:String):Pair<String,CountDownLatch>{
                val opened=CountDownLatch(1);val closed=CountDownLatch(1)
                val session=AtomicReference<String?>();val uncertain=AtomicBoolean(false)
                val event=AtomicReference<JSONObject?>()
                scenario.onActivity{host->
                    NativeConfirmedHost.open(host,rideId,phase.name,0,{true},{e->
                        if(e.optString("action")=="SESSION_CLOSED"){event.set(e);closed.countDown()}
                    },{id->session.set(id);opened.countDown()},{uncertain.set(true);opened.countDown()})
                }
                assertTrue("open callback timeout",opened.await(40,TimeUnit.SECONDS))
                assertFalse("ambiguous opening",uncertain.get())
                val id=checkNotNull(session.get()){ "native session unavailable" }
                assertTrue("confirmed Activity not rendered",device.wait(Until.hasObject(By.textContains(expected)),20_000L))
                assertTrue("host-only operations not shown",device.wait(Until.hasObject(By.textContains("demais ações permanecem")),10_000L))
                inst.runOnMainSync{
                    val screen=checkNotNull(ConfirmedLiveNavigationBridge.screen.value)
                    assertEquals(id,screen.id);assertEquals(phase,screen.ride.phase)
                    assertTrue(ConfirmedLiveNavigationBridge.accepts(id,screen.token))
                }
                // Caller closes the Activity or revokes its authority. The
                // latch only fires when actual Activity destruction is observed.
                if(phase==RidePhase.PICKUP)device.pressBack() else active.set(false)
                assertTrue("actual destruction not acknowledged",closed.await(15,TimeUnit.SECONDS))
                val e=checkNotNull(event.get());assertEquals(id,e.getString("sessionId"))
                assertEquals(rideId,e.getString("rideId"));assertEquals(0L,e.getLong("revision"))
                return id to closed
            }
            val pickup=open(RidePhase.PICKUP,"Indo ao passageiro").first
            assertTrue(device.wait(Until.hasObject(By.textContains("APOIS CI fixture")),10_000L))
            val ack=CountDownLatch(1);val accepted=AtomicBoolean(false)
            inst.runOnMainSync{ConfirmedLiveNavigationBridge.closeAcknowledged(pickup){ok->accepted.set(ok);ack.countDown()}}
            assertTrue(ack.await(5,TimeUnit.SECONDS));assertTrue(accepted.get())
            val trip=open(RidePhase.TRIP,"Corrida em andamento").first
            assertNotEquals(pickup,trip)
            assertTrue(device.wait(Until.hasObject(By.textContains("APOIS CI fixture")),10_000L))
            inst.runOnMainSync{assertNull(ConfirmedLiveNavigationBridge.screen.value);assertFalse(ConfirmedLiveNavigationBridge.occupied())}
            android.util.Log.i("APOIS_VALE_LIFECYCLE","confirmed_activity=true; back_ack=true; next_leg=true; authority_revoked=true; synthetic_gps=true")
        }finally{
            inst.runOnMainSync{
                tick?.let{handler.removeCallbacks(it)}
                NativeConfirmedHost.destroy()
                if(source!=0L){NativeDriverReadSource.unbind(source);DriverGpsFeed.endSource(source)}
            }
            scenario.close()
        }
    }
}
