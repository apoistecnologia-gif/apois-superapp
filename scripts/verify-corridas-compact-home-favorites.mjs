// APOIS_COMPACT_HOME_V1 / APOIS_FAVORITES_IN_DESTINATION_SEARCH_V1
// Verificação local do workspace Corridas: não chama backend nem cria APK.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const work=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const read=rel=>readFileSync(resolve(work,rel),'utf8');
const home=read('src/routes/_authenticated.inicio.tsx');
const search=read('src/routes/_authenticated.buscar-destino.tsx');
const store=read('src/hooks/use-destination-history.tsx');
const favoritesService=read('src/services/destinations/favorites-service.ts');
const pricing=read('src/hooks/use-pricing.tsx');
const categories=read('src/components/pricing/CategorySelector.tsx');
const originalHomeMarker='APOIS_COMPACT_HOME_V1';

assert.ok(home.includes(originalHomeMarker),'Layout compacto não foi aplicado');
assert.ok(!home.includes('<HomeWorkShortcuts />'),'Cartões Casa/Trampo não podem aparecer na Home');
assert.ok(!home.includes('function HomeWorkShortcuts()'),'Componente de atalhos obsoleto permanece');
for(const marker of ['<PassengerMap','<CategorySelector />','Solicitar corrida','Local de partida','Destino','<PaymentMethodSelector','<RideStopsInput']){
  assert.ok(home.includes(marker),'Fluxo da Home foi perdido: '+marker);
}
assert.ok(home.includes('className="mt-1.5"><CategorySelector />'),'Espaçamento compacto das categorias ausente');
assert.ok(home.includes('mt-2 flex min-h-[48px]'),'Botão principal compacto e acessível ausente');
assert.ok(!home.includes('mt-3"><HomeWorkShortcuts'),'Atalhos continuam ocupando espaço');
assert.ok(categories.includes('validated-sprite-v6'),'Arte oficial dos veículos foi removida');
assert.ok(pricing.includes('pricingService.estimateFares(request)'),'Cálculo real de tarifas foi alterado');

for(const marker of [
  'APOIS_FAVORITES_IN_DESTINATION_SEARCH_V1',
  'const [saveTarget, setSaveTarget]',
  'addFavorite(details,name,target)',
  'if(saveTarget){saveAddress(details,saveTarget);return;}',
  'if(saveTarget){saveAddress(item,saveTarget);return;}',
  'beginSaving(type)',
  'beginSaving("heart")',
  'data-apois-favorite-save-mode="true"',
  'Salvar Casa',
  'Salvar Trabalho',
  'Outro local',
  'setSaveTarget(null)',
  '<BottomSheet',
  'handleFinalSelection(details)',
  'placesService.selectPrediction(suggestion)',
  'data-apois-stable-destination-sheet'
]){
  assert.ok(search.includes(marker),'Salvar endereço na busca incompleto: '+marker);
}
assert.ok(store.includes('addFavorite: (')||store.includes('  addFavorite: ('),'Provider de favoritos original ausente');
assert.ok(store.includes('favoritesService.addFavorite'),'Favoritos não utilizam storage existente');
assert.ok(favoritesService.includes('destination.icon === "home" || destination.icon === "briefcase"'),'Casa e Trabalho precisam continuar atualizáveis');
assert.ok(favoritesService.includes('DestinationStorage.saveFavorites'),'Persistência original indisponível');
for(const marker of ['supabase.from("rides").insert(','.update({ total', 'DEFAULT_TARIFF','setDestination(null)']){
  assert.ok(!search.includes(marker),'Busca não pode criar cobrança, rota ou limpar destino: '+marker);
}
console.log('[OK] APOIS Cliente: mapa maior, Casa/Trabalho fora da Home; salvar Casa/Trabalho/Outro na busca com favoritos persistidos.');
