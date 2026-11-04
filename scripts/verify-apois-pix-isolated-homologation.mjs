/**
 * APOIS - contrato PIX SIMULADO, totalmente OFFLINE.
 *
 * NÃO é um simulador Safe2Pay oficial, não gera PIX pagável, não acessa Supabase,
 * não publica webhooks, não altera produção e não substitui teste em aparelhos.
 * Execução: node scripts/verify-apois-pix-isolated-homologation.mjs
 */
const PRODUCTION_REFS = new Set([
  "tbbzkrfupmqdywnzgnms", // APOIS Corridas - produção
  "ptgkwyyolrdgnqketkjj", // APOIS Entregas - produção
  "vqtucstyduxrqjgyigfk", // referência Corridas histórica
  "sbvhdgyuuperszlsllji", // referência Entregas histórica
]);
const assert = (condition, message) => {
  if (!condition) throw new Error("[FAIL] " + message);
};
const rejects = (fn, expected) => {
  let caught = "";
  try { fn(); } catch (e) { caught = String(e.message); }
  assert(caught.includes(expected), "era esperado erro '" + expected + "', recebido: " + caught);
};

class OfflinePixSimulator {
  constructor({ environment, projectRef, origin }) {
    assert(environment === "local_test", "ambiente de simulação deve ser local_test");
    assert(!PRODUCTION_REFS.has(projectRef), "acesso a projeto de PRODUÇÃO proibido");
    assert(projectRef === "memory-only", "somente memória local é permitida");
    assert(origin === "memory://pix", "endpoint de rede proibido");
    this.charges = new Map();
    this.counter = 0;
    this.receipts = [];
  }
  create({ product, reference, amountCents }) {
    assert(product === "corridas" || product === "entregas", "produto desconhecido");
    assert(typeof reference === "string" && /^TEST-/.test(reference), "somente identificador fictício TEST-");
    assert(Number.isSafeInteger(amountCents) && amountCents > 0, "valor em centavos inválido");
    const id = "APOIS-SIM-NAO-PAGAVEL-" + ++this.counter;
    const charge = { id, product, reference, amountCents, status: "pending", paidCents: 0 };
    this.charges.set(id, charge);
    return { id, status: charge.status, qrCode: null, pixCopyPaste: null, simulation: true };
  }
  receive({ id, amountCents, event, source }) {
    assert(source === "isolated-harness", "confirmação externa/sem autenticação proibida");
    const charge = this.charges.get(id);
    assert(charge, "cobrança inexistente");
    assert(amountCents === charge.amountCents, "divergência de valor");
    assert(event === "confirmed", "evento PIX não confirmado");
    if (charge.status === "confirmed") return { duplicate: true, ...charge };
    assert(charge.status === "pending", "transição inválida");
    charge.status = "confirmed";
    charge.paidCents = amountCents;
    this.receipts.push({ id, product: charge.product, event, amountCents });
    return { duplicate: false, ...charge };
  }
  isPaid(id) { return this.charges.get(id)?.status === "confirmed"; }
}

class OfflineOperations {
  constructor(pix) { this.pix = pix; this.rideSettlements = new Set(); this.orderSettlements = new Set(); }
  ride({ passenger, driver, fareCents }) {
    assert(passenger === "TEST-passenger" && driver.id === "TEST-driver", "dados reais não permitidos");
    const payment = this.pix.create({ product: "corridas", reference: "TEST-RIDE-001", amountCents: fareCents });
    return { id: "TEST-RIDE-001", payment, fareCents, driver, status: "awaiting_payment", offerCount: 0, settlementCount: 0 };
  }
  dispatchRide(ride) {
    assert(this.pix.isPaid(ride.payment.id), "corrida só pode despachar após pagamento confirmado");
    assert(ride.driver.approved && ride.driver.online, "motorista indisponível");
    assert(ride.driver.distanceKm <= 20, "motorista fora do raio");
    assert(ride.status === "awaiting_payment", "oferta duplicada ou inválida");
    ride.status = "offered"; ride.offerCount++; return ride;
  }
  acceptRide(ride) { assert(ride.status === "offered", "aceite de corrida inválido"); ride.status = "accepted"; }
  startRide(ride, pin) {
    assert(ride.status === "accepted", "PIN fora da etapa");
    assert(pin === "1234", "PIN inválido");
    ride.status = "in_progress";
  }
  finishRide(ride) {
    assert(ride.status === "in_progress" || ride.status === "completed", "finalização inválida");
    ride.status = "completed";
    if (!this.rideSettlements.has(ride.id)) {
      this.rideSettlements.add(ride.id);
      ride.settlementCount++;
    }
  }
  order({merchant, courier, totalCents}) {
    assert(merchant.id === "TEST-merchant" && courier.id === "TEST-courier", "contas reais não permitidas");
    assert(merchant.approved && merchant.active && merchant.deliveries, "loja não habilitada");
    assert(merchant.subscriptionActive, "mensalidade de loja vencida");
    const payment=this.pix.create({product:"entregas",reference:"TEST-ORDER-001",amountCents:totalCents});
    return { id:"TEST-ORDER-001", payment, merchant, courier, status:"awaiting_payment", offerCount:0, settlementCount:0 };
  }
  merchantReceives(order) {
    assert(this.pix.isPaid(order.payment.id), "pedido PIX pendente não pode chegar como pago");
    assert(order.status === "awaiting_payment", "pedido duplicado ou inválido");
    order.status = "merchant_received";
  }
  merchantReady(order) { assert(order.status === "merchant_received", "pedido ainda não recebido"); order.status="ready"; }
  dispatchCourier(order) {
    assert(order.status === "ready", "pedido ainda não está pronto");
    assert(order.courier.approved && order.courier.online && order.courier.gpsRecent, "entregador não elegível");
    assert(order.courier.distanceKm <= 20, "entregador fora do raio");
    order.status="offered";order.offerCount++;
  }
  acceptCourier(order) { assert(order.status === "offered", "oferta inexistente");order.status="accepted"; }
  finishOrder(order) {
    assert(order.status === "accepted" || order.status === "completed", "entrega inválida");
    order.status="completed";
    if (!this.orderSettlements.has(order.id)) { this.orderSettlements.add(order.id);order.settlementCount++; }
  }
}

