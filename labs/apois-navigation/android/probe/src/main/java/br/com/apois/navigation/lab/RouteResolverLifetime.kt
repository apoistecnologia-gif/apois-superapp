package br.com.apois.navigation.lab

import java.util.concurrent.atomic.AtomicBoolean

/** Optional resource ownership for native engines. Network-only implementations
 * continue to use the existing LiveRouteResolver SAM without behavior changes.
 * dispose must be idempotent, nonblocking and revoke result publication.
 */
internal interface ManagedRouteResolver:LiveRouteResolver{
    fun dispose()
    // Optional live resource validity, independent of the ride verifier.
    // Existing managed network resolvers retain their original behavior.
    fun resourcesCurrent():Boolean=true
}
internal fun releaseManagedResolver(resolver:LiveRouteResolver){
    if(resolver is ManagedRouteResolver){
        try{resolver.dispose()}catch(_:Exception){}catch(_:LinkageError){}
    }
}
internal fun resolverResourcesCurrent(resolver:LiveRouteResolver):Boolean=
    if(resolver !is ManagedRouteResolver)true
    else try{resolver.resourcesCurrent()}catch(_:Exception){false}catch(_:LinkageError){false}

internal class RouteResolverLifetime(private val resolver:LiveRouteResolver){
    private val closed=AtomicBoolean(false)
    fun current():Boolean=!closed.get()&&resolverResourcesCurrent(resolver)&&!closed.get()
    fun close(){
        if(closed.compareAndSet(false,true))releaseManagedResolver(resolver)
    }
}
