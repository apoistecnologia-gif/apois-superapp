package br.com.apois.navigation.lab

// Explicit immutable scope per navigation owner. The default remains Vale;
// a broader scope can only be constructed from a hash-verified policy.
// Vertex membership is not proof that every segment stays inside a polygon.
internal sealed class RouteRegion {
    abstract fun contains(point:RegionalPoint):Boolean
    data object Vale:RouteRegion(){
        override fun contains(point:RegionalPoint)=point.valid()
    }
    class Verified(private val policy:NativeRegionPolicy):RouteRegion(){
        override fun contains(point:RegionalPoint)=policy.contains(point.lat,point.lng)
    }
}
