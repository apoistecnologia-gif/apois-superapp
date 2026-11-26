import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,realpathSync} from 'node:fs'
import {join} from 'node:path'
const temp=realpathSync(process.env.RUNNER_TEMP),target=realpathSync(process.argv[2])
assert.equal(target,join(temp,'apois-navigation-local'))
const root=new URL('../production-contract/',import.meta.url)
const read=name=>readFileSync(new URL(name,root),'utf8')
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'local fixture anchor: '+a);return s.replace(a,()=>b)}
let fixture=read('fixture-v21.sql')
fixture=once(fixture,'create role anon nologin;\ncreate role authenticated nologin;\ncreate role service_role nologin bypassrls;','-- Supabase local already supplies these roles.')
let session=read('session-proof-fixture.sql')
session=once(session,'create schema auth;\ncreate table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);','-- Use actual local Auth session relation.')
const snapshot=new URL('../passenger-provenance-snapshot/',import.meta.url)
const contents=[fixture,readFileSync(new URL('experimental/apois-navigation/schema.sql',snapshot),'utf8'),read('observed-gates.sql'),read('create-passenger-ride-v21.sql'),readFileSync(new URL('revocation-fixture.sql',snapshot),'utf8'),...['authority-v21.sql','service-rpc-v21.sql','recovery-v21.sql','confirmation-v21.sql','catalog-v21.sql'].map(read),session,readFileSync(new URL('local-only.sql',import.meta.url),'utf8')]
writeFileSync(join(target,'fixture.sql'),contents.join('\n'),{flag:'wx'})
console.log('APOIS_LOCAL_SCHEMA_PREPARED')
