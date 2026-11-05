// APOIS_COURIER_OPERATIONAL_ACTIONS_V2 regression gate (read-only).
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
const read=(path)=>readFileSync(resolve(root,path),"utf8");
const route=read("src/routes/courier.tsx");
const profile=read("src/components/CourierPanels.tsx");
const calls=read("src/components/ApoisAvailableCalls.tsx");
const checks=read("src/components/ApoisStatusCheck.tsx");
const count=(s,t)=>s.split(t).length-1;
const homeStart=route.indexOf('data-apois-courier-map-home');
const profileStart=route.indexOf('if (profileOpen) {');
const mainStart=route.lastIndexOf('<main',homeStart);
assert.ok(profileStart>=0 && mainStart>profileStart, "Courier route home/profile boundaries");

// Home must have ONE polished entry and no dangling QA buttons.
assert.equal(count(route,'data-apois-courier-calls-card-v2'),1);
assert.equal(count(route,'data-apois-available-calls-button-v1'),1);
assert.equal(count(route,'data-apois-courier-status-check-v1'),0);
assert.equal(count(route,'onClick={()=>setAvailableCallsOpen(true)}'),1);
assert.ok(route.includes('Consultar novas entregas na sua região'));
assert.ok(route.includes('min-h-[86px]'));
assert.ok(route.includes('focus-visible:ring-[#D71920]'));
assert.ok(route.includes('Solicitações disponíveis'));

// Profile is a reachable existing tab, with a functional six-check launcher.
assert.equal(count(profile,'data-apois-courier-profile-diagnostic-v2'),1);
assert.ok(profile.includes('onClick={onOpenStatusCheck}'));
assert.ok(profile.includes('onOpenStatusCheck: () => void;'));
assert.ok(profile.includes('Conexão, GPS e cadastro · 6 verificações'));
assert.ok(route.includes('onOpenStatusCheck={() => setStatusCheckOpen(true)}'));
assert.ok(route.includes('role="entregador" online={Boolean(availability?.is_online)}'));
assert.ok(route.includes('onClose={()=>setStatusCheckOpen(false)}'));
assert.ok(route.includes('useEffect(() => { if (!profileOpen) setStatusCheckOpen(false); }, [profileOpen]);'));
assert.ok(route.indexOf('role="entregador" online={Boolean(availability?.is_online)}') < mainStart,
  "Profile diagnostic modal must be mounted before home early return");
assert.ok(profile.includes('onClick={onFinance}')&&profile.includes('onClick={onSwitchProfile}'),
  "Profile finance/switch actions must remain intact");

// Preserve original server RPCs, online state, accepted-offer refresh and lifecycle.
for(const marker of [
  'const [availableCallsOpen,setAvailableCallsOpen]=useState(false);',
  '<ApoisAvailableCalls role="entregador" online={online} open={availableCallsOpen}',
  'onAccepted={()=>{setAvailableCallsOpen(false);if(courier?.id)void loadCourierOperations(courier.id);}}',
  'setAvailableCallsOpen(false)',
  'role="entregador" online={Boolean(availability?.is_online)}',
  '<CourierStatusCard',
  'onToggle={toggleOnline}',
  'acceptOffer',
  'rejectOffer',
  'transitionDelivery',
  'completeDelivery',
  'CourierLiveMap',
  'CourierRouteMap',
  'onHistory={() => setHistoryOpen(true)}',
  'onFinance={() => setFinanceOpen(true)}',
  'onProfile={() => setProfileOpen(true)}',
])assert.ok(route.includes(marker),"Courier operational flow lost: "+marker);
for(const marker of [
  'apois_list_available_delivery_calls',
  'apois_claim_available_delivery_call',
  'remaining_seconds>0',
  'if(!online)',
  'onAccepted();',
  'onClose();',
  'window.clearInterval(poll)',
])assert.ok(calls.includes(marker),"Courier available calls service regression: "+marker);
for(const marker of [
  '1. Internet','2. Localização','3. Conta autenticada',
  '4. Cadastro e documentos','5. Disponibilidade','6. Servidor de chamadas',
  'supabase.auth.getUser()','courier_availability',
])assert.ok(checks.includes(marker),"Courier six-check diagnostic changed: "+marker);
assert.ok(!calls.includes('from("delivery_jobs")'),
  "Client should not query unrestricted raw delivery jobs");
console.log("[OK] Entregador V2: polished available calls card, real diagnostic in Profile, 6 checks and guarded RPCs, online/offline and delivery lifecycle preserved.");
