import { Camera, Loader2, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

// APOIS_PASSENGER_PHOTO_QA216_V1: upload only to authenticated owner's existing
// private Storage folder, then update only public.users.avatar_url with RLS.
// Do not expose a public bucket, service credentials or protected profile data.
type Props = {
  avatarSource?: string | undefined;
  name: string;
  authUserId?: string | undefined;
  profileId?: string | undefined;
  onSaved: () => Promise<void>;
};

const BUCKET = "profile-photos";
const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024;

export function PassengerProfilePhoto({ avatarSource, name, authUserId, profileId, onSaved }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const raw = (avatarSource ?? "").trim();
    setImageUrl(null);
    if (!raw) return () => { active = false; };
    if (/^https:\/\//i.test(raw)) {
      setImageUrl(raw);
      return () => { active = false; };
    }
    // Stored value is a private bucket path; never use it as an img src.
    void supabase.storage.from(BUCKET).createSignedUrl(raw, 3600)
      .then(({ data, error: signError }) => {
        if (active) setImageUrl(signError ? null : (data?.signedUrl ?? null));
      })
      .catch(() => { if (active) setImageUrl(null); });
    return () => { active = false; };
  }, [avatarSource]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setError(null);
    if (!authUserId || !profileId) {
      setError("Sua sessão ainda não está pronta para alterar a foto.");
      return;
    }
    const extension = MIME_EXTENSION[file.type];
    if (!extension || file.size < 1 || file.size > MAX_BYTES) {
      setError("Escolha uma imagem JPG, PNG ou WEBP de até 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const objectPath = `${authUserId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET).upload(objectPath, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: "3600",
        });
      if (uploadError) throw uploadError;
      const { data: updated, error: profileError } = await supabase
        .from("users")
        .update({ avatar_url: objectPath })
        .eq("id", profileId)
        .eq("auth_user_id", authUserId)
        .select("id")
        .maybeSingle();
      if (profileError || !updated) throw profileError ?? new Error("not_updated");
      await onSaved();
      const { data: signed, error: signedError } = await supabase.storage
        .from(BUCKET).createSignedUrl(objectPath, 3600);
      if (!signedError && signed?.signedUrl) setImageUrl(signed.signedUrl);
    } catch {
      setError("Não foi possível salvar a foto. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div data-apois-passenger-profile-photo-qa216="true" className="mb-4 flex flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-[#E51B23] bg-[#FFF1F2] text-3xl font-bold text-[#E51B23]">
          {imageUrl ? (
            <img src={imageUrl} alt="Sua foto de perfil" className="h-full w-full object-cover"
              onError={() => setImageUrl(null)} />
          ) : <span aria-label="Sem foto de perfil">{name.charAt(0).toUpperCase() || <UserRound size={26} />}</span>}
        </div>
        <button type="button" aria-label={imageUrl ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
          onClick={() => inputRef.current?.click()} disabled={uploading || !authUserId || !profileId}
          className="absolute -bottom-1 -right-1 grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-[#E51B23] text-white shadow-md disabled:opacity-50">
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
          aria-label="Selecionar foto de perfil" className="hidden" disabled={uploading}
          onChange={(event) => void handleFileChange(event)} />
      </div>
      <p className="text-xs font-semibold text-[#626B78]">{uploading ? "Salvando foto..." : "Toque na câmera para alterar a foto"}</p>
      {error ? <p role="alert" className="max-w-xs text-center text-xs font-semibold text-[#B91C1C]">{error}</p> : null}
    </div>
  );
}
