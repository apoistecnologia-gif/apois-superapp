package br.com.apois.navigation.compat.lab;

import br.com.apois.navigation.lab.LabNavigationBridge;
import br.com.apois.navigation.lab.ConfirmedLiveNavigationBridge;
import br.com.apois.navigation.lab.NativeConfirmedHost;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

// Registered only in the disposable Capacitor host.
@CapacitorPlugin(name="ApoisNavigationLab")
public class ApoisNavigationLabPlugin extends Plugin {
    // Confirmed ride transport is intentionally separate from synthetic replay.
    // Without a trusted prepared live session and a dedicated event listener,
    // this method cannot start an Activity, GPS subscription, TTS or route request.
    @PluginMethod
    public void confirmedAvailability(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if(call.getData()==null||call.getData().length()!=0){call.reject("Invalid capability request");return;}
            call.resolve(new JSObject().put("configured",NativeConfirmedHost.INSTANCE.configured()));
        });
    }

    @PluginMethod
    public void openConfirmed(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                JSObject data=call.getData();
                if(data==null||data.length()!=3||!data.has("rideId")||!data.has("phase")||!data.has("revision"))
                    throw new IllegalArgumentException("Invalid request");
                ConfirmedNavigationRequest request=ConfirmedNavigationRequest.validate(data.opt("rideId"),data.opt("phase"),data.opt("revision"));
                if(!hasListeners("confirmedRideIntent")){
                    call.resolve(new JSObject().put("state","unavailable"));
                    return;
                }
                NativeConfirmedHost.INSTANCE.open(getActivity(),request.rideId,request.phase,request.revision,
                    () -> hasListeners("confirmedRideIntent"),event -> {
                        try {notifyListeners("confirmedRideIntent",JSObject.fromJSONObject(event),false);}
                        catch(Exception ignored) { /* No business action executed. */ }
                    }, id -> {
                        JSObject result=new JSObject().put("state",id==null?"unavailable":"opened");
                        if(id!=null)result.put("sessionId",id);
                        call.resolve(result);
                    }, () -> call.reject("Confirmed navigation opening not acknowledged"));
            } catch(IllegalArgumentException e) {
                call.reject("Invalid confirmed navigation request");
            } catch(Exception e) {
                call.reject("Confirmed navigation opening not acknowledged");
            }
        });
    }

    @PluginMethod
    public void cancelConfirmedPreparation(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                JSObject data=call.getData();
                if(data==null||data.length()!=3)throw new IllegalArgumentException("Invalid request");
                ConfirmedNavigationRequest req=ConfirmedNavigationRequest.validate(data.opt("rideId"),data.opt("phase"),data.opt("revision"));
                call.resolve(new JSObject().put("cancelled",NativeConfirmedHost.INSTANCE.cancelPending(req.rideId,req.phase,req.revision)));
            }catch(Exception e){call.reject("Invalid preparation cancellation");}
        });
    }

    // Never close a synthetic replay using a real-ride transport call.
    @PluginMethod
    public void closeConfirmed(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String id=call.getString("sessionId");
            if(id==null){call.resolve(new JSObject().put("closed",false));return;}
            ConfirmedLiveNavigationBridge.INSTANCE.closeAcknowledged(id,closed ->
                call.resolve(new JSObject().put("closed",closed)));
        });
    }

    @PluginMethod
    public void open(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if(!hasListeners("rideIntent")) {call.reject("Register rideIntent listener first");return;}
                String id=LabNavigationBridge.INSTANCE.open(getActivity(),call.getData(),event -> {
                    try {notifyListeners("rideIntent",JSObject.fromJSONObject(event),false);}
                    catch(Exception ignored) { /* lab event lost; no business action is executed */ }
                });
                call.resolve(new JSObject().put("sessionId",id));
            } catch(Exception e) {call.reject("Unable to open isolated lab");}
        });
    }
    @PluginMethod
    public void update(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                String id=call.getString("sessionId");
                JSObject snapshot=call.getObject("snapshot");
                if(id==null||snapshot==null){call.reject("Session and snapshot required");return;}
                call.resolve(new JSObject().put("accepted",LabNavigationBridge.INSTANCE.update(id,snapshot)));
            } catch(Exception e){call.reject("Invalid lab snapshot");}
        });
    }
    @PluginMethod
    public void close(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String id=call.getString("sessionId");
            call.resolve(new JSObject().put("closed",id!=null&&LabNavigationBridge.INSTANCE.close(id)));
        });
    }
    @Override protected void handleOnDestroy(){
        getActivity().runOnUiThread(() -> {
            NativeConfirmedHost.INSTANCE.destroy();
            LabNavigationBridge.INSTANCE.closeActive();
        });
    }
}
