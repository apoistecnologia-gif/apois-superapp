package br.com.apois.navigation.lab

// Process-local ownership and bounded acknowledgement history. IDs are unique
// per attempted opening. Only actual Activity destruction is recorded as
// closed. A timeout or startActivity exception never becomes a false ACK.
internal class ConfirmedActivityOwnership(private val capacity:Int=16){
    private var id:String?=null
    private var owner:Any?=null
    private val closed=LinkedHashSet<String>()
    init{require(capacity>0)}
    fun begin(session:String):Boolean{
        if(id!=null||session.isBlank()||session in closed)return false
        id=session;return true
    }
    fun claim(session:String,activity:Any):Boolean{
        if(id!=session||owner!=null)return false
        owner=activity;return true
    }
    fun owns(session:String,activity:Any):Boolean=id==session&&owner===activity
    fun destroyed(session:String,activity:Any):Boolean{
        if(!owns(session,activity))return false
        owner=null;id=null
        closed.add(session)
        if(closed.size>capacity)closed.remove(closed.first())
        return true
    }
    fun acknowledged(session:String):Boolean=session in closed
}
