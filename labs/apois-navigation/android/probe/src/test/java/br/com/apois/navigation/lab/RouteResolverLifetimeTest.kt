package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test
import uniffi.ferrostar.Route

class RouteResolverLifetimeTest{
    private class Fake:ManagedRouteResolver{
        var disposed=0
        var available=true
        var broken=false
        override fun resourcesCurrent():Boolean{check(!broken);return available}
        override suspend fun resolve(origin:RegionalPoint,destination:RegionalPoint):Route=error("not used")
        override fun dispose(){disposed++}
    }
    @Test fun ownerReleasesExactlyOnce(){
        val fake=Fake()
        val lifetime=RouteResolverLifetime(fake)
        assertTrue(lifetime.current())
        lifetime.close();lifetime.close()
        assertFalse(lifetime.current())
        assertEquals(1,fake.disposed)
    }
    @Test fun rejectedCandidateIsReleased(){
        val fake=Fake();releaseManagedResolver(fake)
        assertEquals(1,fake.disposed)
    }
    @Test fun resourceInvalidationOrErrorBlocksOwner(){
        val fake=Fake()
        val lifetime=RouteResolverLifetime(fake)
        assertTrue(lifetime.current())
        fake.available=false
        assertFalse(lifetime.current())
        fake.available=true;fake.broken=true
        assertFalse(lifetime.current())
        lifetime.close()
        assertEquals(1,fake.disposed)
    }
    @Test fun networkResolverStillSupported(){
        val resolver=LiveRouteResolver{_,_->error("not used")}
        val lifetime=RouteResolverLifetime(resolver)
        assertTrue(lifetime.current())
        lifetime.close()
        assertFalse(lifetime.current())
    }
}
