package br.com.apois.navigation.lab

import java.util.concurrent.atomic.AtomicBoolean

/** Optional resource ownership for native engines. Network-only implementations
 * continue to use the existing LiveRouteResolver SAM without behavior changes.
 * dispose must be idempotent, nonblocking and revoke result publication.
 */
internal interface ManagedRouteResolver:LiveRouteResolver{
    fun dispose()
}
internal fun releaseManagedResolver(resolver:LiveRouteResolver){
    if(resolver is ManagedRouteResolver){
        try{resolver.dispose()}catch(_:Exception){}catch(_:LinkageError){}
    }
}
internal class RouteResolverLifetime(private val resolver:LiveRouteResolver){
    private val closed=AtomicBoolean(false)
    fun close(){
        if(closed.compareAndSet(false,true))releaseManagedResolver(resolver)
    }
}
