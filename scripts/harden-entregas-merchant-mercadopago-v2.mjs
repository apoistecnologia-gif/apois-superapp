// RETIRED PROVIDER GUARD
//
// Este arquivo existia para materializar a antiga integração Mercado Pago na
// cópia descartável de Entregas. O provider eletrônico oficial do Superapp é
// Safe2Pay; portanto este hardener não pode mais criar componentes, callbacks,
// OAuth, readiness ou cobranças Mercado Pago.
//
// Mantemos o caminho apenas como sentinela para detectar uma reativação
// acidental em scripts antigos. O pipeline real de Entregas usa
// harden-entregas-payment-provider-boundary.mjs e falha fechado se encontrar
// marcadores de providers aposentados no checkout materializado.

throw new Error(
  '[FAIL] harden-entregas-merchant-mercadopago-v2.mjs é legado e não pode ser executado; use o boundary Safe2Pay.',
);
