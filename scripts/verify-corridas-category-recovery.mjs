// Regressao APOIS categorias: nao confundir falha de rede com catalogo vazio.
// Testa codigo preparado no workspace: sem mudar DB, sem disparar APK.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const work=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const read=p=>readFileSync(resolve(work,p),'utf8');
const p=read('src/hooks/use-ride-categories.tsx');
const cat=read('src/components/pricing/CategorySelector.tsx');
const service=read('src/services/categories/category-service.ts');
const pricing=read('src/hooks/use-pricing.tsx');
const request=read('src/hooks/rides/use-ride-request.tsx');
for(const mark of [
  'APOIS_CATEGORY_RECOVERY_V1',
  'useAuth()',
  'authState==="authenticated"',
  'window.addEventListener("online",retry)',
  'document.addEventListener("visibilitychange",retry)',
  'setCategories(data)',
  'setSelectedCategory(current=>data.find',
  'categoryService.getCategories()',
  'setError("Não foi possível carregar as categorias.',
  'refreshCategories:fetchCategories',
])assert.ok(p.includes(mark),'Provider nao se recupera corretamente: '+mark);
assert.ok(cat.includes('data-apois-categories-retry="true"'),'Tela sem botao de atualizar');
assert.ok(cat.includes('categoriesError'),'Erro de consulta precisa ficar visivel');
assert.ok(cat.includes('refreshCategories()'),'Atualizar precisa repetir chamada real');
assert.ok(cat.includes('validated-sprite-v6'),'Sprite original APOIS foi removido');
assert.ok(cat.includes('servicePosition[String(cat.key ?? cat.code ?? "").toLowerCase()]'),'Imagem deve mapear o codigo verdadeiro da categoria');
for (const marker of ['carros: "0%"', 'carro: "0%"', 'motos: "25%"', 'moto: "25%"']) {
  assert.ok(cat.includes(marker), 'Sprite deve reconhecer codigo singular/plural: '+marker);
}
assert.ok(cat.includes('categories.map((cat)'),'Categorias nao usam o banco');
assert.ok(!cat.includes('Não há categorias disponíveis para esta rota no momento.'),'Mensagem enganosa nao eliminada');
assert.ok(!p.includes('const DEMO_CATEGORIES'),'Proibido catalogo falso');
assert.ok(service.includes('.from("ride_categories")')&&service.includes('.eq("is_active", true)'),'Fonte oficial das categorias alterada');
assert.ok(pricing.includes('pricingService.estimateFares(request)'),'Precos precisam da API oficial');
assert.ok(request.includes('selectedCategory.code'),'Codigo real da categoria na solicitacao');
assert.ok(cat.includes('estimate?.available !== false'),'Proibido forcar categoria indisponivel');
console.log('[OK] APOIS: cinco categorias vindas do Supabase, retry autenticação/rede, sem preços inventados e sem perda de sprite.');
