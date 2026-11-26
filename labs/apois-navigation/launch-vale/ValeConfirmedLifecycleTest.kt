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
import java.io.ByteArrayOutputStream
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
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
    @Test fun openBackReopenSameLegThenOtherLegAndRevoke(){
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
        fun diagnostics(){
            runCatching{inst.runOnMainSync{
                val resumed=ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED).map{it.javaClass.simpleName}
                val state=ConfirmedLiveNavigationBridge.screen.value
                android.util.Log.e("APOIS_VALE_LIFECYCLE","diagnostic resumed=$resumed; screen=${state!=null}; occupied=${ConfirmedLiveNavigationBridge.occupied()}; accepted=${state?.let{ConfirmedLiveNavigationBridge.accepts(it.id,it.token)}}")
            }}
            runCatching{val out=ByteArrayOutputStream();device.dumpWindowHierarchy(out);android.util.Log.e("APOIS_VALE_LIFECYCLE","diagnostic hierarchy="+out.toString("UTF-8").take(12000))}
        }
        // The previous CI hierarchy proved a Pixel Launcher ANR covered the
        // resumed, authorized APOIS Activity. Only dismiss that exact external
        // system dialog; never dismiss an APOIS crash/ANR or restart a ride.
        var launcherDismissals=0
        fun waitForAppText(expected:String,timeout:Long):Boolean{
            val until=SystemClock.elapsedRealtime()+timeout
            val selector=By.pkg(app.packageName).textContains(expected)
            while(SystemClock.elapsedRealtime()<until){
                if(device.hasObject(By.pkg("android").text("Pixel Launcher isn't responding"))){
                    val close=device.findObject(By.pkg("android").res("android:id/aerr_close"))
                    check(close!=null&&launcherDismissals<2){"External launcher ANR could not be cleared"}
                    launcherDismissals++
                    android.util.Log.w("APOIS_VALE_LIFECYCLE","external_launcher_anr_dismissed=$launcherDismissals")
                    close.click()
                }else if(device.wait(Until.hasObject(selector),1000L)==true)return true
            }
            return false
        }
        try{
            device.wakeUp()
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
                assertTrue("confirmed Activity not rendered: $expected",waitForAppText(expected,25_000L))
                assertTrue("host-only operations not shown",waitForAppText("demais ações permanecem",10_000L))
                inst.runOnMainSync{
                    val screen=checkNotNull(ConfirmedLiveNavigationBridge.screen.value)
                    val resumed=ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED)
                    assertEquals("actual confirmed Activity must be resumed",1,resumed.count{it is ConfirmedLiveNavigationActivity})
                    assertEquals(id,screen.id);assertEquals(phase,screen.ride.phase)
                    assertTrue(ConfirmedLiveNavigationBridge.accepts(id,screen.token))
                }
                // Caller closes the Activity or revokes its authority. The
                // latch only fires when actual Activity destruction is observed.
                if(phase==RidePhase.PICKUP)assertTrue("Back was not delivered",device.pressBack()) else active.set(false)
                assertTrue("actual destruction not acknowledged",closed.await(15,TimeUnit.SECONDS))
                val e=checkNotNull(event.get());assertEquals(id,e.getString("sessionId"))
                assertEquals(rideId,e.getString("rideId"));assertEquals(0L,e.getLong("revision"))
                return id to closed
            }
            val pickup=open(RidePhase.PICKUP,"Indo ao passageiro").first
            assertTrue(waitForAppText("APOIS CI fixture",10_000L))
            val ack=CountDownLatch(1);val accepted=AtomicBoolean(false)
            inst.runOnMainSync{ConfirmedLiveNavigationBridge.closeAcknowledged(pickup){ok->accepted.set(ok);ack.countDown()}}
            assertTrue(ack.await(5,TimeUnit.SECONDS));assertTrue(accepted.get())
            // Reopening requires real acknowledged destruction and a fresh proof.
            // Do not manipulate the Android clock or bypass the 30-second gate.
            val early=CountDownLatch(1);val earlyId=AtomicReference<String?>();val earlyUncertain=AtomicBoolean(false)
            scenario.onActivity{host->
                NativeConfirmedHost.open(host,rideId,RidePhase.PICKUP.name,0,{true},{},
                    {id->earlyId.set(id);early.countDown()},{earlyUncertain.set(true);early.countDown()})
            }
            assertTrue(early.await(40,TimeUnit.SECONDS))
            assertNull(earlyId.get());assertFalse(earlyUncertain.get())
            SystemClock.sleep(30_100L)
            val reopened=open(RidePhase.PICKUP,"Indo ao passageiro").first
            assertNotEquals(pickup,reopened)
            assertTrue(waitForAppText("APOIS CI fixture",10_000L))
            val exhausted=CountDownLatch(1);val exhaustedId=AtomicReference<String?>();val exhaustedUncertain=AtomicBoolean(false)
            scenario.onActivity{host->
                NativeConfirmedHost.open(host,rideId,RidePhase.PICKUP.name,0,{true},{},
                    {id->exhaustedId.set(id);exhausted.countDown()},{exhaustedUncertain.set(true);exhausted.countDown()})
            }
            assertTrue(exhausted.await(40,TimeUnit.SECONDS))
            assertNull(exhaustedId.get());assertFalse(exhaustedUncertain.get())
            val trip=open(RidePhase.TRIP,"Corrida em andamento").first
            assertNotEquals(pickup,trip)
            assertTrue(waitForAppText("APOIS CI fixture",10_000L))
            inst.runOnMainSync{assertNull(ConfirmedLiveNavigationBridge.screen.value);assertFalse(ConfirmedLiveNavigationBridge.occupied())}
            android.util.Log.i("APOIS_VALE_LIFECYCLE","confirmed_activity=true; back_ack=true; same_leg_reentry=true; bounded_reentry=true; next_leg=true; authority_revoked=true; synthetic_gps=true")
        }catch(t:Throwable){
            diagnostics()
            throw t
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
