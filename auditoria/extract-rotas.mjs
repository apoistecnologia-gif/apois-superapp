// Extrator estático de evidências por rota. Não altera código, não executa app.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROUTES = [
  ['Entregas', 'Cliente', 'enderecos/editar/$addressId', 'sources/apois-entregas/src/routes/enderecos/editar/$addressId.tsx'],
  ['Entregas', 'Cliente', 'pedido/$orderId', 'sources/apois-entregas/src/routes/pedido/$orderId/index.tsx'],
  ['Entregas', 'Cliente', 'pedido/$orderId/avaliar', 'sources/apois-entregas/src/routes/pedido/$orderId/avaliar.tsx'],
  ['Entregas', 'Cliente', 'pedido/confirmado', 'sources/apois-entregas/src/routes/pedido/confirmado.tsx'],
  ['Entregas', 'Cliente', 'sacola', 'sources/apois-entregas/src/routes/sacola.tsx'],
  ['Entregas', 'Cliente', 'checkout', 'sources/apois-entregas/src/routes/checkout.tsx'],
  ['Entregas', 'Cliente', 'buscar', 'sources/apois-entregas/src/routes/buscar.tsx'],
  ['Entregas', 'Cliente', 'favoritos', 'sources/apois-entregas/src/routes/favoritos.tsx'],
  ['Entregas', 'Cliente', 'notificacoes', 'sources/apois-entregas/src/routes/notificacoes.tsx'],
  ['Entregas', 'Cliente', 'perfil', 'sources/apois-entregas/src/routes/perfil/index.tsx'],
  ['Entregas', 'Cliente', 'perfil/dados-pessoais', 'sources/apois-entregas/src/routes/perfil/dados-pessoais.tsx'],
  ['Entregas', 'Cliente', 'perfil/pagamentos', 'sources/apois-entregas/src/routes/perfil/pagamentos.tsx'],
  ['Entregas', 'Cliente', 'perfil/ajuda', 'sources/apois-entregas/src/routes/perfil/ajuda.tsx'],
  ['Entregas', 'Cliente', 'perfil/legal', 'sources/apois-entregas/src/routes/perfil/legal.tsx'],
  ['Entregas', 'Cliente', 'perfil/notificacoes', 'sources/apois-entregas/src/routes/perfil/notificacoes.tsx'],
  ['Entregas', 'Cliente', 'estabelecimento/$merchantId', 'sources/apois-entregas/src/routes/estabelecimento.$merchantId.tsx'],
  ['Entregas', 'Cliente', 'apois-plus', 'sources/apois-entregas/src/routes/apois-plus.tsx'],
  ['Entregas', 'Cliente', 'chamado-suporte/$ticketId', 'sources/apois-entregas/src/routes/chamado-suporte.$ticketId.tsx'],
  ['Entregas', 'Cliente', 'perfil/ajuda/chamado/$ticketId', 'sources/apois-entregas/src/routes/perfil/ajuda/chamado/$ticketId.tsx'],
  ['Entregas', 'Entregador', 'courier', 'sources/apois-entregas/src/routes/courier.tsx'],
  ['Entregas', 'Estabelecimento', 'merchant', 'sources/apois-entregas/src/routes/merchant.tsx'],
  ['Entregas', 'Estabelecimento', 'configuracoes-estabelecimento', 'sources/apois-entregas/src/routes/configuracoes-estabelecimento.tsx'],
  ['Entregas', 'Admin', 'admin', 'sources/apois-entregas/src/routes/admin.tsx'],
  ['Corridas', 'Passageiro', 'inicio', 'sources/apois-corridas-passageiro/src/routes/_authenticated.inicio.tsx'],
  ['Corridas', 'Passageiro', 'buscar-destino', 'sources/apois-corridas-passageiro/src/routes/_authenticated.buscar-destino.tsx'],
  ['Corridas', 'Passageiro', 'revisar-solicitacao', 'sources/apois-corridas-passageiro/src/routes/_authenticated.revisar-solicitacao.tsx'],
  ['Corridas', 'Passageiro', 'corrida/$rideId', 'sources/apois-corridas-passageiro/src/routes/_authenticated.corrida.$rideId.tsx'],
  ['Corridas', 'Passageiro', 'corridas', 'sources/apois-corridas-passageiro/src/routes/_authenticated.corridas.tsx'],
  ['Corridas', 'Passageiro', 'carteira', 'sources/apois-corridas-passageiro/src/routes/_authenticated.carteira.tsx'],
  ['Corridas', 'Passageiro', 'notificacoes', 'sources/apois-corridas-passageiro/src/routes/_authenticated.notificacoes.tsx'],
  ['Corridas', 'Passageiro', 'perfil', 'sources/apois-corridas-passageiro/src/routes/_authenticated.perfil.tsx'],
  ['Corridas', 'Motorista', 'motorista/cadastro', 'sources/apois-corridas-motorista-admin/src/routes/motorista.cadastro.tsx'],
  ['Corridas', 'Motorista', 'motorista/corridas', 'sources/apois-corridas-motorista-admin/src/routes/motorista.corridas.tsx'],
  ['Corridas', 'Motorista', 'motorista/corridas/$id', 'sources/apois-corridas-motorista-admin/src/routes/motorista.corridas.$id.tsx'],
  ['Corridas', 'Motorista', 'motorista/ganhos', 'sources/apois-corridas-motorista-admin/src/routes/motorista.ganhos.tsx'],
  ['Corridas', 'Motorista', 'motorista/carteira', 'sources/apois-corridas-motorista-admin/src/routes/motorista.carteira.tsx'],
  ['Corridas', 'Motorista', 'motorista/perfil', 'sources/apois-corridas-motorista-admin/src/routes/motorista.perfil.tsx'],
  ['Corridas', 'Motorista', 'motorista/documentos', 'sources/apois-corridas-motorista-admin/src/routes/motorista.documentos.tsx'],
  ['Corridas', 'Motorista', 'motorista/assinatura', 'sources/apois-corridas-motorista-admin/src/routes/motorista.assinatura.tsx'],
  ['Corridas', 'Motorista', 'motorista/configuracoes', 'sources/apois-corridas-motorista-admin/src/routes/motorista.configuracoes.tsx'],
  ['Corridas', 'Motorista', 'motorista/seguranca', 'sources/apois-corridas-motorista-admin/src/routes/motorista.seguranca.tsx'],
  ['Corridas', 'Motorista', 'motorista/notificacoes', 'sources/apois-corridas-motorista-admin/src/routes/motorista.notificacoes.tsx'],
  ['Corridas', 'Motorista', 'motorista/suporte', 'sources/apois-corridas-motorista-admin/src/routes/motorista.suporte.tsx'],
  ['Corridas', 'Motorista', 'motorista/regalias', 'sources/apois-corridas-motorista-admin/src/routes/motorista.regalias.tsx'],
  ['Corridas', 'Motorista', 'motorista/status', 'sources/apois-corridas-motorista-admin/src/routes/motorista.status.tsx'],
  ['Corridas', 'Motorista', 'motorista/preferencias-notificacoes', 'sources/apois-corridas-motorista-admin/src/routes/motorista.preferencias-notificacoes.tsx'],
  ['Corridas', 'Motorista', 'motorista/app', 'sources/apois-corridas-motorista-admin/src/routes/motorista.app.tsx'],
  ['Corridas', 'Motorista', 'motorista/privacidade', 'sources/apois-corridas-motorista-admin/src/routes/motorista.privacidade.tsx'],
  ['Corridas', 'Motorista', 'motorista/termos', 'sources/apois-corridas-motorista-admin/src/routes/motorista.termos.tsx'],
  ['Corridas', 'Admin', 'admin/login', 'sources/apois-corridas-motorista-admin/src/routes/admin.login.tsx'],
  ['Corridas', 'Admin', 'admin/dashboard', 'sources/apois-corridas-motorista-admin/src/routes/admin.dashboard.tsx'],
  ['Corridas', 'Admin', 'admin/motoristas', 'sources/apois-corridas-motorista-admin/src/routes/admin.motoristas.tsx'],
  ['Corridas', 'Admin', 'admin/passageiros', 'sources/apois-corridas-motorista-admin/src/routes/admin.passageiros.tsx'],
  ['Corridas', 'Admin', 'admin/corridas', 'sources/apois-corridas-motorista-admin/src/routes/admin.corridas.tsx'],
  ['Corridas', 'Admin', 'admin/operacoes', 'sources/apois-corridas-motorista-admin/src/routes/admin.operacoes.tsx'],
  ['Corridas', 'Admin', 'admin/mapa', 'sources/apois-corridas-motorista-admin/src/routes/admin.mapa.tsx'],
  ['Corridas', 'Admin', 'admin/financeiro', 'sources/apois-corridas-motorista-admin/src/routes/admin.financeiro.tsx'],
  ['Corridas', 'Admin', 'admin/financeiro-motoristas', 'sources/apois-corridas-motorista-admin/src/routes/admin.financeiro-motoristas.tsx'],
  ['Corridas', 'Admin', 'admin/pagamentos', 'sources/apois-corridas-motorista-admin/src/routes/admin.pagamentos.tsx'],
  ['Corridas', 'Admin', 'admin/assinaturas', 'sources/apois-corridas-motorista-admin/src/routes/admin.assinaturas.tsx'],
  ['Corridas', 'Admin', 'admin/precos', 'sources/apois-corridas-motorista-admin/src/routes/admin.precos.tsx'],
  ['Corridas', 'Admin', 'admin/categorias', 'sources/apois-corridas-motorista-admin/src/routes/admin.categorias.tsx'],
  ['Corridas', 'Admin', 'admin/cupons', 'sources/apois-corridas-motorista-admin/src/routes/admin.cupons.tsx'],
  ['Corridas', 'Admin', 'admin/administradores', 'sources/apois-corridas-motorista-admin/src/routes/admin.administradores.tsx'],
  ['Corridas', 'Admin', 'admin/notificacoes', 'sources/apois-corridas-motorista-admin/src/routes/admin.notificacoes.tsx'],
  ['Corridas', 'Admin', 'admin/relatorios', 'sources/apois-corridas-motorista-admin/src/routes/admin.relatorios.tsx'],
  ['Corridas', 'Admin', 'admin/analytics', 'sources/apois-corridas-motorista-admin/src/routes/admin.analytics.tsx'],
  ['Corridas', 'Admin', 'admin/logs', 'sources/apois-corridas-motorista-admin/src/routes/admin.logs.tsx'],
  ['Corridas', 'Admin', 'admin/seguranca', 'sources/apois-corridas-motorista-admin/src/routes/admin.seguranca.tsx'],
  ['Corridas', 'Admin', 'admin/suporte', 'sources/apois-corridas-motorista-admin/src/routes/admin.suporte.tsx'],
  ['Corridas', 'Admin', 'admin/backups', 'sources/apois-corridas-motorista-admin/src/routes/admin.backups.tsx'],
  ['Corridas', 'Admin', 'admin/configuracoes', 'sources/apois-corridas-motorista-admin/src/routes/admin.configuracoes.tsx'],
];

