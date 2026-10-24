// APOIS_CATEGORY_RECOVERY_V1 — corrige regressao "sem categorias"
// sem cadastrar categorias ficticias, sem estimativas inventadas e sem tocar
// no banco ou nas regras comerciais do servidor.
// Executar APOS harden-apois-client-red-visual e kit-visual.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const work=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const provider=resolve(work,'src/hooks/use-ride-categories.tsx');
const selector=resolve(work,'src/components/pricing/CategorySelector.tsx');
let p=readFileSync(provider,'utf8');
let s=readFileSync(selector,'utf8');
if(!p.includes('APOIS_CATEGORY_RECOVERY_V1')){
  if(!p.includes('const RideCategoriesContext = createContext')||!p.includes('categoryService.getCategories()')){
    throw Error('[FAIL] categorias: fonte do provider mudou');
  }
  p=String.raw`import React, {createContext,useCallback,useContext,useEffect,useRef,useState} from "react";
import type {RideCategory} from "@/types/pricing";
import {categoryService} from "@/services/categories/category-service";
import {useAuth} from "@/hooks/use-auth";

// APOIS_CATEGORY_RECOVERY_V1: ler SEMPRE do Supabase; manter a lista anterior
// em falha transitoria; recuperar quando voltar a internet/foreground ou login.
interface RideCategoriesContextType {
  categories:RideCategory[];
  selectedCategory:RideCategory|null;
  setSelectedCategory:(category:RideCategory|null)=>void;
  selectCategory:(category:RideCategory)=>void;
  isLoading:boolean;
  error:string|null;
  refreshCategories:()=>Promise<void>;
}
const RideCategoriesContext=createContext<RideCategoriesContextType|undefined>(undefined);
export const RideCategoriesProvider:React.FC<{children:React.ReactNode}>=({children})=>{
  const {authState}=useAuth();
  const [categories,setCategories]=useState<RideCategory[]>([]);
  const [selectedCategory,setSelectedCategory]=useState<RideCategory|null>(null);
  const [isLoading,setIsLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const requestRef=useRef(0);
  const mountedRef=useRef(true);
  const lastCompletedRef=useRef(0);
  const fetchCategories=useCallback(async()=>{
    const request=++requestRef.current;
    setIsLoading(true);
    setError(null);
    try{
      const data=await categoryService.getCategories();
      if(!mountedRef.current||request!==requestRef.current)return;
      // Nunca inventar catalogo; a fonte de verdade e ride_categories.
      if(!Array.isArray(data)||data.length===0){
        setError("Nenhuma categoria ativa foi retornada pelo servidor. Toque em Atualizar.");
        return;
      }
      setCategories(data);
      setSelectedCategory(current=>data.find(c=>c.id===current?.id&&c.isActive)??data.find(c=>c.isActive)??null);
    }catch(cause){
      if(!mountedRef.current||request!==requestRef.current)return;
      console.warn("[APOIS Categories] falha de consulta",cause instanceof Error?cause.message:"unknown");
      setError("Não foi possível carregar as categorias. Verifique a conexão e toque em Atualizar.");
    }finally{
      if(mountedRef.current&&request===requestRef.current){
        lastCompletedRef.current=Date.now();
        setIsLoading(false);
      }
    }
  },[]);

  useEffect(()=>{
    mountedRef.current=true;
    return ()=>{mountedRef.current=false;requestRef.current++;};
  },[]);

  // Corrige a corrida em que a primeira consulta ocorre antes da sessao estar pronta.
  useEffect(()=>{
    if(authState==="authenticated")void fetchCategories();
  },[authState,fetchCategories]);

  useEffect(()=>{
    const retry=()=>{
      // Evita repetir a consulta em cascata e exige que a app esteja visivel.
      if(document.visibilityState!=="visible"||Date.now()-lastCompletedRef.current<4000)return;
      void fetchCategories();
    };
    window.addEventListener("online",retry);
    document.addEventListener("visibilitychange",retry);
    return ()=>{
      window.removeEventListener("online",retry);
      document.removeEventListener("visibilitychange",retry);
    };
  },[fetchCategories]);

  const selectCategory=(category:RideCategory)=>{
    if(category.isActive&&categories.some(c=>c.id===category.id)){
      setSelectedCategory(category);
    }
  };
  return <RideCategoriesContext.Provider value={{
    categories,selectedCategory,setSelectedCategory,selectCategory,isLoading,error,
    refreshCategories:fetchCategories,
  }}>{children}</RideCategoriesContext.Provider>;
};
export const useRideCategories=()=>{
  const ctx=useContext(RideCategoriesContext);
  if(!ctx)throw Error("useRideCategories must be used within RideCategoriesProvider");
  return ctx;
};
`;
}
if(!s.includes('APOIS_CATEGORY_RECOVERY_V1')){
  const from='const { categories, selectedCategory, selectCategory, isLoading: categoriesLoading } = useRideCategories();';
  const to='const { categories, selectedCategory, selectCategory, isLoading: categoriesLoading, error: categoriesError, refreshCategories } = useRideCategories(); // APOIS_CATEGORY_RECOVERY_V1';
  if(s.split(from).length!==2)throw Error('[FAIL] categorias: hook do seletor mudou');
  s=s.replace(from,to);
  const oldEmpty=`if (categories.length === 0) {
    return <div className="rounded-2xl bg-[#F7F7F8] px-4 py-5 text-center text-sm text-[#666B73]">Não há categorias disponíveis para esta rota no momento.</div>;
  }`;
  const newEmpty=String.raw`if (categories.length === 0) {
    return <div role="alert" data-apois-categories-retry="true" className="rounded-2xl border border-[#F3D1D4] bg-white px-4 py-5 text-center text-sm text-[#515965]">
      <p>{categoriesError || "Nenhuma categoria foi retornada. Atualize para consultar novamente."}</p>
      <button type="button" onClick={() => void refreshCategories()} disabled={categoriesLoading}
        className="mt-3 min-h-11 rounded-xl bg-[#E51B23] px-5 text-sm font-extrabold text-white disabled:opacity-50">
        Atualizar categorias
      </button>
    </div>;
  }`;
  if(s.split(oldEmpty).length!==2)throw Error('[FAIL] categorias: tela vazia mudou');
  s=s.replace(oldEmpty,newEmpty);
  const wrapper='<div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-hide scroll-smooth">';
  if(s.split(wrapper).length!==2)throw Error('[FAIL] categorias: container original nao localizado');
  s=s.replace(wrapper,`<>
      {categoriesError ? (
        <div role="alert" className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#F3D1D4] bg-white p-2 text-xs text-[#A21D26]">
          <span>{categoriesError}</span><button type="button" onClick={() => void refreshCategories()} className="shrink-0 font-black underline">Atualizar</button>
        </div>
      ) : null}
      `+wrapper);
  const last=`    </div>
  );
};`;
  if(s.split(last).length!==2)throw Error('[FAIL] categorias: retorno final do seletor alterado');
  s=s.replace(last,`    </div>
    </>
  );
};`);
}
for(const [src,token] of [[p,'APOIS_CATEGORY_RECOVERY_V1'],[p,'refreshCategories:fetchCategories'],[s,'data-apois-categories-retry="true"'],[s,'validated-sprite-v6']]){
  if(!src.includes(token))throw Error('[FAIL] categorias: '+token);
}
writeFileSync(provider,p,'utf8');
writeFileSync(selector,s,'utf8');
console.log('[OK] Categoria: Supabase fonte de verdade; retry; lista persistente; sprite de carro/moto/frete/guincho/envios.');
