import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const source=resolve(process.argv[2]), root=resolve(process.argv[3]);
const pinned='9fc171050d8b5703540c49d19a8f1e9f5162775f';
assert.equal(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pinned);
const files={
 'src/routes/motorista.app.tsx':'ad3a9ec75be99863e7727d92f0f1e0ecb767f414',
 'src/lib/driverRideLifecycle.mobile.ts':'744a69e8ef2860c89ec1da508c6d38af68c51418',
 'src/components/DriverActiveRideRecovery.tsx':'da1bfd1681d80b6656cee1fd03e76e8cb6c51946',
 'src/lib/driverNativeLocation.ts':'5d494b3e5602372db533c034f1fda9dd55ef5e54'
};
for(const [path,sha] of Object.entries(files)){
 assert.equal(execFileSync('git',['hash-object',resolve(source,path)],{encoding:'utf8'}).trim(),sha,path);
}
const check=(base,path,markers)=>{
 const data=readFileSync(resolve(base,path),'utf8');
 for(const marker of markers)assert.ok(data.includes(marker),path+' missing '+marker);
};
check(source,'src/routes/motorista.app.tsx',['supabase.auth.getUser()','setUserId(d.user_id)','setDriverId(d.id)','const applyActive =','queued_after_ride_id','callStart({ data: { rideId: active.id, safety_code: code } })','tickNavigation(','handleDriverCancelRide','ratingRef.current']);
check(source,'src/lib/driverRideLifecycle.mobile.ts',['driver_accept_ride','driver_mark_arrived','driver_start_ride','_security_code: safetyCode','driver-finish-redispatch','driver-cancel-redispatch','driver_rate_passenger']);
check(root,'scripts/harden-motorista-payment-wait.mjs',['aguardando_pagamento','Não siga para o embarque ainda']);
check(root,'scripts/harden-partner-motorista-finish-authority.mjs',['finalização envia somente rideId']);
check(root,'scripts/harden-partner-motorista-rating-handoff.mjs',['rating.closed','ratingRef.current = null;']);
check(root,'scripts/harden-partner-motorista-session-hygiene.mjs',['Finalize a corrida ativa antes de sair da conta.']);
check(root,'scripts/install-partner-external-navigation.mjs',['APOISExternalNavigationPlugin','com.google.android.apps.maps','com.waze']);
console.log('[OK] Pinned driver source and generation script anchors verified; no files modified.');
