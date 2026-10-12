import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const driverWorkspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const courierWorkspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const logoB64Path = resolve(root, 'superapp/branding/apois-client-red-logo.b64');

function read(path) { return readFileSync(resolve(root, path), 'utf8'); }
function write(path, value) { writeFileSync(resolve(root, path), value, 'utf8'); }
function must(source, markers, label) {
  const missing = markers.filter((m) => !source.includes(m));
  if (missing.length) throw new Error('[FAIL] ' + label + ': ' + missing.join(' | '));
}

if (!existsSync(logoB64Path)) throw new Error('[FAIL] logo oficial APOIS ausente');
const logoB64 = readFileSync(logoB64Path, 'utf8').trim();
if (!logoB64) throw new Error('[FAIL] logo oficial APOIS vazia');

// ---------------- Motorista: login totalmente claro e compacto ----------------
{
  const logoModule = driverWorkspace + '/src/assets/apoisPartnerLogoData.ts';
  write(logoModule, '// APOIS_PARTNER_AUTH_LOGO_V17\nexport const APOIS_PARTNER_LOGO_DATA_URL = "data:image/png;base64,' + logoB64 + '";\n');

  const loginPath = driverWorkspace + '/src/routes/motorista.login.tsx';
  let source = read(loginPath);

  source = source
    .replace('import { MovviLogo } from "@/components/MovviLogo";', 'import { APOIS_PARTNER_LOGO_DATA_URL } from "@/assets/apoisPartnerLogoData";')
    .replace(
      /<main className="relative min-h-\[100dvh\][^"]*">/,
      '<main data-apois-partner-auth-v17 className="relative min-h-[100dvh] min-w-0 overflow-x-hidden overflow-y-auto bg-[#F7F7F8] text-[#111827]">'
    )
    .replace(
      '<div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at 50% 14%, rgba(246,190,28,0.18) 0%, rgba(246,190,28,0.035) 24%, transparent 48%), linear-gradient(180deg,#090a0c 0%,#030405 54%,#000 100%)" }} />',
      '<div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at 50% 2%, rgba(229,27,35,0.10) 0%, rgba(229,27,35,0.025) 30%, transparent 54%), linear-gradient(180deg,#FFFFFF 0%,#F7F7F8 52%,#F3F4F6 100%)" }} />'
    )
    .replace(
      '<div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[36vh] opacity-25" style={{ background: "linear-gradient(180deg,transparent,rgba(246,190,28,.06))" }} />',
      '<div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[28vh] opacity-70" style={{ background: "linear-gradient(180deg,transparent,rgba(229,27,35,.025))" }} />'
    )
    .replace(
      '<header className="flex justify-center pt-1"><MovviLogo size={112} showTagline productLabel="" /></header>',
      '<header className="flex justify-center pt-1"><div className="flex h-[92px] w-[92px] items-center justify-center rounded-[28px] bg-white p-2 shadow-[0_18px_45px_-28px_rgba(17,24,39,.45)] ring-1 ring-[#E5E7EB]"><img src={APOIS_PARTNER_LOGO_DATA_URL} alt="APOIS" className="h-full w-full object-contain" /></div></header>'
    )
    .replace(
      'className="break-words text-[clamp(27px,9vw,31px)] font-black leading-[1.08] tracking-[-0.04em]"',
      'className="break-words text-center text-[clamp(26px,8vw,30px)] font-black leading-[1.08] tracking-[-0.035em] text-[#111827]"'
    )
    .replaceAll('text-[#F6BE1C]', 'text-[#E51B23]')
    .replaceAll('focus-visible:ring-[#F6BE1C]', 'focus-visible:ring-[#E51B23]')
    .replaceAll('focus-within:border-[#F6BE1C]/55', 'focus-within:border-[#E51B23]/55')
    .replaceAll('focus-within:ring-[#F6BE1C]/20', 'focus-within:ring-[#E51B23]/15')
    .replaceAll('bg-[#F6BE1C]', 'bg-[#E51B23]')
    .replaceAll('rgba(246,190,28,0.9)', 'rgba(229,27,35,0.35)')
    .replaceAll('border-white/12 bg-[#101214]/95', 'border-[#D9DDE3] bg-white')
    .replaceAll('border-white/8 bg-[#0D0F11]/95', 'border-[#E2E5EA] bg-white')
    .replaceAll('text-white outline-none placeholder:text-zinc-600', 'text-[#111827] outline-none placeholder:text-[#8B929C]')
    .replaceAll('text-zinc-400', 'text-[#5F6670]')
    .replaceAll('text-zinc-500', 'text-[#6B7280]')
    .replaceAll('hover:bg-white/5 hover:text-white', 'hover:bg-[#F3F4F6] hover:text-[#111827]')
    .replaceAll('font-black text-white">Sua segurança', 'font-black text-[#111827]">Sua segurança')
    .replace('className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#E51B23] px-4 py-3 text-center text-[16px] font-black leading-5 text-black',
             'className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#E51B23] px-4 py-3 text-center text-[16px] font-black leading-5 text-white');

  // Mantém o Google visualmente coerente com o login claro.
  source = source.replace(
    'className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[17px] border border-white/12 bg-white px-4 py-3 text-[14px] font-black text-black disabled:opacity-60"',
    'className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[18px] border border-[#D9DDE3] bg-white px-4 py-3 text-[14px] font-black text-[#111827] shadow-sm disabled:opacity-60"'
  );

  must(source, ['data-apois-partner-auth-v17','APOIS_PARTNER_LOGO_DATA_URL','bg-[#F7F7F8]','bg-[#E51B23]'], 'login Motorista visual v17');
  if (source.includes('MovviLogo') || source.includes('#F6BE1C') || source.includes('#C88A08')) {
    throw new Error('[FAIL] login Motorista ainda contém identidade visual antiga');
  }
  write(loginPath, source);

  const googlePath = driverWorkspace + '/src/components/DriverGoogleLoginButton.tsx';
  if (existsSync(resolve(root, googlePath))) {
    let google = read(googlePath)
      .replace('className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[17px] border border-white/12 bg-white px-4 py-3 text-[14px] font-black text-black disabled:opacity-60"',
               'className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[18px] border border-[#D9DDE3] bg-white px-4 py-3 text-[14px] font-black text-[#111827] shadow-sm disabled:opacity-60"');
    write(googlePath, google);
  }
}

