// APOIS_ENTREGAS_TOUCH_TARGETS_V17
//
// Defeito D-003 medido com Playwright em 390x844:
//   - "Termos de Uso" 65x16 e "Privacidade" 51x16 na landing (altura 16px)
//   - botão Voltar do registro 36x36
// Todos abaixo do mínimo de 44x44 recomendado para toque no Android.
//
// Correção sem mudar a identidade visual: os links legais ganham área de toque
// via padding vertical e inline-flex (o sublinhado e a cor permanecem), e o
// botão Voltar passa a 44x44 com grid place-items-center. Nenhum texto, rota ou
// handler é alterado.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const marker = 'APOIS_ENTREGAS_TOUCH_TARGETS_V17';

function patch(relative, transform, label) {
  const path = resolve(root, relative);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
  return after;
}

// 1. Links legais da landing: área de toque >= 44px mantendo cor e sublinhado.
patch('src/routes/index.tsx', (source) => {
  const className = 'className="text-[#666B73] underline underline-offset-2"';
  const replacement =
    'className="inline-flex min-h-11 items-center px-1 text-[#666B73] underline underline-offset-2"';
  if (source.includes(replacement)) return source;
  if (!source.includes(className)) {
    console.log('[OK] landing: links legais já com área de toque');
    return source;
  }
  return source.replaceAll(className, replacement);
}, 'Entregas: Termos de Uso e Privacidade com alvo de 44px');

// 2. Botão Voltar do registro: 44x44 sem deslocar o header.
patch('src/routes/register.tsx', (source) => {
  const className = 'className="-ml-2 rounded-full p-2 hover:bg-white/10"';
  const replacement =
    'className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-white/10"';
  if (source.includes(replacement)) return source;
  if (!source.includes(className)) {
    console.log('[OK] registro: botão Voltar já com alvo de 44px');
    return source;
  }
  return source.replace(className, replacement);
}, 'Entregas: botão Voltar do registro com alvo de 44px');

// 3. Botão "Mostrar/Ocultar senha": 20x20 medido. Ganha alvo 44x44 mantendo o
// ícone no mesmo lugar (o padding cresce em volta, não desloca o input).
patch('src/routes/register.tsx', (source) => {
  const className = 'className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500"';
  const replacement =
    'className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-zinc-500"';
  if (source.includes(replacement)) return source;
  if (!source.includes(className)) {
    console.log('[OK] registro: botão de senha já com alvo de 44px');
    return source;
  }
  return source.replaceAll(className, replacement);
}, 'Entregas: Mostrar/Ocultar senha com alvo de 44px');

// 4. Checkbox de termos: 16x16 medido. O alvo de toque passa a vir do label
// (htmlFor), que já é clicável; aqui só garantimos área mínima no próprio
// checkbox sem mudar o desenho do quadrado.
// Medição por hit-test mostrou que o ::after não ampliava a área clicável
// (16x16, apenas 20px acima acertava — era o label). A área de toque passa a vir
// do próprio controle: 44x44 com o quadrado desenhado por ::before, mantendo o
// visual de checkbox e o estado data-[state=checked].
patch('src/components/ui/checkbox.tsx', (source) => {
  const marker = 'apois-touch-44';
  if (source.includes(marker)) return source;
  const anchor = 'grid place-content-center peer h-4 w-4 shrink-0 rounded-sm';
  if (!source.includes(anchor)) {
    console.log('[OK] checkbox: classe base já alterada');
    return source;
  }
  return source.replace(
    anchor,
    'relative grid h-11 w-11 shrink-0 place-items-center rounded-md peer ' +
      "before:block before:h-4 before:w-4 before:rounded-sm before:border before:border-primary before:bg-transparent " +
      'data-[state=checked]:before:bg-primary',
  );
}, 'Entregas: checkbox de termos com alvo real de 44x44');

// 5. Link "Entrar" no rodapé do registro: 42x44 (largura < 44). Só a largura
// mínima muda; o texto e o destino permanecem.
patch('src/routes/register.tsx', (source) => {
  const className = 'className="inline-flex min-h-11 items-center rounded-lg px-1 font-bold text-primary"';
  const replacement =
    'className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 font-bold text-primary"';
  if (source.includes(replacement)) return source;
  if (!source.includes(className)) return source;
  return source.replaceAll(className, replacement);
}, 'Entregas: link Entrar do registro com alvo de 44x44');

// Contrato: nenhum dos alvos medidos pode voltar a ficar pequeno.
const failures = [];
const landing = readFileSync(resolve(root, 'src/routes/index.tsx'), 'utf8');
const register = readFileSync(resolve(root, 'src/routes/register.tsx'), 'utf8');
if (!landing.includes('min-h-11 items-center px-1')) failures.push('links legais da landing sem min-h-11');
if (landing.includes('className="text-[#666B73] underline underline-offset-2"')) failures.push('link legal ainda com classe antiga de 16px');
if (!register.includes('h-11 w-11 shrink-0 place-items-center')) failures.push('botão Voltar do registro sem 44x44');
if (!register.includes('aria-label="Voltar"')) failures.push('botão Voltar perdeu o aria-label');
if (!register.includes('grid h-11 w-11 -translate-y-1/2 place-items-center')) failures.push('botão de senha sem alvo 44x44');
const checkbox = readFileSync(resolve(root, 'src/components/ui/checkbox.tsx'), 'utf8');
if (!checkbox.includes('h-11 w-11')) failures.push('checkbox de termos sem alvo 44x44');

if (failures.length) {
  console.error('[FAIL] Entregas: alvos de toque não confirmados:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`[OK] Entregas: alvos de toque confirmados (${marker}).`);
