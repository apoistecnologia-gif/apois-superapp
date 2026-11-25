package br.com.apois.navigation.lab

import org.junit.Assert.*
import org.junit.Test

class ConfirmedActivityOwnershipTest{
    @Test fun onlyExactOwnerCanAcknowledgeDestruction(){
        val state=ConfirmedActivityOwnership();val first=Any();val duplicate=Any()
        assertTrue(state.begin("s1"));assertFalse(state.acknowledged("s1"))
        assertTrue(state.claim("s1",first));assertFalse(state.claim("s1",duplicate))
        assertFalse(state.destroyed("s1",duplicate));assertFalse(state.acknowledged("s1"))
        assertTrue(state.destroyed("s1",first));assertTrue(state.acknowledged("s1"))
    }
    @Test fun lateDestroyCannotAffectNewSession(){
        val state=ConfirmedActivityOwnership();val old=Any();val next=Any()
        assertTrue(state.begin("s1"));assertTrue(state.claim("s1",old))
        assertTrue(state.destroyed("s1",old));assertTrue(state.begin("s2"));assertTrue(state.claim("s2",next))
        assertFalse(state.claim("s1",old));assertFalse(state.destroyed("s1",old))
        assertTrue(state.owns("s2",next));assertTrue(state.acknowledged("s1"));assertFalse(state.acknowledged("s2"))
    }
    @Test fun unclaimedOrTimedOutOpeningIsNotClosed(){
        val state=ConfirmedActivityOwnership()
        assertTrue(state.begin("s1"));assertFalse(state.begin("s2"))
        assertFalse(state.acknowledged("s1"));assertFalse(state.destroyed("s1",Any()))
        val late=Any();assertTrue(state.claim("s1",late));assertTrue(state.destroyed("s1",late))
    }
    @Test fun acknowledgementHistoryIsBounded(){
        val state=ConfirmedActivityOwnership(2)
        for(id in listOf("s1","s2","s3")){
            val a=Any();assertTrue(state.begin(id));assertTrue(state.claim(id,a));assertTrue(state.destroyed(id,a))
        }
        assertFalse(state.acknowledged("s1"));assertTrue(state.acknowledged("s2"));assertTrue(state.acknowledged("s3"))
    }
}
