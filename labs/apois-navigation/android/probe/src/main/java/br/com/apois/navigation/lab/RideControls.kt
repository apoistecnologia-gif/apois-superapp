package br.com.apois.navigation.lab

// Pure UI contract. Only a verified ride snapshot from the host can change phase.
// Neither GPS nor the navigator can mark pickup, start, complete or rate a ride.
internal enum class RidePhase { PICKUP, WAITING_PIN, TRIP, COMPLETED, CANCELLED }
internal enum class RideAction { OPEN_PIN, FINISH, REQUEST_EXTERNAL, RATE, SKIP_RATING, RETURN }
internal data class RideSnapshot(
    val rideId: String, val phase: RidePhase, val revision: Long,
    val destination: String, val passenger: String?, val totalLabel: String?,
    val busy: Boolean = false, val error: String? = null
) {
    init { require(rideId.isNotBlank() && revision >= 0) }
}
internal data class RideIntent(val rideId: String, val revision: Long, val action: RideAction, val rating: Int? = null)
internal fun RideSnapshot.intent(action: RideAction, rating: Int? = null): RideIntent? {
    if (busy) return null
    val valid = when (action) {
        RideAction.OPEN_PIN -> phase == RidePhase.WAITING_PIN
        RideAction.FINISH -> phase == RidePhase.TRIP
        RideAction.REQUEST_EXTERNAL -> phase in setOf(RidePhase.PICKUP,RidePhase.WAITING_PIN,RidePhase.TRIP)
        RideAction.RATE -> phase == RidePhase.COMPLETED && rating != null && rating in 1..5
        RideAction.SKIP_RATING -> phase == RidePhase.COMPLETED
        RideAction.RETURN -> true
    }
    return if (valid) RideIntent(rideId,revision,action,if(action==RideAction.RATE)rating else null) else null
}
// Only the host can confirm a new authoritative phase. Ignore stale/different ride snapshots.
internal fun acceptSnapshot(current: RideSnapshot, next: RideSnapshot): RideSnapshot {
    if (next.rideId != current.rideId || next.revision <= current.revision) return current
    if (current.phase in setOf(RidePhase.COMPLETED,RidePhase.CANCELLED) && next.phase != current.phase) return current
    return next
}
