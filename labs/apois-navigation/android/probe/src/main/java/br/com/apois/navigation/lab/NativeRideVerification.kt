package br.com.apois.navigation.lab

// Identity and assignment only. No coordinates, security PIN, pricing,
// account token, ride mutation or routing-provider permission.
internal data class NativeDriverProfile(val driverId:String,val profileUserId:String)
internal data class NativeRideRow(
    val id:String,val status:String,val driverId:String?,val acceptedDriverId:String?,
    val intermediateStops:Int?,val category:String?
)
internal data class NativeVerifiedRide(
    val identity:RoutingIdentity,val rideId:String,val phase:RidePhase,
    val intermediateStops:Int,val verifiedAt:Long,val category:String
)
internal interface NativeRideReads{
    suspend fun userId():String?
    suspend fun profile():NativeDriverProfile?
    suspend fun ride(id:String):NativeRideRow?
}
internal val nativeRideUuid=Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")

// All reads must use the same captured session and a live source epoch.
// No trust in client status, local JWT claims or the WebView ride row.
internal suspend fun verifyNativeRide(
    reads:NativeRideReads,rideId:String,phase:RidePhase,
    expected:RoutingIdentity,current:()->Boolean,clock:()->Long
):NativeVerifiedRide?{
    if(!nativeRideUuid.matches(rideId)||phase !in setOf(RidePhase.PICKUP,RidePhase.TRIP))return null
    val began=clock()
    fun live():Boolean{
        val now=clock()
        return began>=0&&now>=began&&now-began<=5_000L&&current()
    }
    if(!live())return null
    val auth=reads.userId()?.takeIf{nativeRideUuid.matches(it)}?:return null
    if(!live())return null
    val profile=reads.profile()?:return null
    if(!live()||!nativeRideUuid.matches(profile.driverId)||!nativeRideUuid.matches(profile.profileUserId))return null
    val identity=RoutingIdentity(auth,profile.profileUserId,profile.driverId)
    if(expected!=identity)return null
    val row=reads.ride(rideId)?:return null
    if(!live()||row.id!=rideId)return null
    val owner=row.acceptedDriverId?:row.driverId
    if(owner!=profile.driverId||row.driverId!=null&&row.driverId!=owner)return null
    val status=when(phase){RidePhase.PICKUP->"motorista_a_caminho";RidePhase.TRIP->"em_viagem";else->return null}
    // Current Valhalla resolver uses auto. Never route motorcycles, freight,
    // tow trucks or deliveries as passenger cars without a validated profile.
    if(row.status!=status||row.intermediateStops!=0||row.category!="carros")return null
    if(reads.userId()!=auth||!live())return null
    return NativeVerifiedRide(identity,rideId,phase,0,clock(),row.category)
}
