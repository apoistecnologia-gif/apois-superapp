package br.com.apois.navigation.compat.lab;

import java.util.regex.Pattern;

// Transport validation only. A UUID is NOT evidence of authentication or
// assignment. No operation or Activity may be authorized by this parser.
final class ConfirmedNavigationRequest {
    private static final Pattern RIDE_ID = Pattern.compile(
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$");
    final String rideId;
    final String phase;
    final long revision;

    private ConfirmedNavigationRequest(String id, String phase, long revision) {
        this.rideId=id;this.phase=phase;this.revision=revision;
    }

    static String sessionId(Object id) {
        if(!(id instanceof String)||!RIDE_ID.matcher((String)id).matches())
            throw new IllegalArgumentException("Invalid session");
        return (String)id;
    }

    static ConfirmedNavigationRequest validate(Object id,Object phase,Object revision) {
        if(!(id instanceof String)||!RIDE_ID.matcher((String)id).matches())
            throw new IllegalArgumentException("Invalid ride");
        if(!"PICKUP".equals(phase)&&!"TRIP".equals(phase))
            throw new IllegalArgumentException("Invalid phase");
        if(!(revision instanceof Number)) throw new IllegalArgumentException("Invalid revision");
        double value=((Number)revision).doubleValue();
        if(!Double.isFinite(value)||value<0||value>1_000_000_000L||value!=Math.floor(value))
            throw new IllegalArgumentException("Invalid revision");
        return new ConfirmedNavigationRequest((String)id,(String)phase,(long)value);
    }
}
