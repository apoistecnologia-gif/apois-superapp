import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
const root = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const read = p => readFileSync(`${root}/src/${p}`, 'utf8');
const helper = read('lib/brazil-uf.ts').replace('export function', 'function');
function slice(source, begin, end) {
  const a = source.indexOf(begin), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, begin); return source.slice(a, b);
}
for (const [name,path,param,end] of [
  ['create','routes/enderecos/novo.tsx','address','  const handleCEPBlur ='],
  ['edit','routes/enderecos/editar/$addressId.tsx','addr','  const handleSubmit ='],
]) {
  const s = read(path);
  const fields = slice(s, 'const locationFields =', '\n\nfunction ');
  const change = slice(s, '  const handleChange =', end);
  const marker = `onAddressSelected={(${param}) => {`, a = s.indexOf(marker), b = s.indexOf('\n            }}', a);
  assert.ok(a >= 0 && b > a);
  const selected = s.slice(a + 'onAddressSelected={'.length,b) + '\n}';
  function harness(address = {}) {
    const c = vm.createContext({
      state: { label:'Casa',street:'',number:'',complement:'',neighborhood:'',city:'',state:'',postal_code:'',latitude:null,longitude:null },
      confirmedUfRef:{current:''}, cepRequestRef:{current:0}, missingLocationFieldsRef:{current:new Set()},
    });
    c.setFormData = update => c.state = update(c.state);
    vm.runInContext(stripTypeScriptTypes(helper+'\n'+fields+'\n'+change+'\nthis.select = '+selected+';\nthis.change = handleChange;'),c);
    c.select({street:'',number:'',neighborhood:'',city:'',state:'',postal_code:'',latitude:-9.4,longitude:-40.5,...address});
    return c;
  }
  for (const [field,value] of [['street','Rua das Flores'],['neighborhood','Centro'],['city','Petrolina'],['postal_code','56300000'],['state','PE']]) {
    test(`${name}: completing missing ${field} character by character retains GPS`, () => {
      const c=harness();
      for(let i=1;i<=value.length;i++) {
        c.change({target:{name:field,value:value.slice(0,i)}});
        assert.equal(c.state.latitude,-9.4,`${field}: ${i}`);assert.equal(c.state.longitude,-40.5);
      }
    });
  }
  test(`${name}: editing an identified city still clears GPS`, () => {
    const c=harness({city:'Petrolina',state:'PE'});
    c.change({target:{name:'city',value:'Juazeiro'}});
    assert.equal(c.state.latitude,null);assert.equal(c.state.longitude,null);
  });
  test(`${name}: selecting a complete address resets missing-field history`, () => {
    const c=harness();
    c.select({street:'Rua atual',number:'123',neighborhood:'Centro',city:'Petrolina',state:'PE',postal_code:'56300000',latitude:-9.4,longitude:-40.5});
    c.change({target:{name:'street',value:'Rua diferente'}});
    assert.equal(c.state.latitude,null);
  });
}
