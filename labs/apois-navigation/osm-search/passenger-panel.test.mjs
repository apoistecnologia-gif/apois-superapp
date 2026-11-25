import test from 'node:test'
import assert from 'node:assert/strict'
import {createPassengerPanel} from './passenger-panel.mjs'
import {mountPassengerPanel} from './passenger-panel-view.mjs'
const ids = [1,2,3,4,5].map(i=>'00000000-0000-4000-8000-00000000000'+i)
const digest='a'.repeat(64), t=Date.parse('2026-11-25T15:00:00Z')
const shared={version:1,extract_sha256:digest,active:true,lng:-40.5}
const catalog={source:'OSM_PBF',version:1,extract_sha256:digest,rows:[
 {...shared,id:ids[0],lat:-9.4,label:'Praça A'},
 {...shared,id:ids[1],lat:-9.41,label:'Rua B, 12'},
 {...shared,id:ids[4],lat:-9.42,label:'Inativo',active:false}
]}
const response={selectionId:ids[3],requestKey:ids[2],expiresAt:new Date(t+1000).toISOString(),origin:{lat:-9.4,lng:-40.5,label:'Praça A'},destination:{lat:-9.41,lng:-40.5,label:'Rua B, 12'}}
const setup=(extra={})=>createPassengerPanel({enabled:true,catalog,newKey:()=>ids[2],now:()=>t,confirm:async()=>response,...extra})
function select(p){assert.equal(p.open(),true);p.suggestTap({lat:-9.4001,lng:-40.5});assert.equal(p.state().pickup,null);assert.equal(p.acceptSuggestion(),true);p.focus('destination');assert.equal(p.selectSearch('rua b 12',ids[1]),true)}
test('disabled is default and does not mount or read catalog',()=>{assert.equal(createPassengerPanel().open(),false);assert.equal(mountPassengerPanel(null),null)})
test('map tap only suggests, search is independent, explicit confirmation expires',async()=>{let time=t;let calls=0;const p=setup({now:()=>time,confirm:async()=>{calls++;return response}});select(p);assert.equal(calls,0);assert.equal(p.confirmedInput(),null);assert.deepEqual(await p.confirm(),response);assert.equal(calls,1);time+=1000;assert.equal(p.confirmedInput(),null);assert.equal(p.state().phase,'expired')})
test('cancel or edit invalidates even a transport that ignores abort',async()=>{let finish,signal;const p=setup({confirm:(_,s)=>{signal=s;return new Promise(r=>finish=r)}});select(p);const work=p.confirm();p.close();assert.equal(signal.aborted,true);finish(response);assert.equal(await work,null);assert.equal(p.confirmedInput(),null);assert.equal(p.state().phase,'closed')})
test('mismatching server points and unavailable confirmation fail closed',async()=>{const p=setup({confirm:async()=>({...response,origin:{...response.origin,lat:-9.43}})});select(p);assert.equal(await p.confirm(),null);assert.equal(p.state().phase,'error');assert.equal(p.confirmedInput(),null);p.close();assert.equal(p.state().pickup,null)})
test('inactive and far map locations cannot be selected; repeated confirmation blocked',async()=>{const p=setup();select(p);assert.equal(p.selectSearch('inativo',ids[4]),false);assert.equal(p.suggestTap({lat:-9.5,lng:-40.5}),null);assert.ok(await p.confirm());assert.equal(await p.confirm(),null)})
