package br.com.apois.navigation.compat.lab;

public final class ConfirmedNavigationRequestTest {
    private static final String ID="00000000-0000-4000-8000-000000000001";
    private static void reject(Object id,Object phase,Object revision){
        try { ConfirmedNavigationRequest.validate(id,phase,revision); }
        catch(IllegalArgumentException expected){return;}
        throw new AssertionError("Invalid request accepted");
    }
    public static void main(String[] args){
        for(String phase:new String[]{"PICKUP","TRIP"}){
            ConfirmedNavigationRequest r=ConfirmedNavigationRequest.validate(ID,phase,0);
            if(!ID.equals(r.rideId)||!phase.equals(r.phase)||r.revision!=0)throw new AssertionError("Bad request");
        }
        for(Object id:new Object[]{null,"lab-fake","",123,"00000000-0000-0000-0000-000000000001"})reject(id,"PICKUP",0);
        for(Object phase:new Object[]{null,"WAITING_PIN","COMPLETED","FINISH","CANCELLED",123})reject(ID,phase,0);
        for(Object revision:new Object[]{null,"0",true,-1,1.5,Double.NaN,Double.POSITIVE_INFINITY,1_000_000_001L})reject(ID,"TRIP",revision);
        if(ConfirmedNavigationRequest.validate(ID,"TRIP",1_000_000_000L).revision!=1_000_000_000L)throw new AssertionError("Boundary");
        System.out.println("[OK] confirmed transport: two active phases, invalid ID/phase/revision rejected; no Android operation");
    }
}
