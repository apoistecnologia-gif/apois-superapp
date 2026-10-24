// APOIS_CLIENT_PROFILE_EDIT_V1
// Abre edicao para Nome/Cidade, Telefone e E-mail sem tocar na autenticacao
// nem permitir atualizar colunas protegidas, permissao/RLS ou contas alheias.
// Aplicar apos o hardener visual e as acoes do perfil. Idempotente.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const work = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas');
const routePath = resolve(work, 'src/routes/_authenticated.perfil.tsx');
const editorPath = resolve(work, 'src/components/profile/PassengerProfileEditor.tsx');
const before = readFileSync(routePath,'utf8');
function replaceOnce(s, oldText, newText, label) {
  if (s.includes(newText)) return s;
  const count=s.split(oldText).length-1;
  if(count!==1)throw new Error('[FAIL] Perfil editavel: '+label+' (ocorrencias '+count+')');
  return s.replace(oldText,newText);
}
let source = before;
if(!source.includes('APOIS_CLIENT_PROFILE_EDIT_V1')) {
  if(!source.includes('onClick?: () => void;')) {
    throw new Error('[FAIL] Perfil editavel: as acoes seguras de MenuLink devem ser aplicadas antes');
  }
  source = replaceOnce(
    source, 'import { createFileRoute, useNavigate } from "@tanstack/react-router";',
    'import { createFileRoute, useNavigate } from "@tanstack/react-router";\nimport { useState } from "react";\nimport { PassengerProfileEditor, type PassengerProfileField } from "@/components/profile/PassengerProfileEditor";',
    'imports perfil',
  );
  source = replaceOnce(
    source, '  const { user, profile, signOut } = useAuth();',
    '  const { user, profile, signOut, refreshSession } = useAuth();',
    'refresh seguro',
  );
  source = replaceOnce(
    source, '  const currentProfile = normalizeProfile(profile, user?.email);',
    '  const currentProfile = normalizeProfile(profile, user?.email);\n  const [editingField, setEditingField] = useState<PassengerProfileField | null>(null); // APOIS_CLIENT_PROFILE_EDIT_V1',
    'estado editor',
  );
  source = replaceOnce(
    source, '              label="Dados Pessoais"\n              value={currentProfile.name}\n            />',
    '              label="Dados Pessoais"\n              value={currentProfile.name}\n              onClick={() => setEditingField("name")}\n            />',
    'acao editar nome',
  );
  source = replaceOnce(
    source, '              label="Telefone"\n              value={currentProfile.phone ?? ""}\n            />',
    '              label="Telefone"\n              value={currentProfile.phone ?? ""}\n              onClick={() => setEditingField("phone")}\n            />',
    'acao editar telefone',
  );
  source = replaceOnce(
    source, '<MenuLink icon={<Mail size={20} />} label="E-mail" value={user?.email ?? ""} />',
    '<MenuLink icon={<Mail size={20} />} label="E-mail" value={user?.email ?? ""} onClick={() => setEditingField("email")} />',
    'acao editar e-mail',
  );
  source = replaceOnce(
    source, '        <div className="p-6 mt-4">',
    '        <PassengerProfileEditor\n          field={editingField}\n          profile={profile}\n          authUserId={user?.id ?? null}\n          currentEmail={user?.email ?? ""}\n          onClose={() => setEditingField(null)}\n          onSaved={refreshSession}\n        />\n        <div className="p-6 mt-4">',
    'dialog de editar no perfil',
  );
}
for (const token of [
  'APOIS_CLIENT_PROFILE_EDIT_V1',
  'setEditingField("name")',
  'setEditingField("phone")',
  'setEditingField("email")',
  '<PassengerProfileEditor',
  'onSaved={refreshSession}',
]) if(!source.includes(token)) throw Error('[FAIL] Perfil editavel: faltando '+token);

