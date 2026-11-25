package br.com.apois.navigation.lab

// Provisional fail-closed lab lease, not authentication. Only trusted in-process
// host evidence may renew; JS/intent arguments cannot extend the lease.
internal class PreparedAuthorityLease(private val clock:()->Long,private val ttlMillis:Long=30_000L){
    private var issued=clock()
    private var revoked=false
    private var observed=issued
    init{require(ttlMillis in 1..30_000L && issued>=0)}
    private fun validate(now:Long):Boolean{
        if(revoked)return false
        // A regression or expiration is terminal even if no renewal was
        // attempted. Never resurrect a previously rejected authorization.
        if(now<observed||now<issued||now-issued>=ttlMillis){revoke();return false}
        observed=now
        return true
    }
    fun current():Boolean=validate(clock())
    fun renew():Boolean{
        val now=clock()
        if(!validate(now))return false
        issued=now
        return true
    }
    fun revoke(){revoked=true}
}
