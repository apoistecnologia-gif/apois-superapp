package br.com.apois.navigation.lab

import kotlinx.coroutines.ensureActive

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

/** The map is fully verified before the first authorization request. A grant
 * received after invalidation is discarded, not transferred to the caller. */
internal suspend fun <M:Any,G:Any> mapThenGrant(
    current:()->Boolean,load:suspend ()->M?,grant:suspend ()->G?,discard:(G)->Unit
):Pair<M,G>?{
    fun live()=runCatching{current()}.getOrDefault(false)
    val map=preflightRegionalMap(::live,load)?:return null
    kotlinx.coroutines.currentCoroutineContext().ensureActive()
    val result=grant()?:return null
    var keep=false
    try{
        kotlinx.coroutines.currentCoroutineContext().ensureActive()
        if(!live())return null
        keep=true
        return map to result
    }finally{if(!keep)discard(result)}
}
