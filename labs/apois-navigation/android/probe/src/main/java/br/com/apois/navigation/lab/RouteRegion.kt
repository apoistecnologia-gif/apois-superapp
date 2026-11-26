package br.com.apois.navigation.lab

// Explicit immutable scope per navigation owner. The default remains Vale;
// a broader scope can only be constructed from a hash-verified policy.
// Vertex membership is not proof that every segment stays inside a polygon.
internal sealed class RouteRegion {
    abstract fun contains(point:RegionalPoint):Boolean
    data object Vale:RouteRegion(){
        override fun contains(point:RegionalPoint)=point.valid()
    }
    // Dedicated rectangular field pilot, never the official Northeast policy.
    data object FieldPilot:RouteRegion(){
        override fun contains(point:RegionalPoint)=point.lat.isFinite()&&point.lng.isFinite()&&
            point.lat in -7.75..-6.85&&point.lng in -41.85..-41.15
    }
    class Verified(private val policy:NativeRegionPolicy):RouteRegion(){
        override fun contains(point:RegionalPoint)=policy.contains(point.lat,point.lng)
    }
}
