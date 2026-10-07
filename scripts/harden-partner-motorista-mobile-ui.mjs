import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  const result = verify(after);
  if (result !== true) {
    const detail = typeof result === 'string' && result ? ` (${result})` : '';
    throw new Error(`[FAIL] ${label}: contrato visual não confirmado em ${relativePath}${detail}`);
  }
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

function removeElementContaining(source, openTag, closeTag, marker) {
  let next = source;
  let searchFrom = 0;
  while (true) {
    const markerAt = next.indexOf(marker, searchFrom);
    if (markerAt < 0) break;
    const openAt = next.lastIndexOf(openTag, markerAt);
    const closeAt = next.indexOf(closeTag, markerAt);
    if (openAt < 0 || closeAt < 0 || closeAt < openAt) {
      searchFrom = markerAt + marker.length;
      continue;
    }
    next = next.slice(0, openAt) + next.slice(closeAt + closeTag.length);
    searchFrom = Math.max(0, openAt - 1);
  }
  return next;
}

function removeSelfClosingContaining(source, tagName, markers) {
  let next = source;
  let cursor = 0;
  while (true) {
    const start = next.indexOf(`<${tagName}`, cursor);
    if (start < 0) break;
    const end = next.indexOf('/>', start);
    if (end < 0) break;
    const block = next.slice(start, end + 2);
    if (markers.some((marker) => block.includes(marker))) {
      next = next.slice(0, start) + next.slice(end + 2);
      cursor = Math.max(0, start - 1);
    } else {
      cursor = end + 2;
    }
  }
  return next;
}

