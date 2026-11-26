package br.com.apois.navigation.lab

// Explicit lab subdomain only; never a public demo or production API.
internal fun fieldV3Host(raw:String):String? {
    val host=raw.trim().lowercase(java.util.Locale.ROOT)
    return host.takeIf{Regex("navigation-lab(?:-[a-z0-9]{1,20})?[.]apoisbrasil[.]com[.]br").matches(it)}
}
internal fun fieldV3Target(lat:String,lon:String):RegionalPoint? {
    val p=RegionalPoint(lat.trim().toDoubleOrNull()?:return null,lon.trim().toDoubleOrNull()?:return null)
    return p.takeIf{RouteRegion.FieldPilot.contains(it)&&fieldPackContains(it.lat,it.lng)}
}
internal fun fieldV3FixReady(fix:InitialRouteFix,now:Long):Boolean =
    RouteRegion.FieldPilot.contains(fix.point)&&fieldPackContains(fix.point.lat,fix.point.lng)&&
    fix.captured>0&&now>=fix.captured&&now-fix.captured<=5000&&
    fix.accuracy.isFinite()&&fix.accuracy>0&&fix.accuracy<=20
