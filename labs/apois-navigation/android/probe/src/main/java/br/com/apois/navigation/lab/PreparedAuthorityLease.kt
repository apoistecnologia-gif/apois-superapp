package br.com.apois.navigation.lab

// Provisional fail-closed lab lease, not authentication. Only trusted in-process
// host evidence may renew; JS/intent arguments cannot extend the lease.
internal class PreparedAuthorityLease(private val clock:()->Long,private val ttlMillis:Long=30_000L){
    private var issued=clock()
    private var revoked=false
    init{require(ttlMillis in 1..30_000L && issued>=0)}
    fun current():Boolean{
        val now=clock()
        return !revoked&&now>=issued&&now-issued<ttlMillis
    }
    fun renew():Boolean{
        if(!current()){revoke();return false}
        issued=clock()
        return true
    }
    fun revoke(){revoked=true}
}