patch('src/routes/motorista.app.tsx', (source) => {
  let next = source;

  // Limpeza de imports/estado por assinatura real de código, não por comentários.
  next = next
    .replace(/^import\s+\{\s*DriverSideMenu\s*\}\s+from\s+["']@\/components\/DriverSideMenu["'];?\s*(?:\r?\n|$)/gm, '')
    .replace(/^import\s+\{\s*BrandSplash\s*\}\s+from\s+["']@\/components\/BrandSplash["'];?\s*(?:\r?\n|$)/gm, '')
    .replace(/^\s*Menu,\s*(?:\r?\n|$)/gm, '')
    .replace(/^\s*MessageCircle,\s*(?:\r?\n|$)/gm, '')
    .replace(/^\s*const\s+\[sideMenuOpen,\s*setSideMenuOpen\]\s*=\s*useState\(false\);\s*(?:\r?\n|$)/gm, '');

  // Wrapper determinístico: a splash interna é removida porque o shell Parceiro
  // já possui a splash oficial.
  const routeStart = next.indexOf('function MotoristaAppRoute()');
  const typeAnchor = next.indexOf('type LatLng =', routeStart);
  if (routeStart >= 0 && typeAnchor > routeStart) {
    next = next.slice(0, routeStart)
      + 'function MotoristaAppRoute() {\n  return <MotoristaApp />;\n}\n\n'
      + next.slice(typeAnchor);
  }

  next = next.replace(/\s*<BrandSplash\b[^>]*\/>\s*/g, '\n');

  // Menu paralelo: remover o botão e a montagem do componente por assinatura.
  next = removeElementContaining(next, '<button', '</button>', 'aria-label="Abrir menu"');
  next = removeElementContaining(next, '<button', '</button>', "aria-label='Abrir menu'");
  next = removeElementContaining(next, '<button', '</button>', 'setSideMenuOpen(true)');
  next = removeSelfClosingContaining(next, 'DriverSideMenu', ['DriverSideMenu']);

  // Chat incompleto não ocupa ação primária.
  next = removeSelfClosingContaining(next, 'CircleAction', ['label="Chat"', "label='Chat'", 'Chat em breve', 'icon={MessageCircle}']);

  // Limpeza final de resíduos de código que só pertenciam ao menu/chat removidos.
  next = next
    .replace(/^\s*const\s+\[sideMenuOpen,\s*setSideMenuOpen\][^\n]*(?:\r?\n|$)/gm, '')
    .replace(/^\s*Menu,\s*(?:\r?\n|$)/gm, '')
    .replace(/^\s*MessageCircle,\s*(?:\r?\n|$)/gm, '');

  // Proteja painéis inferiores e ofertas contra a barra Android de três botões.
  // O rodapé principal ficou maior; reservas antigas de 68/76px passaram a
  // sobrepor o painel e os CTAs depois da troca de layout.
  next = next
    .replaceAll(
      'const navReserve = "calc(env(safe-area-inset-bottom) + 76px)";',
      'const navReserve = "calc(max(44px, env(safe-area-inset-bottom)) + 88px)";',
    )
    .replaceAll(
      'style={{ bottom: "calc(env(safe-area-inset-bottom) + 68px)" }}',
      'style={{ bottom: "calc(max(44px, env(safe-area-inset-bottom)) + 88px)" }}',
    )
    .replaceAll(
      'style={{ paddingBottom: "env(safe-area-inset-bottom)" }}',
      'style={{ paddingBottom: "max(52px, env(safe-area-inset-bottom))" }}',
    )
    .replaceAll(
      'style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)" }}',
      'style={{ paddingBottom: "max(52px, calc(env(safe-area-inset-bottom) + 4px))" }}',
    )
    .replaceAll(
      'style={{ padding: "12px 20px calc(env(safe-area-inset-bottom) + 16px)" }}',
      'style={{ padding: "12px 20px max(52px, calc(env(safe-area-inset-bottom) + 16px))" }}',
    );

  // Modais de cancelamento/avaliação podem exceder a viewport em aparelhos
  // baixos. Torne o card rolável e preserve o CTA acima da navegação Android.
  next = next
    .replaceAll(
      'className="w-full max-w-md rounded-t-[28px] bg-card p-5 shadow-[0_-28px_80px_-24px_rgba(0,0,0,0.65)] ring-1 ring-border animate-sheet-in"',
      'className="max-h-[calc(100dvh-max(env(safe-area-inset-top),12px))] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] bg-card px-5 pt-5 pb-[max(52px,env(safe-area-inset-bottom))] shadow-[0_-28px_80px_-24px_rgba(0,0,0,0.65)] ring-1 ring-border animate-sheet-in"',
    )
    .replaceAll(
      'className="w-full max-w-md rounded-t-[28px] bg-card p-5 pb-6 shadow-[0_-24px_80px_-24px_rgba(0,0,0,0.55)] ring-1 ring-border animate-sheet-in"',
      'className="max-h-[calc(100dvh-max(env(safe-area-inset-top),12px))] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] bg-card px-5 pt-5 pb-[max(52px,env(safe-area-inset-bottom))] shadow-[0_-24px_80px_-24px_rgba(0,0,0,0.55)] ring-1 ring-border animate-sheet-in"',
    );

  // Amplie controles essenciais; transformação idempotente.
  next = next
    .replace(/\bh-10\s+w-10\b/g, 'h-11 w-11')
    .replace(/\bh-9\s+w-9\b/g, 'h-11 w-11')
    .replace(/\bh-8\s+w-8\b/g, 'h-11 w-11')
    .replace('<LogOut className="h-[16px] w-[16px]" strokeWidth={1.75} />', '<LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />');

  return next;
}, (source) => {
  const routeStart = source.indexOf('function MotoristaAppRoute()');
  const typeAnchor = source.indexOf('type LatLng =', routeStart);
  const routeBlock = routeStart >= 0 && typeAnchor > routeStart ? source.slice(routeStart, typeAnchor) : '';

  const failures = [];
  if (!routeBlock.includes('return <MotoristaApp />;')) failures.push('wrapper MotoristaAppRoute');
  if (/import\s+\{\s*DriverSideMenu\s*\}/.test(source) || /<DriverSideMenu\b/.test(source)) failures.push('DriverSideMenu');
  if (/\bconst\s+\[sideMenuOpen,\s*setSideMenuOpen\]/.test(source) || /setSideMenuOpen\s*\(/.test(source)) failures.push('sideMenuOpen');
  if (/import\s+\{\s*BrandSplash\s*\}/.test(source) || /<BrandSplash\b/.test(source)) failures.push('BrandSplash');
  if (/Chat em breve/.test(source) || /<CircleAction\b[\s\S]*?icon=\{MessageCircle\}/.test(source)) failures.push('Chat incompleto');
  if (/aria-label=["']Abrir menu["']/.test(source)) failures.push('botão Abrir menu');
  if (!(/\bh-11\s+w-11\b/.test(source) || /\bmin-h-11\b/.test(source) || /\bh-12\s+w-12\b/.test(source))) failures.push('alvos de toque');
  if (!source.includes('<ApoisDriverBottomNav')) failures.push('ApoisDriverBottomNav');
  for (const marker of [
    'calc(max(44px, env(safe-area-inset-bottom)) + 88px)',
    'max(52px, env(safe-area-inset-bottom))',
    'max(52px, calc(env(safe-area-inset-bottom) + 4px))',
    'max(52px, calc(env(safe-area-inset-bottom) + 16px))',
    'max-h-[calc(100dvh-max(env(safe-area-inset-top),12px))]',
    'pb-[max(52px,env(safe-area-inset-bottom))]',
  ]) {
    if (!source.includes(marker)) failures.push('safe-area ' + marker);
  }

  return failures.length ? failures.join(', ') : true;
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

patch('src/mobile-route-tree.motorista.ts', (source) => source, (source) =>
  source.includes("import { Route as MotoristaCarteiraRouteImport } from './routes/motorista.carteira'\n") &&
  source.includes("const MotoristaCarteiraRoute = MotoristaCarteiraRouteImport.update({ id: '/motorista/carteira', path: '/motorista/carteira', getParentRoute: () => rootRouteImport } as any)\n") &&
  source.includes('  MotoristaCarteiraRoute,\n') &&
  source.includes('MotoristaGanhosRoute'),
'Motorista: árvore do APK preserva a rota de compatibilidade carteira→ganhos sem recolocá-la na navegação primária');

console.log(`[OK] UI móvel do Motorista simplificada em ${workspace}: um único menu primário, rota carteira→ganhos preservada para compatibilidade, sem atalhos incompletos e sem splash interna duplicada.`);
