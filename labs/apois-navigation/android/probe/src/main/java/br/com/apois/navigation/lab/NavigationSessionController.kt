package br.com.apois.navigation.lab

import uniffi.ferrostar.Route

// Lab-only deterministic lifecycle coordinator. Host supplies server-authoritative
// snapshots and executes effects serially on one dispatcher. No direct RPC,
// background location subscription, voice playback, or map launch here.
internal enum class Leg { PICKUP, TRIP }
internal data class LegToken(val rideId:String,val leg:Leg,val generation:Long)
internal sealed interface SessionEffect {
    data class Start(val token:LegToken):SessionEffect
    data class Stop(val token:LegToken):SessionEffect
    data class Deliver(val intent:RideIntent):SessionEffect
    data class ReleaseVoice(val token:LegToken):SessionEffect
    data class PauseVoice(val token:LegToken):SessionEffect
    data class ResumeVoice(val token:LegToken):SessionEffect
}
internal class NavigationSessionController(initial:RideSnapshot,private val retainedInitialBudget:NativeRerouteGate?=null) {
    private val initialLeg=when(initial.phase){RidePhase.PICKUP->Leg.PICKUP;RidePhase.TRIP->Leg.TRIP;else->null}
    var snapshot=initial
        private set
    var token:LegToken?=null
        private set
    private var generation=0L
    private var enabled=false
    private var foreground=true
    private var closed=false
    private var pending:RideIntent?=null
    private var routeResources: LegRouteResources<Route>? = null
    // Trusted host supplies the immutable routing target and resolver only
    // for its current verified token. Keep the same owner on fallback/re-entry.
    fun routingFor(candidate: LegToken, target: RegionalPoint,
                   resolver: LiveRouteResolver): LegRouteResources<Route>? {
        if (!acceptsNavigationEvent(candidate) || !target.valid()) return null
        val existing = routeResources
        if (existing != null) {
            // A changed destination needs a separately audited host flow;
            // never silently reset the budget or reuse the wrong target.
            if (existing.target != target) return null
            return existing
        }
        return LegRouteResources(candidate.rideId, candidate.leg, target, RouteRegion.Vale, resolver::resolve,
            retainedInitialBudget.takeIf{candidate.leg==initialLeg})
            .also { routeResources = it }
    }
    private fun closeRouting() {
        routeResources?.close()
        routeResources = null
    }

    // WAITING_PIN intentionally stops guidance: pickup navigation is over.
    private fun desiredLeg():Leg? = if(!enabled||closed) null else when(snapshot.phase) {
        RidePhase.PICKUP -> Leg.PICKUP
        RidePhase.TRIP -> Leg.TRIP
        else -> null
    }
    private fun reconcile():List<SessionEffect> {
        val leg=desiredLeg()
        if(token?.leg==leg) return emptyList()
        val effects=mutableListOf<SessionEffect>()
        token?.let { effects.add(SessionEffect.Stop(it));effects.add(SessionEffect.ReleaseVoice(it)) }
        token=null
        if(leg!=null){
            val next=LegToken(snapshot.rideId,leg,++generation)
            token=next
            effects.add(SessionEffect.Start(next))
            if(!foreground) effects.add(SessionEffect.PauseVoice(next))
        }
        return effects
    }
    fun enable():List<SessionEffect> {
        if(closed)return emptyList()
        enabled=true
        return reconcile()
    }
    // Disable only on an explicit host decision (e.g. confirmed external fallback).
    fun disable():List<SessionEffect> {
        enabled=false
        routeResources?.suspendAttachment()
        return reconcile()
    }
    fun update(next:RideSnapshot):List<SessionEffect> {
        if(closed)return emptyList()
        val accepted=acceptSnapshot(snapshot,next)
        if(accepted===snapshot)return emptyList()
        // Reject regressions between active phases, not just terminal resurrection.
        val legal=when(snapshot.phase){
            RidePhase.PICKUP -> accepted.phase in setOf(RidePhase.PICKUP,RidePhase.WAITING_PIN,RidePhase.TRIP,RidePhase.CANCELLED)
            RidePhase.WAITING_PIN -> accepted.phase in setOf(RidePhase.WAITING_PIN,RidePhase.TRIP,RidePhase.CANCELLED)
            RidePhase.TRIP -> accepted.phase in setOf(RidePhase.TRIP,RidePhase.COMPLETED,RidePhase.CANCELLED)
            RidePhase.COMPLETED, RidePhase.CANCELLED -> accepted.phase==snapshot.phase
        }
        if(!legal)return emptyList()
        if (accepted.phase != snapshot.phase) closeRouting()
        snapshot=accepted
        pending=null
        return reconcile()
    }
    // Only verified current tokens may publish route, ETA, arrival or speech.
    // Navigator arrival has no effect on the authoritative ride snapshot.
    fun acceptsNavigationEvent(candidate:LegToken):Boolean =
        !closed && token==candidate
    fun acceptsSpeech(candidate:LegToken):Boolean =
        foreground && acceptsNavigationEvent(candidate)
    fun setForeground(value:Boolean):List<SessionEffect> {
        if(closed||foreground==value)return emptyList()
        foreground=value
        return token?.let { listOf(if(value)SessionEffect.ResumeVoice(it) else SessionEffect.PauseVoice(it)) }?:emptyList()
    }
    // Rating, PIN, finish and fallback are requests to the host only.
    fun submit(intent:RideIntent):List<SessionEffect> {
        if(closed||pending!=null||intent!=snapshot.intent(intent.action,intent.rating))return emptyList()
        pending=intent
        return listOf(SessionEffect.Deliver(intent))
    }
    fun close():List<SessionEffect>{
        if(closed)return emptyList()
        closed=true
        closeRouting()
        pending=null
        return reconcile()
    }
}
