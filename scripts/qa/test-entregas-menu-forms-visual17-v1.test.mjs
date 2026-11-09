import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {test} from "node:test";
import {patchEditor,patchReview,patchHelp,EDITOR_MARK,REVIEW_MARK,HELP_MARK}
  from "../fix-entregas-menu-forms-visual17-v1.mjs";

const root=resolve(import.meta.dirname,"../..");
const work=resolve(root,process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const read=rel=>readFileSync(resolve(work,rel),"utf8");
const repo=rel=>readFileSync(resolve(root,rel),"utf8");
const editor=()=>read("src/components/MerchantProductEditor.tsx");
const review=()=>read("src/routes/pedido/$orderId/avaliar.tsx");
const help=()=>read("src/routes/perfil/ajuda.tsx");

async function exerciseProductSave(priceValue,name="Produto de teste"){
  const source=editor(),start=source.indexOf("  const saveProduct = async () => {");
  const end=source.indexOf("  const uploadImage = async (file: File) => {",start);
  assert.ok(start>=0&&end>start,"save handler boundaries must be unchanged");
  const body=source.slice(start,end);
  assert.match(body,/if \(!draft\.price\.trim\(\)\) return toast\.error\(/);
  const updates=[],alerts=[],successes=[],busy=[],changed=[];
  const api={
    update(payload){
      updates.push(payload);
      return {eq(){return {eq(){return Promise.resolve({error:null});}}}};
    },
  };
  const save=new Function("draft","from","setBusy","toast","product","merchantId",
    "onChanged","editorFailure",body+"\nreturn saveProduct;")(
    {name,price:priceValue,description:"",categoryId:""},
    table=>{assert.equal(table,"products");return api;},
    state=>busy.push(state),
    {error:message=>alerts.push(message),success:message=>successes.push(message)},
    {id:"fixture-product"},"fixture-merchant",
    async()=>{changed.push(true);},
    (err,fall)=>fall
  );
  await save();
  return {updates,alerts,successes,busy,changed};
}

test("CV-058 / VIS-059: empty/whitespace is not silently converted to free",async()=>{
  for(const raw of [""," ","   "]){
    const run=await exerciseProductSave(raw);
    assert.equal(run.updates.length,0,"blank price must not reach update");
    assert.match(run.alerts[0],/Informe o preço do produto/);
    assert.equal(run.changed.length,0,"onChanged must not fire");
  }
  const source=editor();
  assert.ok(source.indexOf("if (!draft.price.trim())") < source.indexOf("const price = Number(draft.price);"));
  assert.ok(source.includes('step="0.01"'));
  assert.ok(source.includes('min="0"'));
  assert.ok(source.includes('aria-describedby="apois-product-price-help"'));
  assert.ok(source.includes('"Preço não informado"'));
});

test("CV-058 / VIS-059: explicit zero/decimal permitted, negatives and invalid blocked",async()=>{
  for(const [raw,expected] of [["0",0],["0.01",0.01],["19.90",19.9]]){
    const run=await exerciseProductSave(raw);
    assert.equal(run.updates.length,1,raw);
    assert.equal(run.updates[0].price,expected);
    assert.equal(run.successes.length,1);
    assert.equal(run.changed.length,1);
  }
  for(const raw of ["-1","abc"]){
    const run=await exerciseProductSave(raw);
    assert.equal(run.updates.length,0);
    assert.match(run.alerts[0],/Informe um preço válido/);
  }
  const badName=await exerciseProductSave("10"," ");
  assert.equal(badName.updates.length,0,"name validation preserved");
});

test("CV-059 / VIS-060: basic fields, image and options remain separate saved actions",()=>{
  const s=editor();
  assert.ok(s.includes(EDITOR_MARK));
  assert.equal(patchEditor(s),s,"idempotent");
  for(const token of [
    "Salvar dados do produto","A imagem é gravada após o envio",
    "Grupos e opções são gravados separadamente","Fechar esta janela não desfaz alterações",
    'from("products")','from("product_option_groups")','from("product_options")',
    'supabase.storage.from("product-images").upload','onClick={saveProduct}',
    'onClick={() => setOpen(false)}','await onChanged()'
  ])assert.ok(s.includes(token),token);
  assert.ok(s.includes('APOIS_MERCHANT_PRODUCT_IMAGE_RECONCILIATION_V1'),
    "do not remove the prior reconciled-image flow");
  assert.ok(s.includes('APOIS_CV12_PRODUCT_IMAGE_KEYBOARD_V1'),
    "do not regress accessible image input");
});

test("VIS-027 / VIS-055: failed extras are not shown as verified empty; raw errors hidden",()=>{
  const s=editor();
  for(const token of [
    'setOptionsError(null);','setOptionsError("groups")','setOptionsError("options")',
    'optionsError ? (','role="alert"',
    'onClick={() => void loadOptions()}','A lista não foi confirmada como vazia',
    'editorFailure(error,','console.error("[APOIS] Falha na edição do cardápio:"'
  ])assert.ok(s.includes(token),token);
  assert.equal((s.match(/toast\.error\(error\.message\)/g)||[]).length,0);
  assert.ok(!s.includes('toast.error(error?.message'));
});

test("VIS-032: two rating groups have distinct accessible subjects; comment is associated",()=>{
  const s=review();
  assert.ok(s.includes(REVIEW_MARK));
  assert.equal(patchReview(s),s);
  assert.ok(s.includes('aria-label={ratingLabel}'));
  assert.ok(s.includes('ratingLabel="Nota do estabelecimento, de 1 a 5 estrelas"'));
  assert.ok(s.includes('ratingLabel="Nota da entrega, de 1 a 5 estrelas"'));
  assert.ok(s.includes('id="apois-review-comment-label"'));
  assert.ok(s.includes('aria-labelledby="apois-review-comment-label"'));
  for(const token of [
    'role="radiogroup"','role="radio"','aria-checked={value === star}',
    'onClick={() => onChange(star)}','supabase as any',
    '"submit_order_review"','alreadyReviewed'
  ])assert.ok(s.includes(token),token);
});

test("VIS-049 / VIS-028: help form exposes 3/10 rules, and dialog has bounds",()=>{
  const s=help();
  assert.ok(s.includes(HELP_MARK));
  assert.equal(patchHelp(s),s);
  assert.ok(s.includes('max-h-[calc(100dvh-1rem)]'));
  assert.ok(s.includes('role="dialog" aria-modal="true"'));
  assert.ok(s.includes('aria-labelledby="apois-help-form-title"'));
  assert.ok(s.includes('id="apois-help-requirements"'));
  assert.ok(s.includes('aria-describedby="apois-help-requirements"'));
  assert.ok(s.includes('disabled={submitting || subject.trim().length < 3 || description.trim().length < 10}'));
  assert.ok(s.includes('subject.trim().length < 3 ?'));
  assert.ok(s.includes('description.trim().length < 10 ?'));
  for(const [subject,description,canSubmit] of [
    ["ab","123456789",false],["abc","123456789",false],
    ["ab","1234567890",false],["abc","1234567890",true]
  ])assert.equal(subject.trim().length>=3&&description.trim().length>=10,canSubmit);
  assert.ok(s.includes('supabase.functions.invoke("customer-support"'));
  assert.ok(s.includes('onClick={() => void createTicket()}'));
});

test("RV17: both Entregas builders mount overlays after RV12/16 and preserve source-lock",()=>{
  for(const path of ["scripts/build-isolated-module.mjs","scripts/build-merchant-panel.mjs"]){
    const source=repo(path);
    assert.ok(source.includes("fix-entregas-menu-forms-visual17-v1.mjs"));
    assert.ok(source.includes("test-entregas-menu-forms-visual17-v1.test.mjs"));
    assert.ok(source.indexOf("fix-entregas-merchant-coupons-image-visual12-v1.mjs")
      < source.indexOf("fix-entregas-menu-forms-visual17-v1.mjs"));
    assert.ok(source.indexOf("fix-entregas-finance-scope-visual16-v1.mjs")
      < source.indexOf("fix-entregas-menu-forms-visual17-v1.mjs"));
  }
  const lock=JSON.parse(repo(".apois/source-lock.json"));
  assert.equal(lock.sources.entregas.commit,"2f4606e0fb52dffb49f2e6aebbe921ce687ab625");
});
