import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato visual não confirmado em ${relativePath}`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch('src/routes/motorista.app.tsx', (source) => {
  let next = source;

  // Remova imports/estado por identidade, sem depender da posição exata na lista.
  next = next
    .replace(/^\s*Menu,\s*\n/m, '')
    .replace(/^\s*MessageCircle,\s*\n/m, '')
    .replace(/^import\s+\{\s*DriverSideMenu\s*\}\s+from\s+["']@\/components\/DriverSideMenu["'];?\s*\n/m, '')
    .replace(/^import\s+\{\s*BrandSplash\s*\}\s+from\s+["']@\/components\/BrandSplash["'];?\s*\n/m, '')
    .replace(/^\s*const\s+\[sideMenuOpen,\s*setSideMenuOpen\]\s*=\s*useState\(false\);\s*\n/m, '');

  // A splash do shell Parceiro já é a única splash oficial. Normalize o wrapper
  // da rota por estrutura em vez de exigir o bloco histórico byte a byte.
  next = next.replace(
    /function\s+MotoristaAppRoute\(\)\s*\{\s*return\s*\(\s*<>\s*<BrandSplash\b[^>]*\/>\s*<MotoristaApp\s*\/>\s*<\/\>\s*\);?\s*\}/m,
    'function MotoristaAppRoute() {\n  return <MotoristaApp />;\n}',
  );

  // Caso o wrapper já tenha sido parcialmente reescrito, remova somente a splash
  // interna e preserve MotoristaApp.
  next = next.replace(/\s*<BrandSplash\b[^>]*\/>\s*/g, '\n');

  // Remova qualquer botão cuja ação seja abrir o menu paralelo. O match é
  // limitado ao próprio <button> para não afetar outros controles do cabeçalho.
  next = next.replace(
    /\s*<button\b(?=[\s\S]*?onClick=\{\(\)\s*=>\s*setSideMenuOpen\(true\)\})(?=[\s\S]*?aria-label=["']Abrir menu["'])[^>]*>[\s\S]*?<\/button>\s*/g,
    '\n',
  );

  // Remova a montagem do menu lateral independentemente de quebra de linha/ordem
  // das props.
  next = next.replace(/\s*<DriverSideMenu\b[\s\S]*?\/>\s*/g, '\n');

  // Chat ainda incompleto não pode ocupar ação primária. Remova qualquer
  // CircleAction cujo label seja Chat ou cujo onClick apenas informe "Chat em breve".
  next = next.replace(
    /\s*<CircleAction\b(?=[\s\S]*?(?:label=["']Chat["']|Chat em breve))[\s\S]*?\/>\s*/g,
    '\n',
  );

  // Amplie controles essenciais sem depender do restante da classe.
  next = next
    .replace(/\bh-10\s+w-10\b/g, 'h-11 w-11')
    .replace(/\bh-9\s+w-9\b/g, 'h-11 w-11')
    .replace(/\bh-8\s+w-8\b/g, 'h-11 w-11')
    .replace('<LogOut className="h-[16px] w-[16px]" strokeWidth={1.75} />', '<LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />');

  // Se o wrapper ficou como fragmento sem splash, simplifique-o de forma segura.
  next = next.replace(
    /function\s+MotoristaAppRoute\(\)\s*\{\s*return\s*\(\s*<>\s*<MotoristaApp\s*\/>\s*<\/\>\s*\);?\s*\}/m,
    'function MotoristaAppRoute() {\n  return <MotoristaApp />;\n}',
  );

  return next;
}, (source) => {
  const routeBlockMatch = source.match(/function\s+MotoristaAppRoute\(\)[\s\S]*?\n\}/);
  const routeBlock = routeBlockMatch?.[0] ?? '';
  const hasLargeTouchTarget = /\bh-11\s+w-11\b/.test(source) || /\bmin-h-11\b/.test(source);
  return (
    !source.includes('DriverSideMenu') &&
    !source.includes('sideMenuOpen') &&
    !source.includes('BrandSplash') &&
    !source.includes('Chat em breve') &&
    !source.includes('icon={MessageCircle}') &&
    !source.includes('aria-label="Abrir menu"') &&
    hasLargeTouchTarget &&
    routeBlock.includes('<MotoristaApp />') &&
    !routeBlock.includes('BrandSplash')
  );
},
'Motorista: remove menu paralelo, splash duplicada, Chat incompleto e amplia controles essenciais');

patch('src/routes/motorista.perfil.tsx', (source) => {
  let next = source;
  if (!next.includes('  Settings,\n')) {
    next = next.replace('  ShieldCheck,\n', '  ShieldCheck,\n  Settings,\n');
  }

  const vehicleRow = `              <MenuRow icon={Car} label="Veículo e documentos" sub={vehicleModel ? \`${'${vehicleModel}'} · ${'${maskPlate(driver?.vehicle_plate)}'}\` : "Modelo, placa e documentos do veículo"} to="/motorista/documentos" />\n              <Divider />\n`;
  next = next.replace(vehicleRow, '');
  next = next.replace(
    `                label="Documentos"\n                sub="CNH, CRLV e selfie"`,
    `                label="Veículo e documentos"\n                sub={vehicleModel ? \`${'${vehicleModel}'} · ${'${maskPlate(driver?.vehicle_plate)}'} · CNH/CRLV\` : "Veículo, CNH, CRLV e selfie"}`,
  );

  next = next.replace(
    `              <Divider />\n              <MenuRow icon={CreditCard} label="Mensalidade" sub="Status, pagamento Pix e comprovante" to="/motorista/assinatura" />`,
    '',
  );

  const preferences = `              <MenuRow icon={LifeBuoy} label="Suporte" sub="Central de ajuda e contato" to="/motorista/suporte" />\n              <Divider />\n              <MenuRow icon={ShieldCheck} label="Privacidade e segurança" sub="Dados, permissões e conta" to="/motorista/privacidade" />`;
  const enriched = `              <MenuRow icon={LifeBuoy} label="Suporte" sub="Central de ajuda e contato" to="/motorista/suporte" />\n              <Divider />\n              <MenuRow icon={ShieldCheck} label="Segurança" sub="SOS, contatos e recursos de proteção" to="/motorista/seguranca" />\n              <Divider />\n              <MenuRow icon={FileText} label="Status do cadastro" sub="Aprovação e situação dos documentos" to="/motorista/status" />\n              <Divider />\n              <MenuRow icon={Settings} label="Configurações" sub="Preferências do aplicativo" to="/motorista/configuracoes" />\n              <Divider />\n              <MenuRow icon={ShieldCheck} label="Privacidade" sub="Dados, permissões e conta" to="/motorista/privacidade" />`;
  if (next.includes(preferences)) next = next.replace(preferences, enriched);

  return next;
}, (source) =>
  source.includes('label="Veículo e documentos"') &&
  !source.includes('label="Documentos"\n                sub="CNH, CRLV e selfie"') &&
  !source.includes('label="Mensalidade"') &&
  source.includes('label="Segurança"') &&
  source.includes('label="Status do cadastro"') &&
  source.includes('label="Configurações"') &&
  source.includes('label="Privacidade"') &&
  source.includes('to="/motorista/seguranca"') &&
  source.includes('to="/motorista/status"') &&
  source.includes('to="/motorista/configuracoes"'),
'Motorista: Perfil concentra opções auxiliares sem repetir mensalidade ou documentos');

patch('src/mobile-route-tree.motorista.ts', (source) => {
  let next = source;
  next = next
    .replace("import { Route as MotoristaCarteiraRouteImport } from './routes/motorista.carteira'\n", '')
    .replace("const MotoristaCarteiraRoute = MotoristaCarteiraRouteImport.update({ id: '/motorista/carteira', path: '/motorista/carteira', getParentRoute: () => rootRouteImport } as any)\n", '')
    .replace('  MotoristaCarteiraRoute,\n', '');
  return next;
}, (source) =>
  !source.includes('MotoristaCarteiraRouteImport') &&
  !source.includes('MotoristaCarteiraRoute') &&
  !source.includes("./routes/motorista.carteira") &&
  source.includes('MotoristaGanhosRoute'),
'Motorista: árvore do APK não inclui mais a carteira custodial legada; Ganhos é a única superfície financeira de corridas');

console.log(`[OK] UI móvel do Motorista simplificada em ${workspace}: um único menu primário, sem carteira legada, sem atalhos incompletos e sem splash interna duplicada.`);