const component=String.raw`import { AlertCircle, CheckCircle2, Loader2, Mail, MapPin, Phone, UserRound, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AuthProfile } from "@/hooks/use-auth";

// APOIS_CLIENT_PROFILE_EDIT_V1: usa auth.users para E-mail; public.users
// apenas para name, phone e city autorizados na politica users_update_own.
export type PassengerProfileField = "name" | "phone" | "email";

interface ProfileEditorProps {
  field: PassengerProfileField | null;
  profile: AuthProfile | null;
  authUserId: string | null;
  currentEmail: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function PassengerProfileEditor({
  field, profile, authUserId, currentEmail, onClose, onSaved,
}: ProfileEditorProps) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.name ?? profile?.full_name ?? "");
    setCity(profile?.city ?? "");
    setPhone(profile?.phone ?? "");
    setEmail(currentEmail);
    setError(null);
    setSuccess(null);
    setBusy(false);
  }, [field, profile?.id, profile?.name, profile?.full_name, profile?.city, profile?.phone, currentEmail]);

  if (!field) return null;

  const isEmail = field === "email";
  const title = field === "name" ? "Editar dados pessoais" : field === "phone" ? "Editar telefone" : "Alterar e-mail";

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || success) return;
    setError(null);
    if (!authUserId || !profile?.id) {
      setError("Não foi possível identificar sua conta. Entre novamente ou tente mais tarde.");
      return;
    }
    const cleanName = name.trim().replace(/s+/g, " ");
    const cleanCity = city.trim().replace(/s+/g, " ");
    const cleanPhone = phone.replace(/D/g, "");
    const cleanEmail = email.trim().toLowerCase();

    if (field === "name" && (cleanName.length < 2 || cleanName.length > 100 || cleanCity.length > 100)) {
      setError("Informe um nome de 2 a 100 caracteres e uma cidade de até 100 caracteres.");
      return;
    }
    if (field === "phone" && !/^d{10,13}$/.test(cleanPhone)) {
      setError("Informe o telefone com DDD (10 a 13 números).");
      return;
    }
    if (isEmail && !/^[^s@]+@[^s@]+.[^s@]+$/.test(cleanEmail)) {
      setError("Informe um endereço de e-mail válido.");
      return;
    }
    if (isEmail && cleanEmail === currentEmail.trim().toLowerCase()) {
      setError("Esse já é o e-mail cadastrado.");
      return;
    }

    setBusy(true);
    try {
      if (isEmail) {
        // Não escrever public.users.email (coluna protegida). A confirmação
        // e a aplicação da mudança são responsabilidade do Supabase Auth.
        const { error: emailError } = await supabase.auth.updateUser({ email: cleanEmail });
        if (emailError) throw emailError;
        setSuccess("Solicitação recebida. Confira as mensagens de confirmação que o serviço de autenticação enviar. O e-mail atual continuará válido até a alteração ser concluída.");
      } else {
        const fields = field === "name"
          ? { name: cleanName, city: cleanCity || null }
          : { phone: cleanPhone };
        // auth_user_id nunca é alterado; a condição dupla protege o vínculo
        // auth ↔ perfil de domínio e a política RLS faz a checagem final.
        const { data, error: updateError } = await supabase
          .from("users")
          .update(fields)
          .eq("id", profile.id)
          .eq("auth_user_id", authUserId)
          .select("id")
          .maybeSingle();
        if (updateError) throw updateError;
        if (!data) throw new Error("O servidor não confirmou a atualização dos seus dados.");
        await onSaved();
        setSuccess("Seus dados foram atualizados com sucesso.");
      }
    } catch (cause) {
      console.error("[APOIS Profile] Update rejected", cause instanceof Error ? cause.message : "unknown");
      setError("Não foi possível salvar a alteração. Verifique a conexão ou suas permissões e tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 sm:items-center" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apois-profile-editor-title"
        className="max-h-[94dvh] w-full max-w-[460px] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-5 text-[#111827] shadow-2xl sm:rounded-[28px]"
      >
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#D71920]">Minha conta APOIS</p>
            <h2 id="apois-profile-editor-title" className="mt-1 text-2xl font-black">{title}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fechar edição"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#F3F4F6] text-[#505966] disabled:opacity-40">
            <X size={21} />
          </button>
        </header>
        <form className="space-y-4" onSubmit={(event) => void save(event)}>
          {field === "name" ? (
            <>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold"><UserRound size={17} /> Nome completo</span>
                <input required autoComplete="name" type="text" minLength={2} maxLength={100}
                  value={name} onChange={(event) => setName(event.target.value)} disabled={busy || Boolean(success)}
                  className="h-14 w-full rounded-2xl border border-[#DCE0E5] bg-white px-4 py-3 text-[16px] text-[#111827] outline-none focus:border-[#E51B23]" />
              </label>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold"><MapPin size={17} /> Cidade</span>
                <input autoComplete="address-level2" type="text" maxLength={100}
                  value={city} onChange={(event) => setCity(event.target.value)} disabled={busy || Boolean(success)}
                  className="w-full rounded-2xl border border-[#DCE0E5] bg-white px-4 py-3 text-[16px] text-[#111827] outline-none focus:border-[#E51B23]" />
              </label>
            </>
          ) : field === "phone" ? (
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold"><Phone size={17} /> Telefone com DDD</span>
              <input required type="tel" inputMode="tel" autoComplete="tel" maxLength={22}
                value={phone} onChange={(event) => setPhone(event.target.value)} disabled={busy || Boolean(success)}
                placeholder="(87) 99999-9999"
                className="w-full rounded-2xl border border-[#DCE0E5] bg-white px-4 py-3 text-[16px] text-[#111827] outline-none focus:border-[#E51B23]" />
            </label>
          ) : (
            <>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold"><Mail size={17} /> Novo e-mail</span>
                <input required type="email" inputMode="email" autoCapitalize="none" autoComplete="email"
                  value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy || Boolean(success)}
                  className="w-full rounded-2xl border border-[#DCE0E5] bg-white px-4 py-3 text-[16px] text-[#111827] outline-none focus:border-[#E51B23]" />
              </label>
              <p className="rounded-xl bg-[#FFF7F7] p-3 text-xs leading-relaxed text-[#6B3A3E]">
                Por segurança, o serviço de autenticação poderá enviar mensagens ao e-mail atual e ao novo. A alteração somente será concluída após as confirmações exigidas.
              </p>
            </>
          )}
          {error ? (
            <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-[#B91C1C]">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />{error}
            </div>
          ) : null}
          {success ? (
            <div role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-[#166534]">
              <CheckCircle2 size={19} className="mt-0.5 shrink-0" />{success}
            </div>
          ) : null}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={busy}
              className="min-h-12 flex-1 rounded-2xl border border-[#DCE0E5] bg-white px-4 text-sm font-bold text-[#374151] disabled:opacity-50">
              {success ? "Fechar" : "Cancelar"}
            </button>
            {!success ? (
              <button type="submit" disabled={busy} className="flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-[#E51B23] px-4 text-sm font-black text-white disabled:opacity-50">
                {busy ? <Loader2 size={18} className="animate-spin" /> : null}
                {isEmail ? "Solicitar alteração" : "Salvar alterações"}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
`;
mkdirSync(dirname(editorPath),{recursive:true});
writeFileSync(editorPath,component,'utf8');
writeFileSync(routePath,source,'utf8');
console.log('[OK] APOIS_CLIENT_PROFILE_EDIT_V1: Nome/Cidade, Telefone e E-mail editaveis com autorizacao e confirmacao separadas.');
