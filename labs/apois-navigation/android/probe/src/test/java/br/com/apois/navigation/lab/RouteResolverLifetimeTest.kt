package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test
import uniffi.ferrostar.Route

class RouteResolverLifetimeTest{
    private class Fake:ManagedRouteResolver{
        var disposed=0
        override suspend fun resolve(origin:RegionalPoint,destination:RegionalPoint):Route=error("not used")
        override fun dispose(){disposed++}
    }
    @Test fun ownerReleasesExactlyOnce(){
        val fake=Fake()
        val lifetime=RouteResolverLifetime(fake)
        lifetime.close();lifetime.close()
        assertEquals(1,fake.disposed)
    }
    @Test fun rejectedCandidateIsReleased(){
        val fake=Fake();releaseManagedResolver(fake)
        assertEquals(1,fake.disposed)
    }
    @Test fun networkResolverStillSupported(){
        val resolver=LiveRouteResolver{_,_->error("not used")}
        RouteResolverLifetime(resolver).close()
    }
}
