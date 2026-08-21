import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/lib/courier-push.ts');
let source = readFileSync(path, 'utf8');

const oldRpc = '(supabase.rpc as any)("register_courier_push_device", {\n    _token: normalized,\n    _platform: "android",\n  })';
const newRpc = '(supabase.rpc as any)("register_courier_push_device_v2", {\n    _token: normalized,\n    _platform: "android",\n    _app_package: "br.com.apois.parceiro",\n  })';
if (source.includes(oldRpc)) source = source.replace(oldRpc, newRpc);
if (!source.includes(newRpc)) throw new Error('Entregador Parceiro: registro Push não usa package br.com.apois.parceiro.');

// Dentro do bundle aninhado, /courier é uma rota absoluta inválida do filesystem.
// O listener local apenas força atualização da própria tela; troca entre módulos
// é tratada pelo shell Parceiro.
const oldNavigation = '        if (window.location.pathname !== "/courier") window.location.assign("/courier");';
const newNavigation = '        window.dispatchEvent(new CustomEvent("apois:courier-push-open", { detail: action.notification.data ?? null }));';
if (source.includes(oldNavigation)) source = source.replace(oldNavigation, newNavigation);
if (source.includes('window.location.assign("/courier")')) throw new Error('Entregador Parceiro: navegação Push absoluta /courier permaneceu no bundle.');

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: token FCM registra package próprio e não navega para rota absoluta inválida.');
