import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// O checkout do snapshot fixado passou a separar a leitura do provedor
// (configuredProvider, perto do topo, já com a guarda de segurança aplicada
// por harden-entregas-superapp-auth-runtime.mjs) da seleção real de
// pixFunction (perto do ponto de uso, com um ternário de 3 vias que já
// suporta mercadopago_merchant nativamente). As duas partes não ficam mais
// contíguas, então não há um bloco único para reverter entre camadas — só
// confirmamos que ambos os pontos de extensão que os hardeners seguintes
// dependem ainda existem.
const path = resolve('.work/entregas/src/routes/checkout.tsx');
const source = readFileSync(path, 'utf8');

const requiredMarkers = [
  'const configuredProvider =',
  'if (!new Set(["openpix", "asaas"]).has(configuredProvider)) {',
  'const pixFunction =',
  'configuredProvider === "mercadopago_merchant"',
];
const missing = requiredMarkers.filter((marker) => !source.includes(marker));
if (missing.length) {
  // O snapshot moveu a criação do PIX para a tela do pedido e removeu a escolha
  // de provedor no checkout. Se o bloco antigo não existe, não há o que
  // normalizar — o contrato de "nenhum provedor legado" é verificado adiante.
  if (!source.includes('const configuredProvider =')) {
    console.log('[OK] Entregas: bloco de escolha de provedor já não existe no checkout (snapshot atual)');
    process.exit(0);
  }
  throw new Error(
    `[FAIL] Entregas: bloco financeiro do checkout mudou; não é seguro escolher provedor automaticamente (${missing.join(', ')}).`,
  );
}
console.log('[OK] Entregas: handoff do checkout confirmado (configuredProvider e pixFunction em pontos distintos, ambos presentes).');
