package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test

class ValhallaRouteClientPolicyTest {
    @Test fun acceptsOnlyExplicitHttpsRoute() {
        assertEquals("routes.example.invalid",validatedRouteEndpoint("https://routes.example.invalid/route","routes.example.invalid").host)
        for (url in listOf("http://routes.example.invalid/route","https://evil.invalid/route",
            "https://user@routes.example.invalid/route","https://routes.example.invalid/route?x=1",
            "https://routes.example.invalid/route#x","https://routes.example.invalid:8443/route",
            "https://routes.example.invalid/other","https://routes.example.invalid/route/")) {
            assertTrue(url,runCatching { validatedRouteEndpoint(url,"routes.example.invalid") }.isFailure)
        }
    }
    @Test fun requiresRegionalEndpointsAndGeometry() {
        val a=RegionalPoint(-9.4039,-40.5040)
        val b=RegionalPoint(-9.4165,-40.5035)
        assertTrue(routeEndpointsMatch(listOf(a,b),a,b))
        assertFalse(routeEndpointsMatch(listOf(b,a),a,b))
        assertFalse(routeEndpointsMatch(listOf(a),a,b))
        assertFalse(routeEndpointsMatch(listOf(a,RegionalPoint(0.0,0.0),b),a,b))
        assertFalse(RegionalPoint(Double.NaN,-40.5).valid())
        assertFalse(RegionalPoint(-10.0,-40.5).valid())
    }
    @Test fun rejectsWrongArrivalAndDistantOrigin() {
        val a=RegionalPoint(-9.4039,-40.5040)
        val b=RegionalPoint(-9.4165,-40.5035)
        val c=RegionalPoint(-9.45,-40.50)
        assertFalse(routeEndpointsMatch(listOf(a,c),a,b))
        assertFalse(routeEndpointsMatch(listOf(c,b),a,b))
        assertTrue(a.distanceTo(a)<0.01)
        assertTrue(a.distanceTo(b)>1000)
    }
}
