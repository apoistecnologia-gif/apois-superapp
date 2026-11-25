import test from "node:test";
import assert from "node:assert/strict";
import {chooseNavigation,startSession,requestFallback} from "./policy.mjs";
test("disabled by default, external preserved",()=>assert.equal(chooseNavigation().provider,"google"));
test("waze choice preserved",()=>assert.equal(chooseNavigation({preferred:"waze"}).provider,"waze"));
test("unknown or Google-derived data never enters independent renderer",()=>{for(const dataSource of ["unknown","google","google_places"])assert.equal(chooseNavigation({enabled:true,ready:true,dataSource}).provider,"google")});
test("explicit enable, readiness, approved data provenance are required",()=>{assert.equal(chooseNavigation({enabled:true,dataSource:"osm"}).provider,"google");assert.equal(chooseNavigation({enabled:true,ready:true,dataSource:"osm"}).provider,"ferrostar");});
test("route session immutable; fallback asks driver and keeps trip id",()=>{const config={enabled:true,ready:true,dataSource:"synthetic",preferred:"waze"};const session=startSession({rideId:"fake-1",stage:"pickup",config});config.enabled=false;assert.equal(session.provider,"ferrostar");assert.deepEqual(requestFallback(session,"offline"),{rideId:"fake-1",stage:"pickup",provider:"waze",requiresDriverConfirmation:true,reason:"offline"});assert.ok(Object.isFrozen(session));});
test("invalid ride or phase rejected",()=>{assert.throws(()=>startSession({rideId:"",stage:"trip"}));assert.throws(()=>startSession({rideId:"fake",stage:"completed"}));});
