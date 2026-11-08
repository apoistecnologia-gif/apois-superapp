// INV-021 dependency gate — canonical Corridas AUTH vs DOMAIN identity.
// Verify FINAL transformed frontend and existing contract; no DB writes.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const read=p=>readFileSync(resolve(root,p),"utf8");
const auth=read("src/hooks/use-auth.tsx");
const walletHook=read("src/hooks/use-wallet.tsx");
const fees=read("src/services/payments/payment-service.ts");
const page=read("src/routes/_authenticated.carteira.tsx");
const guard=read("src/components/auth/AuthGuard.tsx");
for(const marker of ['.eq("auth_user_id", userId)','setAuthState("loading_profile")','setAuthState("profile_missing")'])
 assert.ok(auth.includes(marker),"Auth profile ID mismatch: "+marker);
assert.ok(walletHook.includes('const userId = profile?.id ?? null;'),"Wallet hook must use DOMAIN USER ID");
assert.ok(page.includes('const domainUserId = profile?.id ?? null;'),"Wallet page must use DOMAIN USER ID");
assert.ok(page.includes('paymentService.getCancellationFees(domainUserId)'),"Fees must use public.users.id");
assert.ok(page.includes('authState === "loading_profile"'),"Profile-loading state cannot be mistaken for no fees");
assert.ok(fees.includes('.eq("passenger_id", userId)'),"Cancellation fee service contract drift");
assert.ok(guard.includes('authState === "profile_missing"'),"Missing profile must have recoverable guard");
assert.ok(!page.includes('getCancellationFees(userId)')&&!page.includes('getCancellationFees(user?.id)'),"AUTH ID leaked into domain fee query");
console.log("[OK] INV-021: auth->public.users->wallet/fees contracts consistent.");
