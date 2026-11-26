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

// Main-thread session gate. Cancellation invalidates results immediately, but
// retains ownership until the coroutine actually settles (blocking TLS may
// not be interruptible immediately). An old ticket cannot clear a new one.
internal class FieldInitialRequestGate {
    class Ticket internal constructor()
    private var pending:Ticket?=null
    private var invalidated=false
    var attempted=false
        private set
    fun begin():Ticket? {
        if(attempted||pending!=null)return null
        attempted=true;invalidated=false
        return Ticket().also{pending=it}
    }
    fun accepts(ticket:Ticket)=pending===ticket&&!invalidated
    fun invalidate(){if(pending!=null)invalidated=true}
    fun finish(ticket:Ticket):Boolean {
        if(pending!==ticket)return false
        pending=null;invalidated=false
        return true
    }
    fun allowRetry():Boolean {
        if(pending!=null||!attempted)return false
        attempted=false;return true
    }
    fun reset(){pending=null;invalidated=false;attempted=false}
}
