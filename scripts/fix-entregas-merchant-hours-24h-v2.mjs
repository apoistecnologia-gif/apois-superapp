// INV-024 (PARCIAL) — igualar semântica 24h do helper ao backend.
// Continua pendente unificação de timezone, cidade/approval/temporarily_closed.
// NÃO altera a RPC merchant_accepting_orders e NÃO permite ignorar validação do checkout.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(".work/entregas/src/lib/merchant-hours.ts");
let s=readFileSync(path,"utf8");
const marker="APOIS_MERCHANT_HOURS_24H_V2";
if(s.includes(marker)){console.log("[OK] hours 24h guard exists");process.exit(0);}
const from=`  const activeInterval = intervals.find((interval) =>
    interval.close < interval.open
      ? nowMinutes >= interval.open
      : nowMinutes >= interval.open && nowMinutes < interval.close,
  );`;
const to=`  // ${marker}: server treats equal open/close times as all-day availability.
  const activeInterval = intervals.find((interval) =>
    interval.close === interval.open
      ? true
      : interval.close < interval.open
        ? nowMinutes >= interval.open
        : nowMinutes >= interval.open && nowMinutes < interval.close,
  );`;
if(s.split(from).length!==2)throw Error("[FAIL] Hours helper changed; inspect instead of replacing");
s=s.replace(from,to);
const messageFrom='    message: `Aberto até ${activeInterval.closesAt.substring(0, 5)}`,';
const messageTo='    message: activeInterval.close === activeInterval.open ? "Aberto 24 horas" : `Aberto até ${activeInterval.closesAt.substring(0, 5)}`,';
if(s.split(messageFrom).length!==2)throw Error("[FAIL] Hours display changed");
s=s.replace(messageFrom,messageTo);
writeFileSync(path,s,"utf8");
console.log("[OK] INV-024 parcial: faixa open=close é aberta 24h como no servidor.");