const out = [];
for (const [app, mod, route, file] of ROUTES) {
  const full = resolve(file);
  if (!existsSync(full)) { out.push({ app, mod, route, file, missing: true }); continue; }
  const src = readFileSync(full, 'utf8');
  const lines = src.split('\n');
  const count = (re) => (src.match(re) || []).length;
  const handlers = [...new Set([...src.matchAll(/(?:const|function)\s+(\w+)\s*=\s*(?:useCallback\s*\(|async\s*\(|\([^)]*\)\s*=>|function)/g)].map(m => m[1]))];
  const onClick = [...new Set([...src.matchAll(/onClick=\{[^}]*?(\w+)\s*\(/g)].map(m => m[1]))];
  const rpc = [...new Set([...src.matchAll(/\.rpc\(\s*["'`]([A-Za-z0-9_]+)/g)].map(m => m[1]))];
  const fn = [...new Set([...src.matchAll(/functions\.invoke\(\s*["'`]([A-Za-z0-9_-]+)/g)].map(m => m[1]))];
  const tables = [...new Set([...src.matchAll(/\.from\(\s*["'`]([A-Za-z0-9_]+)/g)].map(m => m[1]))];
  const nav = [...new Set([...src.matchAll(/navigate\(\{\s*to:\s*["'`]([^"'`]+)/g)].map(m => m[1]))];
  const to = [...new Set([...src.matchAll(/to="(\/[^"]*)"/g)].map(m => m[1]))];
  const todo = count(/TODO|FIXME|XXX|implementar|not implemented/gi);
  out.push({
    app, mod, route, file, lines: lines.length,
    inputs: count(/<Input\b/g), buttons: count(/<button\b/g), links: count(/<Link\b/g),
    dialogs: count(/<Dialog|AlertDialog|Sheet|Drawer/g),
    useEffects: count(/useEffect\(/g), useCallbacks: count(/useCallback\(/g),
    handlers: handlers.slice(0, 14), onClick: onClick.slice(0, 14),
    rpc, edge: fn, tables: tables.slice(0, 12), nav: [...new Set([...nav, ...to])].slice(0, 14),
    todoMarkers: todo,
    hasLoading: /isLoading|loading|Loader2/.test(src),
    hasErrorState: /error|Erro|toast\.error/.test(src),
    hasEmptyState: /Nenhum|não há|vazio|empty/i.test(src),
    missing: false,
  });
}
console.log(JSON.stringify(out));
