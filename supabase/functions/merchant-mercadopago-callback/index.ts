import { createClient } from "npm:@supabase/supabase-js@2.112.1";

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord { return typeof v === "object" && v !== null && !Array.isArray(v); }
function text(v: unknown): string | null { return typeof v === "string" && v.trim() ? v.trim() : null; }
function b64url(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function fromB64(value: string) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
async function sha256(value: string) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return b64url(new Uint8Array(d)); }
async function keyFromEnv() { const raw=Deno.env.get("MERCADO_PAGO_OAUTH_TOKEN_KEY_BASE64")?.trim(); if(!raw) throw new Error("missing_token_key"); const bytes=fromB64(raw); if(bytes.byteLength!==32) throw new Error("invalid_token_key"); return crypto.subtle.importKey("raw",bytes,"AES-GCM",false,["encrypt","decrypt"]); }
async function encrypt(value:string,key:CryptoKey){ const iv=crypto.getRandomValues(new Uint8Array(12)); const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(value)); return {value:b64(new Uint8Array(cipher)),iv:b64(iv)}; }
async function decrypt(value:string,iv:string,key:CryptoKey){ const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(iv)},key,fromB64(value)); return new TextDecoder().decode(clear); }
function html(title:string,message:string,ok=false){ const accent=ok?"#22c55e":"#f59e0b"; return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Cache-Control" content="no-store"><title>${title}</title><style>body{margin:0;background:#050505;color:#fff;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.card{max-width:520px;border:1px solid #2b2b2b;border-radius:24px;background:#0c0c0c;padding:28px;text-align:center;box-shadow:0 20px 60px #0008}.logo{color:#d4af37;font-weight:900;letter-spacing:.16em}.dot{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;margin:20px auto;background:${accent}22;color:${accent};font-size:28px}h1{font-size:24px}p{color:#aaa;line-height:1.6}</style></head><body><div class="card"><div class="logo">APOIS ENTREGAS</div><div class="dot">${ok?"✓":"!"}</div><h1>${title}</h1><p>${message}</p><p>Você pode fechar esta janela e voltar ao painel do estabelecimento.</p></div><script>setTimeout(()=>{try{window.close()}catch(e){}},2500)</script></body></html>`,{status:ok?200:400,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","Pragma":"no-cache"}}); }

