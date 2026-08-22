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
  next = next
    .replace('  Menu,\n', '')
    .replace('  MessageCircle,\n', '')
    .replace('import { DriverSideMenu } from "@/components/DriverSideMenu";\n', '')
    .replace('import { BrandSplash } from "@/components/BrandSplash";\n', '')
    .replace('  const [sideMenuOpen, setSideMenuOpen] = useState(false);\n', '');

  next = next.replace(
    `function MotoristaAppRoute() {\n  return (\n    <>\n      <BrandSplash storageKey="apois:splash:motorista" />\n      <MotoristaApp />\n    </>\n  );\n}`,
    `function MotoristaAppRoute() {\n  return <MotoristaApp />;\n}`,
  );

  const menuButton = `          <button\n            onClick={() => setSideMenuOpen(true)}\n            aria-label="Abrir menu"\n            className="press-scale inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground/90 transition hover:bg-white/5"\n            style={{ border: "1px solid rgba(255,255,255,0.08)" }}\n          >\n            <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />\n          </button>\n`;
  next = next.replace(menuButton, '');

  const sideMenu = `      <DriverSideMenu\n        open={sideMenuOpen}\n        onOpenChange={setSideMenuOpen}\n        onLogout={handleLogout}\n      />\n\n`;
  next = next.replace(sideMenu, '');

  next = next.replace(
    'className="press-scale inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground/80 transition hover:bg-white/5 hover:text-destructive"',
    'className="press-scale inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground/80 transition hover:bg-white/5 hover:text-destructive"',
  );
  next = next.replace(
    '<LogOut className="h-[16px] w-[16px]" strokeWidth={1.75} />',
    '<LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />',
  );

  const chatAction = `            <CircleAction\n              icon={MessageCircle}\n              label="Chat"\n              onClick={() => toast.info("Chat em breve")}\n            />\n`;
  next = next.split(chatAction).join('');

  next = next
    .replace('className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 disabled:opacity-50"', 'className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 disabled:opacity-50"')
    .replace('className="-mr-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 disabled:opacity-40"', 'className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 disabled:opacity-40"')
    .replaceAll('className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground', 'className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground');

  return next;
}, (source) =>
  !source.includes('DriverSideMenu') &&
  !source.includes('sideMenuOpen') &&
  !source.includes('BrandSplash') &&
  !source.includes('Chat em breve') &&
  !source.includes('icon={MessageCircle}') &&
  !source.includes('aria-label="Abrir menu"') &&
  source.includes('inline-flex h-11 w-11') &&
  source.includes('function MotoristaAppRoute() {\n  return <MotoristaApp />;'),
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
