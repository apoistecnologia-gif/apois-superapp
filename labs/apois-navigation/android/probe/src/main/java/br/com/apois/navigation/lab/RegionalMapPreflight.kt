package br.com.apois.navigation.lab

// A map check is not authority. The owner must still be current after any
// asynchronous local installation, and cancellation must propagate.
internal suspend fun <T:Any> preflightRegionalMap(
    current:()->Boolean, load:suspend ()->T?
):T? {
    fun authorized()=runCatching{current()}.getOrDefault(false)
    if(!authorized())return null
    val map=load()?:return null
    return map.takeIf{authorized()}
}