Deno.serve(async (req) => {
  if (req.method !== "GET") return html("Método inválido","A autorização não pôde ser concluída.");
  const url = new URL(req.url);
  const code = text(url.searchParams.get("code"));
  const state = text(url.searchParams.get("state"));
  const providerError = text(url.searchParams.get("error"));
  if (providerError) return html("Autorização cancelada","O Mercado Pago não autorizou a conexão. Você pode tentar novamente pelo painel.");
  if (!code || !state) return html("Autorização incompleta","O retorno do Mercado Pago não contém os dados esperados.");

  const supabaseUrl=Deno.env.get("SUPABASE_URL"); const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId=Deno.env.get("MERCADO_PAGO_OAUTH_CLIENT_ID")?.trim() || Deno.env.get("MERCADO_PAGO_CLIENT_ID")?.trim();
  const clientSecret=Deno.env.get("MERCADO_PAGO_OAUTH_CLIENT_SECRET")?.trim() || Deno.env.get("MERCADO_PAGO_CLIENT_SECRET")?.trim();
  const redirectUri=Deno.env.get("MERCADO_PAGO_MERCHANT_REDIRECT_URI")?.trim() || (supabaseUrl?`${supabaseUrl.replace(/\/$/,"")}/functions/v1/merchant-mercadopago-callback`:null);
  if(!supabaseUrl||!serviceRole||!clientId||!clientSecret||!redirectUri || !redirectUri.startsWith("https://")) return html("Configuração pendente","A integração do Mercado Pago ainda não está completamente configurada no servidor.");
  let key:CryptoKey; try{key=await keyFromEnv();}catch{return html("Configuração pendente","A chave segura de criptografia dos tokens ainda não foi configurada.");}
  const admin=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});

  const stateHash=await sha256(state);
  const {data:oauthState,error:stateError}=await admin.from("merchant_mercadopago_oauth_states").select("*").eq("state_hash",stateHash).is("used_at",null).maybeSingle();
  if(stateError || !oauthState || new Date(oauthState.expires_at).getTime()<=Date.now()) return html("Autorização expirada","Esta tentativa expirou ou já foi utilizada. Inicie uma nova conexão no painel.");

  const usedAt = new Date().toISOString();
  const {error:consumeError}=await admin.from("merchant_mercadopago_oauth_states").update({used_at:usedAt}).eq("id",oauthState.id).is("used_at",null);
  if(consumeError) return html("Autorização expirada","Esta tentativa já foi consumida. Inicie uma nova conexão no painel.");

  const {data:member}=await admin.from("merchant_members").select("merchant_id,role,status").eq("merchant_id",oauthState.merchant_id).eq("user_id",oauthState.user_id).eq("status","active").maybeSingle();
  if(!member || !new Set(["owner","admin","manager"]).has(String(member.role))) return html("Acesso não autorizado","Sua permissão para este estabelecimento mudou. Inicie uma nova conexão no painel.");

  let verifier:string; try{verifier=await decrypt(oauthState.code_verifier_encrypted,oauthState.code_verifier_iv,key);}catch{return html("Falha de segurança","Não foi possível validar esta tentativa de autorização.");}

  const tokenRes=await fetch("https://api.mercadopago.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({client_id:clientId,client_secret:clientSecret,code,grant_type:"authorization_code",redirect_uri:redirectUri,code_verifier:verifier})});
  const raw:unknown=await tokenRes.json().catch(()=>null);
  if(!tokenRes.ok || !isRecord(raw) || !text(raw.access_token)) { console.error("merchant mp oauth token exchange failed",{status:tokenRes.status,merchantId:oauthState.merchant_id}); return html("Falha ao conectar","O Mercado Pago não confirmou a autorização. Tente conectar novamente."); }

  const accessToken=text(raw.access_token)!;
  const refreshToken=text(raw.refresh_token);
  const returnedScope=text(raw.scope);
  if(!refreshToken){
    console.error("merchant mp oauth missing refresh token",{merchantId:oauthState.merchant_id,scope:Boolean(returnedScope)});
    return html("Autorização incompleta","O Mercado Pago não concedeu acesso renovável. Reconecte e autorize o acesso offline solicitado pela APOIS.");
  }

  const expiresIn=Math.max(60,Number(raw.expires_in??15552000));
  const access=await encrypt(accessToken,key);
  const refresh=await encrypt(refreshToken,key);

  let providerUserId = raw.user_id != null ? String(raw.user_id) : null;
  let accountEmail:string|null=null;
  try{
    const meRes=await fetch("https://api.mercadopago.com/users/me",{headers:{Authorization:`Bearer ${accessToken}`,Accept:"application/json"}});
    const me:unknown=await meRes.json().catch(()=>null);
    if(meRes.ok&&isRecord(me)){providerUserId=providerUserId??(me.id!=null?String(me.id):null);accountEmail=text(me.email);}
  }catch{}
  if(!providerUserId){
    console.error("merchant mp oauth seller identity missing",{merchantId:oauthState.merchant_id});
    return html("Falha ao identificar conta","A autorização foi recebida, mas não foi possível identificar a conta Mercado Pago vinculada.");
  }

  const now=new Date().toISOString();
  const {error:upsertError}=await admin.from("merchant_mercadopago_accounts").upsert({
    merchant_id:oauthState.merchant_id,
    provider_user_id:providerUserId,
    account_email:accountEmail,
    encrypted_access_token:access.value,
    encrypted_refresh_token:refresh.value,
    token_iv:access.iv,
    refresh_token_iv:refresh.iv,
    token_type:text(raw.token_type)??"Bearer",
    scope:returnedScope,
    access_token_expires_at:new Date(Date.now()+expiresIn*1000).toISOString(),
    status:"connected",
    connected_at:now,
    disconnected_at:null,
    last_refreshed_at:now,
    last_error:null,
    metadata:{source:"oauth",pkce:true,requested_scope:"offline_access"},
    updated_at:now,
  },{onConflict:"merchant_id"});
  if(upsertError){console.error("merchant mp oauth persistence failed",{merchantId:oauthState.merchant_id,code:upsertError.code});return html("Falha ao salvar conexão","A autorização foi recebida, mas não foi possível concluir a vinculação. Tente novamente.");}
  return html("Mercado Pago conectado","A conta do estabelecimento foi vinculada com sucesso. Os pagamentos compatíveis com o modelo habilitado poderão ser destinados diretamente a essa conta.",true);
});
