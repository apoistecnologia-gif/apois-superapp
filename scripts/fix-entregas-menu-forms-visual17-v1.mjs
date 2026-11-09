// APOIS RV-17 — only generated Entregas workspaces; never modify source snapshots.
// Preserve product pricing semantics (explicit 0), CRUD, uploads, support and review RPCs.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const EDITOR_MARK="APOIS_CV17_PRODUCT_EDITOR_V1";
export const REVIEW_MARK="APOIS_CV17_REVIEW_LABELS_V1";
export const HELP_MARK="APOIS_CV17_HELP_REQUIREMENTS_V1";
function once(source,needle,replacement,label){
  const count=source.split(needle).length-1;
  if(count!==1)throw Error("[RV17] "+label+" anchor count="+count);
  return source.replace(needle,replacement);
}
function check(source,markers,label){
  for(const m of markers)if(!source.includes(m))throw Error("[RV17] "+label+" missing "+m);
  return source;
}
export function patchEditor(source){
  const must=[EDITOR_MARK,'if (!draft.price.trim())','const price = Number(draft.price);',
    'Salvar dados do produto','setOptionsError("groups")','setOptionsError("options")',
    'aria-modal="true"','max-h-[94dvh]','min-h-11 min-w-11',
    'uploadImage(file)','from("product_option_groups")','from("product_options")',
    'A imagem é gravada após o envio','Grupos e opções são gravados separadamente'];
  if(source.includes(EDITOR_MARK))return check(source,must,"editor already patched");
  check(source,['const saveProduct = async () => {','const price = Number(draft.price);',
    'const [loadingOptions, setLoadingOptions] = useState(false);',
    'onClick={saveProduct}','Salvar produto','max-h-[94dvh]',
    'if (groupRes.error) {','if (optionRes.error) {','from("product_options")'],
    "pinned editor");
  let s=once(source,'export function MerchantProductEditor(',
    '// '+EDITOR_MARK+'\n'+
    'function editorFailure(error: unknown, fallback: string): string {\n'+
    '  console.error("[APOIS] Falha na edição do cardápio:", error);\n'+
    '  const detail = error && typeof error === "object" ? error as {status?: number; code?: string; message?: string} : {};\n'+
    '  const info = String(detail.code ?? "") + " " + String(detail.message ?? "");\n'+
    '  if (detail.status === 429 || /rate.?limit|too.many.requests/i.test(info)) return "Muitas tentativas. Aguarde um pouco e tente novamente.";\n'+
    '  if (/failed.to.fetch|network|connection|timeout/i.test(info)) return "Não foi possível conectar ao servidor. Confira a internet e tente novamente.";\n'+
    '  return fallback;\n'+
    '}\n\nexport function MerchantProductEditor(',
    "diagnostic-only error classifier");
  s=once(s,'  const [loadingOptions, setLoadingOptions] = useState(false);',
    '  const [loadingOptions, setLoadingOptions] = useState(false);\n'+
    '  const [optionsError,setOptionsError] = useState<"groups" | "options" | null>(null);',
    "option error state");
  s=once(s,'    setLoadingOptions(true);',
    '    setLoadingOptions(true);\n    setOptionsError(null);',"refresh resets feedback");
  s=once(s,'      toast.error("Não foi possível carregar os adicionais deste produto.");',
    '      setOptionsError("groups");\n      toast.error("Não foi possível carregar os adicionais deste produto.");',
    "group loading error");
  s=once(s,'      toast.error("Não foi possível carregar as opções deste produto.");',
    '      setOptionsError("options");\n      toast.error("Não foi possível carregar as opções deste produto.");',
    "option loading error");
  s=once(s,'    const price = Number(draft.price);',
    '    if (!draft.price.trim()) return toast.error("Informe o preço do produto.");\n    const price = Number(draft.price);',
    "blank not monetary zero");
  s=once(s,'if (error) return toast.error(error.message || "Não foi possível salvar o produto.");',
    'if (error) return toast.error(editorFailure(error,"Não foi possível salvar os dados do produto."));',
    "product update error");
  s=once(s,'toast.error(error?.message || "Não foi possível enviar a imagem.");',
    'toast.error(editorFailure(error,"Não foi possível enviar a imagem."));',"image upload error");
  s=once(s,'if (error) return toast.error(error.message || "Não foi possível criar o grupo.");',
    'if (error) return toast.error(editorFailure(error,"Não foi possível criar o grupo."));',
    "group creation error");
  const raw='toast.error(error.message)';
  const count=s.split(raw).length-1;
  if(count!==7)throw Error("[RV17] additional action raw error occurrences="+count);
  s=s.split(raw).join('toast.error(editorFailure(error,"Não foi possível concluir esta alteração nos adicionais."))');
  s=once(s,'className="max-h-[94dvh] w-full overflow-y-auto',
    'role="dialog" aria-modal="true" aria-labelledby="apois-product-editor-title" className="max-h-[94dvh] w-full overflow-y-auto',
    "editor dialog semantic");
  s=once(s,'<h2 className="text-xl font-black">Editar cardápio</h2>',
    '<h2 id="apois-product-editor-title" className="text-xl font-black">Editar cardápio</h2>',
    "editor dialog title");
  s=once(s,'className="rounded-full bg-zinc-900 p-2 text-zinc-300"',
    'className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-zinc-900 p-2 text-zinc-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"',
    "close target");
  s=once(s,'{money(Number(draft.price) || 0)}',
    '{draft.price.trim() ? money(Number(draft.price) || 0) : "Preço não informado"}',
    "editor preview empty value");
  s=once(s,'                </label>\n              </section>\n\n              <section className="space-y-3',
    '                </label>\n                <p className="text-sm leading-relaxed text-zinc-300">A imagem é gravada após o envio concluído, sem depender de Salvar dados do produto.</p>\n              </section>\n\n              <section className="space-y-3',
    "image persistence explanation");
  s=once(s,'                <h3 className="font-black">Dados do produto</h3>',
    '                <h3 className="font-black">Dados do produto</h3>\n'+
    '                <p className="text-sm leading-relaxed text-zinc-300">Nome, descrição, preço e categoria são gravados ao tocar em Salvar dados do produto. Imagem e adicionais usam ações próprias.</p>',
    "product persistence scope");
  s=once(s,'                      step="0.01"\n                      value={draft.price}',
    '                      step="0.01"\n                      required\n                      aria-required="true"\n                      aria-describedby="apois-product-price-help"\n                      value={draft.price}',
    "required price field");
  s=once(s,'                    />\n                  </label>\n                  <label className="block text-xs font-bold text-zinc-500">\n                    Categoria',
    '                    />\n                    <span id="apois-product-price-help" className="mt-1 block text-xs leading-relaxed text-zinc-300">Informe um preço. O valor 0 precisa ser digitado explicitamente.</span>\n                  </label>\n                  <label className="block text-xs font-bold text-zinc-500">\n                    Categoria',
    "price helper");
  s=once(s,'                  Salvar produto\n                </Button>',
    '                  Salvar dados do produto\n                </Button>',
    "save scope caption");
  s=once(s,'                     Configure escolhas obrigatórias, extras e acréscimos de preço.',
    '                     Configure escolhas obrigatórias, extras e acréscimos de preço.',
    "option instruction invariant");
  s=once(s,'              {loadingOptions ? (\n',
    '              <p className="mt-2 text-sm leading-relaxed text-zinc-300">Grupos e opções são gravados separadamente após cada ação concluída. Fechar esta janela não desfaz alterações já salvas.</p>\n'+
    '              {loadingOptions ? (\n',
    "option persistence scope");
  s=once(s,'              ) : (\n                <div className="mt-4 space-y-4">',
    '              ) : optionsError ? (\n'+
    '                <div role="alert" className="mt-4 space-y-3 rounded-xl border border-amber-500/40 p-4 text-sm text-amber-200">\n'+
    '                  <p>{optionsError === "groups" ? "Falha ao consultar os grupos de adicionais. A lista não foi confirmada como vazia." : "Falha ao consultar as opções. Não recrie os itens antes de atualizar a consulta."}</p>\n'+
    '                  <button type="button" className="min-h-11 rounded-lg border border-amber-500/40 px-4 font-bold" onClick={() => void loadOptions()}>Tentar novamente</button>\n'+
    '                </div>\n'+
    '              ) : (\n                <div className="mt-4 space-y-4">',
    "persistent load failure, not empty");
  return check(s,must,"editor updated");
}
export function patchReview(source){
  const must=[REVIEW_MARK,'aria-label={ratingLabel}','ratingLabel="Nota do estabelecimento',
    'ratingLabel="Nota da entrega','aria-labelledby="apois-review-comment-label"',
    'role="radio"','aria-checked={value === star}','submit_order_review'];
  if(source.includes(REVIEW_MARK))return check(source,must,"review already patched");
  check(source,['aria-label="Nota de 1 a 5 estrelas"','role="radio"',
    'onChange={setMerchantRating}','onChange={setDeliveryRating}',
    '<textarea','submit_order_review'],"pinned review");
  let s=once(source,'  const StarRating = ({',
    '  // '+REVIEW_MARK+'\n  const StarRating = ({',
    "review marker");
  s=once(s,'    disabled = false,\n  }: {\n    value: number;',
    '    disabled = false,\n    ratingLabel,\n  }: {\n    value: number;',
    "review context param");
  s=once(s,'    disabled?: boolean;\n  }) => (',
    '    disabled?: boolean;\n    ratingLabel: string;\n  }) => (',
    "review context type");
  s=once(s,'role="radiogroup" aria-label="Nota de 1 a 5 estrelas"',
    'role="radiogroup" aria-label={ratingLabel}',
    "distinct group names");
  s=once(s,'onChange={setMerchantRating}',
    'onChange={setMerchantRating}\n              ratingLabel="Nota do estabelecimento, de 1 a 5 estrelas"',
    "merchant rating name");
  s=once(s,'onChange={setDeliveryRating}',
    'onChange={setDeliveryRating}\n                ratingLabel="Nota da entrega, de 1 a 5 estrelas"',
    "delivery rating name");
  s=once(s,'              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">\n                Comentário opcional',
    '              <h3 id="apois-review-comment-label" className="text-sm font-bold uppercase tracking-wider text-zinc-500">\n                Comentário opcional',
    "comment label id");
  s=once(s,'            <textarea\n              value={comment}',
    '            <textarea\n              aria-labelledby="apois-review-comment-label"\n              value={comment}',
    "comment text area association");
  return check(s,must,"review updated");
}
export function patchHelp(source){
  const must=[HELP_MARK,'role="dialog" aria-modal="true"','aria-labelledby="apois-help-form-title"',
    'id="apois-help-requirements"','aria-describedby="apois-help-requirements"',
    'max-h-[calc(100dvh-1rem)]','subject.trim().length < 3',
    'description.trim().length < 10','customer-support'];
  if(source.includes(HELP_MARK))return check(source,must,"help already patched");
  check(source,['onClick={() => void createTicket()}',
    'disabled={submitting || subject.trim().length < 3 || description.trim().length < 10}',
    'aria-label="Fechar formulário"','const [isFormOpen, setIsFormOpen] = useState(false);'],
    "pinned help");
  let s=once(source,'<div className="w-full rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 sm:max-w-lg sm:rounded-3xl">',
    '<div role="dialog" aria-modal="true" aria-labelledby="apois-help-form-title" className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 sm:max-w-lg sm:rounded-3xl">',
    "help dialog scroll and accessible region");
  s=once(s,'<h2 className="mt-1 text-lg font-black">{categoryLabels[category]}</h2>',
    '<h2 id="apois-help-form-title" className="mt-1 text-lg font-black">{categoryLabels[category]}</h2>',
    "help heading");
  s=once(s,'className="rounded-full bg-zinc-900 p-2"',
    'className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-zinc-900 p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"',
    "help close target");
  s=once(s,'            <button\n              type="button"\n              onClick={() => void createTicket()}',
    '            {/* '+HELP_MARK+' */}\n'+
    '            <p id="apois-help-requirements" className="mt-3 text-sm leading-relaxed text-zinc-300">Para abrir um chamado: assunto com pelo menos 3 caracteres e descrição com pelo menos 10. {subject.trim().length < 3 ? "Faltam " + (3 - subject.trim().length) + " caracteres no assunto. " : ""}{description.trim().length < 10 ? "Faltam " + (10 - description.trim().length) + " caracteres na descrição." : ""}</p>\n'+
    '            <button\n              type="button"\n              aria-describedby="apois-help-requirements"\n              onClick={() => void createTicket()}',
    "support disabled explanations");
  return check(s,must,"help updated");
}
export function applyVisual17(root=process.cwd()){
  const base=resolve(root,process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
  const changes=[
    ["src/components/MerchantProductEditor.tsx",patchEditor],
    ["src/routes/pedido/$orderId/avaliar.tsx",patchReview],
    ["src/routes/perfil/ajuda.tsx",patchHelp]
  ];
  // Plan and validate all transformations before any write.
  const plans=changes.map(([rel,patch])=>{
    const path=resolve(base,rel),before=readFileSync(path,"utf8"),after=patch(before);
    if(patch(after)!==after)throw Error("[RV17] non-idempotent "+rel);
    return {rel,path,before,after};
  });
  for(const plan of plans)if(plan.before!==plan.after)writeFileSync(plan.path,plan.after,"utf8");
  return plans.map(p=>({file:p.rel,changed:p.before!==p.after}));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))
  console.log("[OK] RV17 forms",JSON.stringify(applyVisual17()));
