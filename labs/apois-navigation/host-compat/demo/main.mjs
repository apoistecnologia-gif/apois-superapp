import {createDemo} from "./scenario.mjs";
const status=document.getElementById("status");
const bridge=globalThis.Capacitor?.Plugins?.ApoisNavigationLab;
const buttons=[...document.querySelectorAll("button")];
if(!bridge){
 status.textContent="Ponte Android indisponível. Abra o host nativo de laboratório.";
 buttons.forEach(b=>b.disabled=true);
}else{
 const demo=createDemo(bridge,{onStatus:s=>{status.textContent=s;}});
 for(const id of ["full","cancel","trip","close"]){
  document.getElementById(id).addEventListener("click",async()=>{
   buttons.forEach(b=>b.disabled=true);
   try{if(id==="close")await demo.close();else await demo.start(id);}
   catch{status.textContent="Não foi possível executar o cenário. Encerre e tente novamente.";}
   finally{buttons.forEach(b=>b.disabled=false);}
  });
 }
 status.textContent="Escolha um cenário fictício.";
}
