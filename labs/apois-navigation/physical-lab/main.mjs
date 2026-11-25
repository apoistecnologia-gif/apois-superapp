import {createDemo} from './scenario.mjs'
const status=document.getElementById('status'),bridge=globalThis.Capacitor?.Plugins?.ApoisNavigationLab,buttons=[...document.querySelectorAll('button')]
if(!bridge){status.textContent='Ponte Android indisponível.';buttons.forEach(b=>b.disabled=true)}
else {
 const demo=createDemo(bridge,{onStatus:s=>status.textContent=s})
 for(const id of ['trip','full','cancel','gps','close'])document.getElementById(id).addEventListener('click',async()=>{
  buttons.forEach(b=>b.disabled=true)
  try{if(id==='gps'){await demo.close();await bridge.physicalGps()}else if(id==='close')await demo.close();else await demo.start(id)}
  catch{status.textContent='Falha no teste. Encerre e tente novamente.'}finally{buttons.forEach(b=>b.disabled=false)}
 })
 status.textContent='Escolha um teste físico.'
}
