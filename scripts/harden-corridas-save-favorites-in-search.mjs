// APOIS_FAVORITES_IN_DESTINATION_SEARCH_V1
// Casa/Trabalho/Outro sao salvos pelo fluxo de busca de destino ja existente.
// Sem recriar formulario, storage, pagamentos ou geocodificacao.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const work=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const homePath=resolve(work,'src/routes/_authenticated.inicio.tsx');
const searchPath=resolve(work,'src/routes/_authenticated.buscar-destino.tsx');
const replaceOne=(s,a,b,why)=>{
  const count=s.split(a).length-1;
  if(count!==1)throw Error('[FAIL] FavoritesSearch: '+why+' ('+count+')');
  return s.replace(a,b);
};
let home=readFileSync(homePath,'utf8');
if(home.includes('APOIS_COMPACT_HOME_V1')){
  if(home.includes('<HomeWorkShortcuts />'))throw Error('[FAIL] atalhos ainda renderizados na Home');
  // Função morta introduzida pelo template antigo não deve ficar no bundle.
  const start=home.indexOf('function HomeWorkShortcuts() {');
  const end=home.indexOf('\nfunction InicioPage() {',start);
  if(start>=0&&end>start){
    const removed=home.slice(start,end);
    if(!removed.includes('ADD CASA')||!removed.includes('ADD TRAMPO')){
      throw Error('[FAIL] Home shortcut antigo mudou');
    }
    home=home.slice(0,start)+home.slice(end);
    home=home.replace('import { useDestinationHistory } from "@/hooks/use-destination-history";\n','');
  }
}else throw Error('[FAIL] Nova Home compacta nao instalada');
let search=readFileSync(searchPath,'utf8');
if(!search.includes('APOIS_FAVORITES_IN_DESTINATION_SEARCH_V1')){
  if(!search.includes('data-apois-stable-destination-sheet')){
    throw Error('[FAIL] busca de destino deve manter runtime corrigido');
  }
  search=replaceOne(search,
    'const { recent, favorites, addToHistory } = useDestinationHistory();',
    'const { recent, favorites, addToHistory, addFavorite } = useDestinationHistory();',
    'acesso ao servico de salvar favoritos');
  search=replaceOne(search,
    '  const [isSelecting, setIsSelecting] = useState(false);',
    '  const [isSelecting, setIsSelecting] = useState(false);\n  // APOIS_FAVORITES_IN_DESTINATION_SEARCH_V1\n  const [saveTarget, setSaveTarget] = useState<"home" | "briefcase" | "heart" | null>(null);',
    'modo de gravacao');
  search=replaceOne(search,
    '  const handleClose = () => {\n    setIsBottomSheetOpen(false);',
    '  const handleClose = () => {\n    setSaveTarget(null);\n    setIsBottomSheetOpen(false);',
    'limpar modo ao sair');
  const helper=[
    '  // Salva o endereco validado pelo Places, sem iniciar nenhuma corrida.',
    '  const saveAddress=(details:DestinationAddress,target:"home"|"briefcase"|"heart")=>{',
    '    const name=target==="home"?"Casa":target==="briefcase"?"Trabalho":details.label;',
    '    addFavorite(details,name,target);',
    '    toast.success(target==="home"?"Casa salva.":target==="briefcase"?"Trabalho salvo.":"Local salvo nos favoritos.");',
    '    setSaveTarget(null);',
    '    clearQuery();',
    '    inputRef.current?.blur();',
    '  };',
    '  const beginSaving=(target:"home"|"briefcase"|"heart")=>{',
    '    setSaveTarget(target);',
    '    setQuery("");',
    '    inputRef.current?.focus();',
    '  };',
    ''
  ].join('\n');
  search=replaceOne(search,'  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {',
    helper+'\n  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {',
    'helpers de salvar');
  search=replaceOne(search,'      addToHistory(details);\n      handleFinalSelection(details);',
    '      if(saveTarget){saveAddress(details,saveTarget);return;}\n      addToHistory(details);\n      handleFinalSelection(details);',
    'salvar ao escolher resultado');
  search=replaceOne(search,'  const handleSelectHistoryItem = (item: DestinationAddress) => {\n    addToHistory(item);',
    '  const handleSelectHistoryItem = (item: DestinationAddress) => {\n    if(saveTarget){saveAddress(item,saveTarget);return;}\n    addToHistory(item);',
    'salvar endereco recente');
  search=replaceOne(search,'    } else {\n      toast.info(',
    '    } else {\n      beginSaving(type);\n      toast.info(',
    'Casa e Trabalho inexistentes devem entrar no modo salvar');
  search=replaceOne(search,'{homeFav ? "Casa" : "Add Casa"}',
    '{homeFav ? "Casa" : "Salvar Casa"}','nome claro Casa');
  search=replaceOne(search,'{workFav ? "Trampo" : "Add Trampo"}',
    '{workFav ? "Trabalho" : "Salvar Trabalho"}','nome claro Trabalho');
  const beforeMap=[
    '                  </div>',
    '',
    '                  <button',
    '                    onClick={() => {',
    '                      setIsBottomSheetOpen(false);'
  ].join('\n');
  const saveOther=[
    '                    <button type="button" onClick={() => beginSaving("heart")}',
    '                      className="flex min-w-[86px] flex-col items-center gap-2" aria-label="Salvar outro endereço">',
    '                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF1F2] text-[#E51B23]"><Heart size={22}/></span>',
    '                      <span className="text-[11px] font-bold text-[#444B55]">Outro local</span>',
    '                    </button>',
    '',
  ].join('\n');
  search=replaceOne(search,beforeMap,saveOther+beforeMap,'salvar outro local na tela de busca');
  const hint=[
    '          {saveTarget ? (',
    '            <div data-apois-favorite-save-mode="true" role="status" className="mx-1 mb-3 flex items-center justify-between gap-2 rounded-xl border border-[#E51B23]/25 bg-[#FFF1F2] px-3 py-2 text-sm font-semibold text-[#9F1821]">',
    '              <span>Salvar endereço como {saveTarget==="home"?"Casa":saveTarget==="briefcase"?"Trabalho":"Favorito"}. Escolha um resultado abaixo.</span>',
    '              <button type="button" onClick={() => setSaveTarget(null)} className="shrink-0 rounded-lg px-2 py-2 text-xs font-black underline">Cancelar</button>',
    '            </div>',
    '          ) : null}',
    ''
  ].join('\n');
  search=replaceOne(search,'          <div className="flex-1 mt-2">',
    hint+'          <div className="flex-1 mt-2">','aviso de modo salvar');
  if(!search.includes('addFavorite(details,name,target)')||!search.includes('data-apois-favorite-save-mode="true"')){
    throw Error('[FAIL] Favoritos: tela sem salvamento e indicacao visivel');
  }
}
writeFileSync(homePath,home,'utf8');
writeFileSync(searchPath,search,'utf8');
console.log('[OK] APOIS: Home sem grandes atalhos; Casa/Trabalho/Outro salvos na busca, com historico existente preservado.');
