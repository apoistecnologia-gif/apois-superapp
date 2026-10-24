import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// APOIS_ENTREGAS_AUTO_ADDRESS_CEP_V1: somente cliente; nunca salva GPS sem confirmacao.
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
function patch(path,fn){const file=resolve(root,path),old=readFileSync(file,"utf8"),next=fn(old);if(old!==next)writeFileSync(file,next,"utf8");console.log("[OK] Entregas: "+path);}
function replace(s,a,b,msg){if(s.includes(b))return s;if(s.split(a).length!==2)throw Error("[FAIL] "+msg);return s.replace(a,b);}
patch("src/routes/inicio.tsx",s=>{
 if(s.includes("APOIS_ENTREGAS_AUTO_ADDRESS_CEP_V1"))return s;
 const original="  const firstName = profile?.full_name?.split(\" \")[0]?.toUpperCase();";
 const updated=[
  "  // APOIS_ENTREGAS_AUTO_ADDRESS_CEP_V1: endereco salvo primeiro; GPS so sem endereco.",
  "  useEffect(() => {",
  "    if(isLoading || error || defaultAddress)return;",
  "    // Só iniciar cadastro automático quando a conta realmente não possui nenhum endereço.",
  "    // Compartilha a trava com o hardener posterior para evitar duas navegações.",
  "    if(sessionStorage.getItem(\"apois_delivery_auto_address_prompted_v1\")===\"1\")return;",
  "    let cancelled=false;",
  "    void (async()=>{",
  "      const {data:{user},error:authError}=await supabase.auth.getUser();",
  "      if(authError||!user||cancelled)return;",
  "      const {count,error:countError}=await supabase.from(\"customer_addresses\").select(\"id\",{count:\"exact\",head:true}).eq(\"user_id\",user.id);",
  "      if(cancelled||countError||count!==0)return;",
  "      if(sessionStorage.getItem(\"apois_delivery_auto_address_prompted_v1\")===\"1\")return;",
  "      sessionStorage.setItem(\"apois_delivery_auto_address_prompted_v1\",\"1\");",
  "      sessionStorage.setItem(\"apois_auto_locate_new_address\",\"1\");",
  "      void navigate({to:\"/enderecos/novo\"});",
  "    })();",
  "    return ()=>{cancelled=true;};",
  "  },[isLoading,error,defaultAddress,navigate]);",
  "",original].join("\n");
 s=replace(s,original,updated,"GPS para conta sem endereco");
 s=replace(s,"\"Informe seu endereço\"","\"Definir endereço de entrega\"","rotulo do endereco");
 return s;
});
patch("src/routes/enderecos/novo.tsx",s=>{
 if(s.includes("APOIS_ENTREGAS_CEP_LOOKUP_V1"))return s;
 s=replace(s,"  const [autoLocate, setAutoLocate] = useState(false);",
  "  const [autoLocate, setAutoLocate] = useState(false);\n  const [isLookingUpCEP,setIsLookingUpCEP]=useState(false); // APOIS_ENTREGAS_CEP_LOOKUP_V1","indicador CEP");
 s=replace(s,"  const handleCEPBlur = async () => {\n    const cep = formData.postal_code.replace(/\\D/g, \"\");",
  "  const handleCEPBlur = async () => {\n    const cep = formData.postal_code.replace(/\\D/g, \"\");\n    if(cep.length>0&&cep.length!==8){toast.error(\"O CEP precisa ter 8 números.\");return;}\n    if(isLookingUpCEP)return;","validacao CEP");
 s=replace(s,"    try {\n      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);",
  "    setIsLookingUpCEP(true);\n    try {\n      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);","estado buscando CEP");
 s=replace(s,"      if (!response.ok) return;\n      const data = await response.json();\n      if (!data.erro) {",
  "      if (!response.ok) throw Error(\"cep_http\");\n      const data = await response.json();\n      if(data.erro){toast.error(\"CEP não encontrado.\");return;}\n      if (!data.erro) {","CEP inexistente");
 s=replace(s,"      console.error(\"CEP fetch error:\", error);\n    }\n  };",
  "      console.error(\"CEP fetch error:\", error);\n      toast.error(\"Não foi possível consultar o CEP.\");\n    }finally{setIsLookingUpCEP(false);}\n  };","CEP erro e final");
 const pos=s.indexOf('name="postal_code"');if(pos<0)throw Error("[FAIL] CEP campo ausente");
 const closing=s.indexOf("/>",pos);if(closing<0)throw Error("[FAIL] CEP campo incompleto");
 const button='\n          <button type="button" disabled={isLookingUpCEP} onClick={() => void handleCEPBlur()} className="mt-2 min-h-11 rounded-xl border border-[#E51B23]/30 bg-[#FFF1F2] px-4 text-sm font-bold text-[#B91C1C] disabled:opacity-50">{isLookingUpCEP?"Buscando CEP...":"Buscar pelo CEP"}</button>';
 s=s.slice(0,closing+2)+button+s.slice(closing+2);
 return s;
});
console.log("[OK] GPS com confirmacao e busca CEP preservando validacao de coordenadas.");
