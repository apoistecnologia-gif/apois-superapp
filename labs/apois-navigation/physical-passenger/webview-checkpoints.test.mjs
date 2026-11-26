import test from 'node:test'
import assert from 'node:assert/strict'
import {runInNewContext} from 'node:vm'
import {textCheckpoint,exactElementTextCheckpoint} from './webview-checkpoints.mjs'
test('checkpoint waits for an HTML body without suppressing actual script errors',()=>{
 const expression=textCheckpoint('Mapa local verificado.')
 for(const document of [{body:null},{body:undefined},{body:{}},{body:{innerText:'Verificando mapa'}}]){
  assert.equal(runInNewContext(expression,{document}),false)
 }
 assert.equal(runInNewContext(expression,{document:{body:{innerText:'Mapa local verificado. Escolha os pontos'}}}),true)
})
test('checkpoint text is encoded as data, not executable JavaScript',()=>{
 const input='a"\\b\n); throw Error("unexpected")'
 assert.equal(runInNewContext(textCheckpoint(input),{document:{body:{innerText:input}}}),true)
})

test('counter requires exact value from the intended element',()=>{
 const expression=exactElementTextCheckpoint('count','Criações simuladas neste aparelho: 1')
 for(const value of [null,'Criações simuladas neste aparelho: 10','Criações simuladas neste aparelho: 0','Criações simuladas: —'])assert.equal(runInNewContext(expression,{document:{getElementById:()=>value===null?null:{textContent:value}}}),false)
 assert.equal(runInNewContext(expression,{document:{getElementById:id=>id==='count'?{textContent:'Criações simuladas neste aparelho: 1'}:null}}),true)
})