// ---------------- Entregador: login claro, logo oficial e sem hero legado escuro ----------------
{
  const logoModule = courierWorkspace + '/src/assets/apoisPartnerLogoData.ts';
  write(logoModule, '// APOIS_PARTNER_AUTH_LOGO_V17\nexport const APOIS_PARTNER_LOGO_DATA_URL = "data:image/png;base64,' + logoB64 + '";\n');

  const loginPath = courierWorkspace + '/src/routes/login.tsx';
  let source = read(loginPath);
  if (!source.includes('APOIS_PARTNER_LOGO_DATA_URL')) {
    source = source.replace(
      'import deliveryHeroAsset from "@/assets/delivery-hero.png.asset.json";',
      'import deliveryHeroAsset from "@/assets/delivery-hero.png.asset.json";\nimport { APOIS_PARTNER_LOGO_DATA_URL } from "@/assets/apoisPartnerLogoData";'
    );
  }

  source = source
    .replaceAll('src={logoAsset.url}', 'src={APOIS_PARTNER_LOGO_DATA_URL}')
    .replaceAll('alt="APOIS ENTREGA"', 'alt="APOIS"')
    .replace('import logoAsset from "@/assets/logo.png.asset.json";\n', '')
    .replace(
      /<div className="relative min-h-dvh w-full overflow-x-hidden[^"]*">/,
      '<div data-apois-partner-auth-v17 className="relative min-h-dvh w-full overflow-x-hidden bg-[#F7F7F8] text-[#111827]">'
    )
    .replace('className="h-full w-full scale-105 object-cover object-center opacity-55 saturate-[0.8]"',
             'className="h-full w-full scale-105 object-cover object-center opacity-[0.13] saturate-[0.55]"')
    .replace('className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12)_0%,rgba(0,0,0,0.62)_54%,#000_100%)]"',
             'className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(247,247,248,0.78)_46%,#F7F7F8_100%)]"')
    .replace('className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(200,138,8,0.28),transparent_30%)]"',
             'className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(229,27,35,0.12),transparent_30%)]"')
    .replace('className="absolute inset-0 bg-[radial-gradient(circle_at_24%_30%,rgba(246,190,28,0.12),transparent_24%)]"',
             'className="absolute inset-0 bg-[radial-gradient(circle_at_24%_30%,rgba(229,27,35,0.06),transparent_24%)]"')
    .replace('className="-ml-2 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/35 backdrop-blur-md transition-colors active:bg-white/10"',
             'className="-ml-2 grid h-11 w-11 place-items-center rounded-full border border-[#D9DDE3] bg-white text-[#111827] shadow-sm transition active:scale-95"')
    .replace('<ChevronLeft className="h-5 w-5 text-white" />','<ChevronLeft className="h-5 w-5 text-[#111827]" />')
    .replace('className="flex items-center gap-1.5 rounded-full border border-accent/35 bg-black/45 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-white backdrop-blur-md"',
             'className="flex items-center gap-1.5 rounded-full border border-[#E51B23]/25 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#111827] shadow-sm"')
    .replace('src={logoAsset.url}\n              alt="APOIS ENTREGA"\n              className="h-20 w-auto max-w-[72vw] object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)]"',
             'src={APOIS_PARTNER_LOGO_DATA_URL}\n              alt="APOIS"\n              className="h-[88px] w-[88px] rounded-[28px] bg-white p-2 object-contain shadow-[0_18px_45px_-28px_rgba(17,24,39,.45)] ring-1 ring-[#E5E7EB]"')
    .replace('className="mt-1 rounded-[2rem] border border-accent/30 bg-[#090909]/94 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.7),0_0_45px_rgba(200,138,8,0.14)] backdrop-blur-xl sm:p-6"',
             'className="mt-2 rounded-[28px] border border-[#E2E5EA] bg-white p-5 shadow-[0_24px_70px_-38px_rgba(17,24,39,.55)] sm:p-6"')
    .replaceAll('text-accent', 'text-[#E51B23]')
    .replaceAll('text-primary', 'text-[#E51B23]')
    .replaceAll('text-white', 'text-[#111827]')
    .replaceAll('text-zinc-400', 'text-[#5F6670]')
    .replaceAll('text-zinc-500', 'text-[#6B7280]')
    .replaceAll('text-zinc-600', 'text-[#8B929C]')
    .replaceAll('border-zinc-800 bg-black/65', 'border-[#D9DDE3] bg-[#FAFAFB]')
    .replaceAll('focus:border-accent focus:ring-accent', 'focus:border-[#E51B23] focus:ring-[#E51B23]/15')
    .replaceAll('rgba(246,190,28,0.22)', 'rgba(229,27,35,0.24)')
    .replaceAll('rgba(200,138,8,0.15)', 'rgba(201,20,27,0.16)')
    .replace('className="h-14 w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-base font-black uppercase tracking-[0.06em] text-[#111827]',
             'className="h-14 w-full rounded-2xl bg-[#E51B23] text-base font-black uppercase tracking-[0.06em] text-white')
    .replace('className="flex h-[54px] w-full items-center justify-center gap-3 rounded-[18px] border border-white/10 bg-white text-[15px] font-bold text-black transition-all active:scale-[0.985] disabled:opacity-60"',
             'className="flex h-[54px] w-full items-center justify-center gap-3 rounded-[18px] border border-[#D9DDE3] bg-white text-[15px] font-bold text-[#111827] shadow-sm transition-all active:scale-[0.985] disabled:opacity-60"');

  must(source, ['data-apois-partner-auth-v17','APOIS_PARTNER_LOGO_DATA_URL','bg-[#F7F7F8]','bg-[#E51B23]'], 'login Entregador visual v17');
  if (source.includes('src={logoAsset.url}') || source.includes('alt="APOIS ENTREGA"')) {
    throw new Error('[FAIL] login Entregador ainda usa logo antiga/quebrável');
  }
  write(loginPath, source);

  const googlePath = courierWorkspace + '/src/components/GoogleLoginButton.tsx';
  if (existsSync(resolve(root, googlePath))) {
    let google = read(googlePath)
      .replace('className="flex h-[54px] w-full items-center justify-center gap-3 rounded-[18px] border border-white/10 bg-white text-[15px] font-bold text-black transition-all active:scale-[0.985] disabled:opacity-60"',
               'className="flex h-[54px] w-full items-center justify-center gap-3 rounded-[18px] border border-[#D9DDE3] bg-white text-[15px] font-bold text-[#111827] shadow-sm transition-all active:scale-[0.985] disabled:opacity-60"');
    write(googlePath, google);
  }

  const splashPath = courierWorkspace + '/src/components/ApoisLaunchSplash.tsx';
  if (existsSync(resolve(root, splashPath))) {
    let splash = read(splashPath)
      .replace('className="apois-launch fixed inset-0 z-[9999] grid place-items-center overflow-hidden bg-black text-white"',
               'className="apois-launch fixed inset-0 z-[9999] grid place-items-center overflow-hidden bg-[#F7F7F8] text-[#111827]"')
      .replace('className="apois-launch-glow absolute h-72 w-72 rounded-full bg-accent/25 blur-3xl"',
               'className="apois-launch-glow absolute h-72 w-72 rounded-full bg-[#E51B23]/10 blur-3xl"')
      .replace('className="apois-launch-orbit absolute h-72 w-72 rounded-full border border-accent/20"',
               'className="apois-launch-orbit absolute h-72 w-72 rounded-full border border-[#E51B23]/10"')
      .replace('className="apois-launch-orbit apois-launch-orbit-2 absolute h-52 w-52 rounded-full border border-primary/25"',
               'className="apois-launch-orbit apois-launch-orbit-2 absolute h-52 w-52 rounded-full border border-[#E51B23]/15"')
      .replace('className="apois-launch-mark relative grid h-28 w-28 place-items-center overflow-hidden rounded-[2rem] border border-accent/40 bg-[#111111] shadow-[0_0_70px_rgba(200,138,8,0.28)]"',
               'className="apois-launch-mark relative grid h-28 w-28 place-items-center overflow-hidden rounded-[2rem] border border-[#E2E5EA] bg-white p-2 shadow-[0_22px_70px_-38px_rgba(17,24,39,.55)]"')
      .replace('src="/apois-app-icon.png"', 'src={APOIS_PARTNER_LOGO_DATA_URL}')
      .replace('className="h-full w-full object-cover"', 'className="h-full w-full object-contain"')
      .replace('className="apois-launch-pulse absolute right-2 top-2 h-3.5 w-3.5 rounded-full bg-primary shadow-[0_0_22px_rgba(246,190,28,0.92)]"',
               'className="apois-launch-pulse absolute right-2 top-2 h-3.5 w-3.5 rounded-full bg-[#E51B23] shadow-[0_0_22px_rgba(229,27,35,0.35)]"')
      .replace('className="apois-launch-brand bg-gradient-to-r from-primary to-accent bg-clip-text text-[2.05rem] font-black tracking-[0.26em] text-transparent"',
               'className="apois-launch-brand text-[2.05rem] font-black tracking-[0.26em] text-[#E51B23]"')
      .replace('className="apois-launch-label mt-2 text-[0.68rem] font-black tracking-[0.48em] text-zinc-300"',
               'className="apois-launch-label mt-2 text-[0.68rem] font-black tracking-[0.48em] text-[#3F4650]"')
      .replace('className="mt-10 h-[2px] w-36 overflow-hidden rounded-full bg-zinc-900"',
               'className="mt-10 h-[2px] w-36 overflow-hidden rounded-full bg-[#E5E7EB]"')
      .replace('className="apois-launch-line h-full w-1/2 rounded-full bg-gradient-to-r from-primary to-accent"',
               'className="apois-launch-line h-full w-1/2 rounded-full bg-[#E51B23]"')
      .replace('className="apois-launch-copy mt-4 text-[0.68rem] font-semibold tracking-[0.14em] text-zinc-500"',
               'className="apois-launch-copy mt-4 text-[0.68rem] font-semibold tracking-[0.14em] text-[#6B7280]"');
    if (!splash.includes('APOIS_PARTNER_LOGO_DATA_URL')) {
      splash = splash.replace('import { useEffect, useMemo, useState } from "react";',
        'import { useEffect, useMemo, useState } from "react";\nimport { APOIS_PARTNER_LOGO_DATA_URL } from "../assets/apoisPartnerLogoData";');
    }
    write(splashPath, splash);
  }

  const rootPath = courierWorkspace + '/src/routes/__root.tsx';
  let rootSource = read(rootPath)
    .replace('<html lang="pt-BR" className="dark apois-system-theme">','<html lang="pt-BR" className="light apois-system-theme">')
    .replace('<body className="bg-black antialiased">','<body className="bg-[#F7F7F8] antialiased">')
    .replace('<div className="min-h-dvh w-full bg-black">{children}</div>','<div className="min-h-dvh w-full bg-[#F7F7F8]">{children}</div>')
    .replace('toast: "border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl",','toast: "border border-[#E2E5EA] bg-white text-[#111827] shadow-xl",')
    .replace('description: "text-zinc-300",','description: "text-[#5F6670]",');
  must(rootSource, ['className="light apois-system-theme"','bg-[#F7F7F8]'], 'root Entregador claro v17');
  write(rootPath, rootSource);
}

console.log('[OK] Partner auth visual v17: Motorista e Entregador usam uma única linguagem clara, logo oficial, CTA vermelho e autenticação preservada.');
