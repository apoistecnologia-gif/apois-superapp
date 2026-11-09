// RV11 CV-031 form associations only: preserve values, names, validation and handlers.
import { readFileSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const FIELD_MARK="APOIS_CV11_FIELD_ASSOCIATIONS_V1";
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error("[CV11 fields] "+label+" "+n);return s.replace(a,b)}
function marked(s,marker,needs){if(!s.includes(marker))return false;for(const x of needs)if(!s.includes(x))throw Error("[CV11 fields] partial "+x);return true}
export function patchNew(s){
 if(marked(s,"APOIS_CV11_NEW_FIELDS_V1",["htmlFor={fieldId}","id={fieldId}"]))return s;
 s=once(s,'function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {\n  return (',
 'function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {\n  // APOIS_CV11_NEW_FIELDS_V1\n  const fieldId = "apois-address-new-" + String(props.name);\n  return (',"field helper");
 s=once(s,'<label className="ml-1 text-xs font-medium text-zinc-500">{label}</label>\n      <Input {...props} className="h-12 rounded-xl border-zinc-800 bg-zinc-900 text-white" />',
 '<label htmlFor={fieldId} className="ml-1 text-xs font-medium text-zinc-500">{label}</label>\n      <Input {...props} id={fieldId} className="h-12 rounded-xl border-zinc-800 bg-zinc-900 text-white" />',"new control");
 return s;
}
export function patchEdit(s){
 if(marked(s,"APOIS_CV11_EDIT_FIELDS_V1",['htmlFor="apois-address-edit-postal_code"','id="apois-address-edit-reference"']))return s;
 for(const name of ["postal_code","street","number","complement","neighborhood","city","state","reference"]){
  const token='name="'+name+'"';
  const pos=s.indexOf(token);
  if(pos<0||s.indexOf(token,pos+1)>=0)throw Error("[CV11 fields] duplicate or missing edit field "+name);
  const input=s.lastIndexOf("<Input",pos),labelStart=s.lastIndexOf("<label ",input),labelEnd=s.indexOf("</label>",labelStart);
  if(labelStart<0||input<0||labelEnd<labelStart||labelEnd>input||input-labelEnd>250)throw Error("[CV11 fields] edit label relation "+name);
  const old=s.slice(labelStart,labelEnd+8),id="apois-address-edit-"+name;
  if(old.includes("htmlFor="))throw Error("[CV11 fields] edit already annotated "+name);
  s=s.slice(0,labelStart)+old.replace("<label ","<label htmlFor=\""+id+"\" ")+s.slice(labelEnd+8);
  const updatedInput=s.indexOf("<Input",labelStart);
  s=s.slice(0,updatedInput)+s.slice(updatedInput).replace("<Input\n","<Input\n                id=\""+id+"\"\n");
 }
 s=once(s,'htmlFor="apois-address-edit-postal_code"','htmlFor="apois-address-edit-postal_code" data-apois-cv11="APOIS_CV11_EDIT_FIELDS_V1"',"edit marker");
 return s;
}
export function patchRegister(s){
 if(marked(s,"APOIS_CV11_REGISTER_FIELDS_V1",["htmlFor={id}","aria-describedby={","apois-register-confirmPassword"]))return s;
 const fields=[["Nome completo","fullName"],["Telefone celular","phone"],["CPF","cpf"],
  ["Data de nascimento","birthDate"],["E-mail","email"],["Senha","password"],["Confirme a senha","confirmPassword"]];
 for(const [label,key] of fields){
  const old='<Field label="'+label+'" error={fieldError("'+key+'")}>';
  const id="apois-register-"+key;
  const next='<Field label="'+label+'" id="'+id+'" error={fieldError("'+key+'")}>';
  s=once(s,old,next,"register "+key);
  const start=s.indexOf(next),firstInput=s.indexOf("<Input",start),end=s.indexOf("</Field>",start);
  if(firstInput<0||firstInput>end)throw Error("[CV11 fields] register "+key+" input missing");
  const insert='<Input id="'+id+'" aria-invalid={Boolean(fieldError("'+key+'"))} aria-describedby={fieldError("'+key+'") ? "'+id+'-error" : undefined}';
  s=s.slice(0,firstInput)+s.slice(firstInput).replace("<Input",insert);
 }
 s=once(s,'  label,\n  error,\n  children,\n}: {\n  label: string;\n  error?: string | undefined;',
  '  label,\n  id,\n  error,\n  children,\n}: {\n  label: string;\n  id: string;\n  error?: string | undefined;',"register helper props");
 s=once(s,'<label className="ml-1 text-[11px] font-medium text-zinc-400">{label}</label>',
  '<label htmlFor={id} data-apois-cv11="APOIS_CV11_REGISTER_FIELDS_V1" className="ml-1 text-[11px] font-medium text-zinc-400">{label}</label>',
  "register label");
 s=once(s,'{error ? <p className="ml-1 text-[10px] text-red-500">{error}</p> : null}',
  '{error ? <p id={id + "-error"} className="ml-1 text-[10px] text-red-500">{error}</p> : null}',
  "register error");
 return s;
}
export function patchProfile(s){
 if(marked(s,"APOIS_CV11_PROFILE_FIELDS_V1",["htmlFor={fieldId}",'id="apois-profile-email"']))return s;
 for(const [label,name] of [["Nome completo","full_name"],["Telefone","phone"],["CPF","cpf"],["Data de nascimento","birth_date"],["E-mail","email"]]){
  const before='<Field label="'+label+'"';
  const after=before+' id="apois-profile-'+name+'"';
  s=once(s,before,after,"profile "+name);
  const from=s.indexOf(after),input=s.indexOf("<input",from),end=s.indexOf("</Field>",from);
  if(input<0||input>end)throw Error("[CV11 fields] profile input "+name);
  s=s.slice(0,input)+s.slice(input).replace("<input",'<input id="apois-profile-'+name+'"');
 }
 s=once(s,'  label,\n  icon: Icon,\n  children,\n}: {\n  label: string;',
  '  label,\n  id: fieldId,\n  icon: Icon,\n  children,\n}: {\n  label: string;\n  id: string;',"profile props");
 s=once(s,'<label className="ml-1 text-xs font-bold uppercase tracking-widest text-primary">',
  '<label htmlFor={fieldId} data-apois-cv11="APOIS_CV11_PROFILE_FIELDS_V1" className="ml-1 text-xs font-bold uppercase tracking-widest text-primary">',
  "profile label");
 return s;
}
const patches=[
 ["src/routes/enderecos/novo.tsx",patchNew],
 ["src/routes/enderecos/editar/$addressId.tsx",patchEdit],
 ["src/routes/register.tsx",patchRegister],
 ["src/routes/perfil/dados-pessoais.tsx",patchProfile],
];
export function applyVisual11Fields(root=process.cwd()){
 const work=resolve(root,process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
 const plans=patches.map(([relative,fn])=>{
  const path=resolve(work,relative),old=readFileSync(path,"utf8");return {path,relative,old,next:fn(old)};
 });
 for(const plan of plans)if(plan.next!==plan.old)writeFileSync(plan.path,plan.next,"utf8");
 return plans.filter(x=>x.old!==x.next).map(x=>x.relative);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))
 console.log("[OK] RV11 label associations",applyVisual11Fields().join(",")||"already patched");