const checks = [];
function test(name, fn) {
  fn(); checks.push(name);
  console.log("[OK] " + name);
}
const newGateway = () => new OfflinePixSimulator({
  environment: "local_test", projectRef: "memory-only", origin: "memory://pix",
});

test("Nenhuma ligação ao banco de produção ou endpoint externo", () => {
  for (const projectRef of PRODUCTION_REFS) {
    rejects(() => new OfflinePixSimulator({ environment:"local_test",projectRef,origin:"memory://pix" }), "PRODUÇÃO");
  }
  rejects(() => new OfflinePixSimulator({environment:"production",projectRef:"memory-only",origin:"memory://pix"}), "local_test");
  rejects(() => new OfflinePixSimulator({environment:"local_test",projectRef:"memory-only",origin:"https://payment.safe2pay.com.br"}), "endpoint de rede");
});

test("PIX fictício não produz QR ou código pagável", () => {
  const charge=newGateway().create({product:"corridas",reference:"TEST-RIDE-001",amountCents:1299});
  assert(charge.simulation && charge.qrCode===null && charge.pixCopyPaste===null, "QR verdadeiro não permitido");
});

test("Corridas: pedido PIX pendente não chama motorista", () => {
  const gw=newGateway(),ops=new OfflineOperations(gw);
  const ride=ops.ride({passenger:"TEST-passenger",driver:{id:"TEST-driver",approved:true,online:true,distanceKm:1},fareCents:1990});
  rejects(()=>ops.dispatchRide(ride),"após pagamento");
});

test("Corridas: PIX fictício confirmado → oferta → PIN → conclusão → ledger virtual", () => {
  const gw=newGateway(),ops=new OfflineOperations(gw);
  const ride=ops.ride({passenger:"TEST-passenger",driver:{id:"TEST-driver",approved:true,online:true,distanceKm:1},fareCents:1990});
  gw.receive({id:ride.payment.id,amountCents:1990,event:"confirmed",source:"isolated-harness"});
  ops.dispatchRide(ride);ops.acceptRide(ride);
  rejects(()=>ops.startRide(ride,"0000"),"PIN");
  ops.startRide(ride,"1234");ops.finishRide(ride);ops.finishRide(ride);
  assert(ride.status==="completed" && ride.offerCount===1 && ride.settlementCount===1, "conclusão/ledger de corrida");
});

test("PIX: replay idempotente, valor divergente e origem falsa bloqueados", () => {
  const gw=newGateway(),p=gw.create({product:"entregas",reference:"TEST-ORDER-001",amountCents:2490});
  rejects(()=>gw.receive({id:p.id,amountCents:1,event:"confirmed",source:"isolated-harness"}),"valor");
  rejects(()=>gw.receive({id:p.id,amountCents:2490,event:"confirmed",source:"external"}),"externa");
  const a=gw.receive({id:p.id,amountCents:2490,event:"confirmed",source:"isolated-harness"});
  const b=gw.receive({id:p.id,amountCents:2490,event:"confirmed",source:"isolated-harness"});
  assert(!a.duplicate && b.duplicate && gw.receipts.length===1, "notificação duplicada");
});

const merchantOk={id:"TEST-merchant",approved:true,active:true,deliveries:true,subscriptionActive:true};
const courierOk={id:"TEST-courier",approved:true,online:true,gpsRecent:true,distanceKm:1};
test("Entregas: mensalidade vencida impede pedido", () => {
  const gw=newGateway(),ops=new OfflineOperations(gw);
  rejects(()=>ops.order({merchant:{...merchantOk,subscriptionActive:false},courier:courierOk,totalCents:2490}),"mensalidade");
});

test("Entregas: PIX pendente não chega ao estabelecimento", () => {
  const gw=newGateway(),ops=new OfflineOperations(gw);
  const order=ops.order({merchant:merchantOk,courier:courierOk,totalCents:2490});
  rejects(()=>ops.merchantReceives(order),"pendente");
});

test("Entregas: entregador distante não recebe oferta", () => {
  const gw=newGateway(),ops=new OfflineOperations(gw);
  const order=ops.order({merchant:merchantOk,courier:{...courierOk,distanceKm:249.9},totalCents:2490});
  gw.receive({id:order.payment.id,amountCents:2490,event:"confirmed",source:"isolated-harness"});
  ops.merchantReceives(order);ops.merchantReady(order);
  rejects(()=>ops.dispatchCourier(order),"raio");
});

test("Entregas: PIX fictício → estabelecimento → pronto → oferta → aceite → entrega", () => {
  const gw=newGateway(),ops=new OfflineOperations(gw);
  const order=ops.order({merchant:merchantOk,courier:courierOk,totalCents:2490});
  gw.receive({id:order.payment.id,amountCents:2490,event:"confirmed",source:"isolated-harness"});
  ops.merchantReceives(order);ops.merchantReady(order);ops.dispatchCourier(order);
  ops.acceptCourier(order);ops.finishOrder(order);ops.finishOrder(order);
  assert(order.status==="completed" && order.offerCount===1 && order.settlementCount===1, "conclusão/ledger de entrega");
});

assert(checks.length===9,"todos os contratos devem executar");
console.log("PASS: "+checks.length+" cenários isolados. Nenhum PIX, banco ou usuário real foi acessado.");
