package br.com.apois.navigation.compat.lab;

import br.com.apois.navigation.lab.LabNavigationBridge;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

// Registered only in the disposable Capacitor host.
@CapacitorPlugin(name="ApoisNavigationLab")
public class ApoisNavigationLabPlugin extends Plugin {
    // Confirmed ride transport is intentionally separate from synthetic replay.
    // Until the live route/provenance/authority owner is installed, this method
    // guarantees no Activity, GPS subscription, TTS, or request was created.
    @PluginMethod
    public void openConfirmed(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                ConfirmedNavigationRequest.parse(call.getData());
                call.resolve(new JSObject().put("state","unavailable"));
            } catch(IllegalArgumentException e) {
                call.reject("Invalid confirmed navigation request");
            }
        });
    }

    // Never close a synthetic replay using a real-ride transport call.
    @PluginMethod
    public void closeConfirmed(PluginCall call) {
        call.resolve(new JSObject().put("closed",false));
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
        getActivity().runOnUiThread(() -> LabNavigationBridge.INSTANCE.closeActive());
    }
}
