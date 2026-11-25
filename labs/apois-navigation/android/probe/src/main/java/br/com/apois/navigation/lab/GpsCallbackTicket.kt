package br.com.apois.navigation.lab

// Pure identity/capture-time check used by the main-thread GPS delivery path.
internal data class GpsCallbackTicket(
    val sourceId: Long, val consumerId: Long, val notBeforeElapsedMs: Long
) {
    fun accepts(source: Long, consumer: Long, captureElapsedMs: Long): Boolean =
        sourceId > 0 && consumerId > 0 && source == sourceId &&
            consumer == consumerId && captureElapsedMs >= notBeforeElapsedMs
}
