import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
  'src/routes/inicio.tsx',
  'src/routes/pedidos.tsx',
  'src/routes/favoritos.tsx',
  'src/routes/buscar.tsx',
  'src/routes/perfil/index.tsx',
  'src/routes/perfil/dados-pessoais.tsx',
  'src/routes/perfil/pagamentos.tsx',
  'src/routes/perfil/notificacoes.tsx',
  'src/routes/perfil/legal.tsx',
  'src/routes/perfil/ajuda.tsx',
  'src/routes/perfil/ajuda/chamado/$ticketId.tsx',
  'src/routes/pedido/$orderId/index.tsx',
  'src/routes/pedido/$orderId/avaliar.tsx',
  'src/routes/chamado-suporte.$ticketId.tsx',
  'src/routes/estabelecimento.$merchantId.tsx',
  'src/routes/notificacoes.tsx',
];

let touched = 0;
for (const relativePath of files) {
  const path = resolve('.work/entregas', relativePath);
  if (!existsSync(path)) continue;
  const before = readFileSync(path, 'utf8');
  const after = before
    .replaceAll('min-h-screen', 'min-h-dvh')
    .replaceAll('h-screen', 'h-dvh');
  if (after !== before) {
    writeFileSync(path, after, 'utf8');
    touched += 1;
  }
  if (/\b(?:min-)?h-screen\b/.test(after)) {
    throw new Error(`[FAIL] Entregas viewport: unidade h-screen permaneceu em ${relativePath}`);
  }
}

console.log(`[OK] Entregas: ${touched} telas normalizadas para 100dvh; teclado e barras móveis não dependem de 100vh fixo.`);
