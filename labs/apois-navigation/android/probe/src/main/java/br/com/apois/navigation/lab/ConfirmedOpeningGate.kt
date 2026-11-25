package br.com.apois.navigation.lab

internal data class ConfirmedHostRequest(val rideId:String,val phase:RidePhase,val revision:Long){
    fun valid():Boolean=nativeRideUuid.matches(rideId)&&phase in setOf(RidePhase.PICKUP,RidePhase.TRIP)&&revision==0L
    fun matches(target:ApprovedIndependentTarget):Boolean=valid()&&target.usable()&&rideId==target.rideId&&phase==target.phase
}

// Single flight through asynchronous preparation. A cancellation is not an
// acknowledgement of completion; a new request is blocked until cleanup.
internal class ConfirmedOpeningGate{
    internal class Ticket(val request:ConfirmedHostRequest){
        var cancelled=false
            private set
        fun cancel(){cancelled=true}
    }
    private var active:Ticket?=null
    fun begin(request:ConfirmedHostRequest):Ticket?{
        if(active!=null||!request.valid())return null
        return Ticket(request).also{active=it}
    }
    fun current(ticket:Ticket):Boolean=active===ticket&&!ticket.cancelled
    fun cancel(request:ConfirmedHostRequest):Boolean{
        val t=active?:return false
        if(t.request!=request)return false
        t.cancel();return true
    }
    fun finish(ticket:Ticket){if(active===ticket)active=null}
}
