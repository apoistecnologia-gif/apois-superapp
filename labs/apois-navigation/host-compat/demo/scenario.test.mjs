import test from "node:test";
import assert from "node:assert/strict";
import {createDemo} from "./scenario.mjs";
function setup(){
 let handler,timer,session=0;const updates=[],closed=[];
 const bridge={
  async addListener(n,h){assert.equal(n,"rideIntent");handler=h;return {remove:async()=>{handler=null;}};},
  async open(s){assert.match(s.rideId,/^lab-/);return {sessionId:"session-"+(++session)};},
  async update(r){updates.push(r);return {accepted:true};},
  async close(r){closed.push(r);return {closed:true};}
 };
 const d=createDemo(bridge,{schedule:f=>{timer=f;return 1;},unschedule:()=>{timer=null;}});
 return {d,updates,closed,fire:async()=>{timer?.();await d.idle();},send:async (action,extra={})=>{const s=d.state();handler({sessionId:s.sessionId,rideId:s.rideId,revision:s.revision,action,...extra});await d.idle();}};
}
test("complete synthetic pickup, trip, rating",async()=>{const x=setup();await x.d.start("full");await x.fire();assert.equal(x.d.state().phase,"WAITING_PIN");await x.send("OPEN_PIN");assert.equal(x.d.state().phase,"TRIP");await x.send("FINISH");assert.equal(x.d.state().phase,"COMPLETED");await x.send("RATE",{rating:5});assert.equal(x.d.state(),null);assert.equal(x.updates.length,3);assert.equal(x.closed.length,1);});
test("cancel cannot complete",async()=>{const x=setup();await x.d.start("cancel");await x.fire();assert.equal(x.d.state().phase,"CANCELLED");await x.send("FINISH");assert.equal(x.d.state().phase,"CANCELLED");await x.send("RETURN");assert.equal(x.d.state(),null);});
test("stale, foreign, invalid events ignored",async()=>{const x=setup();await x.d.start("trip");await x.send("FINISH",{revision:0});await x.send("FINISH",{sessionId:"old"});await x.send("FINISH",{rideId:"other"});await x.send("RATE",{rating:5});assert.equal(x.updates.length,0);await x.send("FINISH");await x.send("RATE",{rating:6});assert.equal(x.d.state().phase,"COMPLETED");await x.send("SKIP_RATING");assert.equal(x.d.state(),null);});
test("external fallback closes only fake session",async()=>{const x=setup();await x.d.start("trip");await x.send("REQUEST_EXTERNAL");assert.equal(x.d.state(),null);assert.equal(x.updates.length,0);});
test("replacing session and disposal",async()=>{const x=setup();const old=await x.d.start("full");const newer=await x.d.start("trip");assert.notEqual(old,newer);await x.fire();assert.equal(x.d.state().phase,"TRIP");await x.d.dispose();assert.equal(x.d.state(),null);await assert.rejects(x.d.start("trip"));});
