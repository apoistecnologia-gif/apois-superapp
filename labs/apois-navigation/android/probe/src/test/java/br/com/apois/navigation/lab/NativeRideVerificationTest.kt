package br.com.apois.navigation.lab

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class NativeRideVerificationTest{
    private val identity=RoutingIdentity("00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000003")
    private val id="00000000-0000-4000-8000-000000000004"
    private val row=NativeRideRow(id,"motorista_a_caminho",identity.driverId,identity.driverId,0,"carros")
    private class Reads(var auth:String?,var driver:NativeDriverProfile?,var row:NativeRideRow?):NativeRideReads{
        var calls=0
        var afterUser:(()->String?)?=null
        var afterRide:()->Unit={}
        override suspend fun userId():String?{calls++;return if(calls>1&&afterUser!=null)afterUser?.invoke() else auth}
        override suspend fun profile():NativeDriverProfile?{calls++;return driver}
        override suspend fun ride(id:String):NativeRideRow?{calls++;afterRide();return row}
    }
    private fun reads()=Reads(identity.authUserId,NativeDriverProfile(identity.driverId,identity.profileUserId),row)
    @Test fun authenticatedIdentityAndCurrentAssignment()=runBlocking{
        val r=reads()
        val proof=verifyNativeRide(r,id,RidePhase.PICKUP,identity,{true},{1000L})
        assertEquals(NativeVerifiedRide(identity,id,RidePhase.PICKUP,0,1000,"carros"),proof)
        assertEquals(4,r.calls)
    }
    @Test fun rejectWrongAccountOrMissingProfile()=runBlocking{
        assertNull(verifyNativeRide(reads(),id,RidePhase.PICKUP,identity.copy(authUserId=identity.driverId),{true},{1000L}))
        val missing=reads().apply{driver=null}
        assertNull(verifyNativeRide(missing,id,RidePhase.PICKUP,identity,{true},{1000L}))
    }
    @Test fun rejectWrongOwnerPhaseStopsAndMissingRow()=runBlocking{
        for(invalid in listOf(null,row.copy(acceptedDriverId=identity.authUserId),
            row.copy(driverId=identity.authUserId),row.copy(status="motorista_chegou"),
            row.copy(intermediateStops=null),row.copy(intermediateStops=1),row.copy(id=identity.driverId))){
            assertNull(verifyNativeRide(reads().apply{this.row=invalid},id,RidePhase.PICKUP,identity,{true},{1000L}))
        }
    }
    @Test fun onlyCanonicalPassengerCarCategoryIsSupported()=runBlocking{
        for(category in listOf(null,"motos","fretes","guincho","envios","car","CARROS","")){
            val r=reads().apply{this.row=this@NativeRideVerificationTest.row.copy(category=category)}
            assertNull(verifyNativeRide(r,id,RidePhase.PICKUP,identity,{true},{1000L}))
        }
    }
    @Test fun cancellationOrAccountChangeDuringRead()=runBlocking{
        var active=true
        val r=reads().apply{afterRide={active=false}}
        assertNull(verifyNativeRide(r,id,RidePhase.PICKUP,identity,{active},{1000L}))
        val changed=reads().apply{afterUser={identity.driverId}}
        assertNull(verifyNativeRide(changed,id,RidePhase.PICKUP,identity,{true},{1000L}))
    }
    @Test fun slowReadsAndInvalidInputFailClosed()=runBlocking{
        var now=1000L
        val slow=reads().apply{afterRide={now=7000L}}
        assertNull(verifyNativeRide(slow,id,RidePhase.PICKUP,identity,{true},{now}))
        val invalid=reads()
        assertNull(verifyNativeRide(invalid,"bad?id",RidePhase.PICKUP,identity,{true},{1000L}))
        assertEquals(0,invalid.calls)
    }
    @Test fun onlyApprovedHttpsOrigin(){
        val host="project.invalid"
        assertEquals("https://project.invalid",approvedReadBase("https://project.invalid/",host).toString())
        for(url in listOf("http://project.invalid","https://evil.invalid","https://project.invalid.evil.invalid",
            "https://user@project.invalid","https://project.invalid/other","https://project.invalid?x=1","https://project.invalid:444")){
            assertThrows(IllegalArgumentException::class.java){approvedReadBase(url,host)}
        }
    }
}
