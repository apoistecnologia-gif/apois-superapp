import test from 'node:test';
import assert from 'node:assert/strict';
import {MotoristaAuthority} from './motorista-authority.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const auth={authUserId:id(1),profileUserId:id(2),driverId:id(3)};
const row=(status,extra={})=>({id:id(4),driver_id:id(3),accepted_driver_id:id(3),status,...extra});
const proof=(g,revision=1,extra={})=>({epoch:g.epoch,authUserId:id(1),driverId:id(3),revision,...extra});
const setup=()=>{const g=new MotoristaAuthority();g.bind(auth);return g;};
const accept=(g,status,revision=1,extra={})=>g.accept(row(status,extra),proof(g,revision));
const event=(g,action,extra={})=>({...g.snapshot,action,...extra});
test('payment and queued offers cannot start navigation',()=>{
 const g=setup();assert.equal(accept(g,'aguardando_pagamento'),false);
 assert.equal(accept(g,'procurar_motorista'),false);
 assert.equal(accept(g,'procurar_motorista',1,{queued_after_ride_id:id(5)}),false);
 assert.equal(g.snapshot,null);
 // Existing source activates the queued ride when its status becomes active.
 assert.equal(accept(g,'motorista_a_caminho',2,{queued_after_ride_id:id(5)}),true);
});
test('verified assigned driver required, no ambiguous ownership',()=>{
 const g=setup();assert.equal(g.accept(row('em_viagem'),proof(g,1,{authUserId:id(9)})),false);
 assert.equal(accept(g,'em_viagem',1,{accepted_driver_id:id(9)}),false);
 assert.equal(accept(g,'em_viagem',1,{driver_id:id(9)}),false);
 assert.equal(accept(g,'em_viagem'),true);
});
test('PIN only at confirmed arrival, no automatic arrival or start',()=>{
 const g=setup();accept(g,'motorista_a_caminho');
 for(const action of ['OPEN_PIN','FINISH','ARRIVE','START'])assert.equal(g.authorize(event(g,action),g.epoch),null);
 accept(g,'motorista_chegou',2);
 const t=g.authorize(event(g,'OPEN_PIN'),g.epoch);assert.ok(t);
 assert.equal(g.authorize(event(g,'OPEN_PIN'),g.epoch),null);assert.equal(g.snapshot.phase,'WAITING_PIN');
 assert.equal(accept(g,'em_viagem',3),true);assert.equal(g.current(t),false);
});
test('finish intent never changes phase or carries price',()=>{
 const g=setup();accept(g,'em_viagem');
 const t=g.authorize(event(g,'FINISH',{price:1,pin:'1234'}),g.epoch);
 assert.deepEqual(Object.keys(t).sort(),['action','epoch','revision','rideId'].sort());
 assert.equal(g.snapshot.phase,'TRIP');assert.equal(g.settle(t),true);
 assert.equal(accept(g,'finalizada',2),true);
 assert.equal(g.authorize(event(g,'RATE',{rating:6}),g.epoch),null);
 assert.ok(g.authorize(event(g,'RATE',{rating:5}),g.epoch));
});
test('cancellation invalidates old intent; regression and stale snapshots rejected',()=>{
 const g=setup();accept(g,'em_viagem',4);const t=g.authorize(event(g,'FINISH'),g.epoch);
 assert.equal(accept(g,'motorista_a_caminho',5),false);assert.equal(accept(g,'finalizada',3),false);
 assert.equal(accept(g,'cancelada_passageiro',5),true);assert.equal(g.current(t),false);
 assert.equal(accept(g,'em_viagem',6),false);
});
test('account switch and logout revoke old callbacks even if revision matches',()=>{
 const g=setup();accept(g,'em_viagem');const old=g.epoch,t=g.authorize(event(g,'RETURN'),old);
 assert.equal(g.bind({...auth,authUserId:id(8)}),true);assert.equal(g.current(t),false);
 assert.equal(g.accept(row('em_viagem'),proof(g,1,{epoch:old})),false);
 g.revoke();assert.equal(g.accept(row('em_viagem'),proof(g)),false);
});
test('same account token refresh preserves session, next ride needs explicit clear',()=>{
 const g=setup();accept(g,'em_viagem');let epoch=g.epoch;
 g.bind({...auth});assert.equal(g.epoch,epoch);
 assert.equal(accept(g,'motorista_a_caminho',2,{id:id(5)}),false);
 assert.equal(g.clearRide(epoch),true);assert.equal(g.clearRide(epoch),false);
 assert.equal(accept(g,'motorista_a_caminho',1,{id:id(5)}),true);
 g.close();assert.equal(g.bind(auth),false);
});

test('newer verified ownership loss revokes current ride but stale or unrelated rows do not',()=>{
 const g=setup();accept(g,'em_viagem',4);const epoch=g.epoch;
 const t=g.authorize(event(g,'FINISH'),epoch);
 assert.equal(accept(g,'em_viagem',3,{driver_id:id(9),accepted_driver_id:id(9)}),false);
 assert.equal(accept(g,'em_viagem',5,{id:id(6),driver_id:id(9),accepted_driver_id:id(9)}),false);
 assert.equal(g.current(t),true);
 assert.equal(accept(g,'em_viagem',5,{driver_id:id(9),accepted_driver_id:id(9)}),false);
 assert.equal(g.snapshot,null);assert.equal(g.current(t),false);
 assert.equal(g.accept(row('em_viagem'),proof(g,6,{epoch})),false);
});
test('verified disappearance and redispatch revoke pending actions',()=>{
 const g=setup();accept(g,'em_viagem',4);const t=g.authorize(event(g,'FINISH'),g.epoch);
 assert.equal(g.invalidateMissingRide(id(4),proof(g,3)),false);
 assert.equal(g.invalidateMissingRide(id(5),proof(g,5)),false);
 assert.equal(g.invalidateMissingRide(id(4),proof(g,5)),true);
 assert.equal(g.current(t),false);
 accept(g,'motorista_a_caminho',1);
 assert.equal(accept(g,'procurar_motorista',2),false);
 assert.equal(g.snapshot,null);
});
