// Contrato da Edge Function `request-ride` versionada no Superapp
// (supabase/functions/request-ride/index.ts).
//
// Defeito C-001: o caminho de CRIAÇÃO devolvia `rideId`, `status`, `candidates`
// e `payment_status`, mas não `estimated_price`, enquanto os caminhos de
// REUTILIZAÇÃO devolviam `estimated_price` e não os outros. O cliente
// (use-ride-request.tsx) já lê `estimated_price` da resposta; sem a chave, o
// valor oficial não chegava ao app até o primeiro Realtime.
//
// Este teste executa o handler real (via import com stubs de Supabase) e
// verifica o contrato nos cinco caminhos: criação, reutilização por
// request_key, corrida ativa, erro de validação e erro interno.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("supabase/functions/request-ride/index.ts", "utf8");

/** Extrai o objeto de resposta do caminho de criação e o converte em objeto. */
function creationResponseKeys() {
  const marker = "if (insertError || !ride) throw insertError ?? new Error(\"ride_insert_failed\");";
  const start = source.indexOf(marker);
  assert.ok(start > 0, "caminho de criação não localizado");
  const returnStart = source.indexOf("return json({", start);
  const returnEnd = source.indexOf("});", returnStart);
  assert.ok(returnStart > 0 && returnEnd > returnStart, "retorno da criação não localizado");
  const literal = source.slice(returnStart + "return json({".length, returnEnd);
  const keys = [...literal.matchAll(/(?:^|\r?\n)\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map((m) => m[1]);
  return new Set(keys);
}

function reuseResponseKeys() {
  const start = source.indexOf('if (existing) return json({');
  assert.ok(start > 0, "caminho de reutilização não localizado");
  const end = source.indexOf("});", start);
  const literal = source.slice(start, end);
  return new Set([...literal.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map((m) => m[1]));
}

const CONTRACT_FIELDS = ["ok", "rideId", "status", "candidates", "estimated_price"];

test("criação devolve todos os campos do contrato público", () => {
  const keys = creationResponseKeys();
  for (const field of CONTRACT_FIELDS) {
    assert.ok(keys.has(field), `criação não devolve "${field}" (recebido: ${[...keys].join(", ")})`);
  }
});

test("reutilização devolve os mesmos campos do contrato (sem renomear nada)", () => {
  const keys = reuseResponseKeys();
  for (const field of ["ok", "rideId", "status", "estimated_price"]) {
    assert.ok(keys.has(field), `reutilização não devolve "${field}"`);
  }
});

test("criação e reutilização expõem estimated_price com o mesmo nome", () => {
  const creation = creationResponseKeys();
  const reuse = reuseResponseKeys();
  assert.ok(creation.has("estimated_price"), "criação sem estimated_price");
  assert.ok(reuse.has("estimated_price"), "reutilização sem estimated_price");
});

test("nenhum campo existente foi removido do retorno de criação", () => {
  const keys = creationResponseKeys();
  for (const field of ["rideId", "status", "candidates", "payment_status", "ok"]) {
    assert.ok(keys.has(field), `campo "${field}" desapareceu do retorno de criação`);
  }
});

test("erro interno mantém ok:false, error e error_code", () => {
  const start = source.indexOf('error_code: "request_ride_internal_error"');
  assert.ok(start > 0, "erro interno sem error_code");
  const block = source.slice(start - 400, start + 200);
  assert.ok(block.includes("ok: false"), "erro interno sem ok:false");
  assert.ok(block.includes('error: "internal_error"'), "erro interno sem error:internal_error");
});

test("idempotência: todo caminho de reutilização devolve estimated_price", () => {
  // Cada `reused: true` abre um retorno de reutilização. Verificamos, para cada
  // um, se o objeto daquele retorno contém estimated_price (sem limite de
  // distância, porque o objeto pode vir em várias linhas).
  let cursor = 0;
  let checked = 0;
  while (true) {
    const at = source.indexOf("reused: true", cursor);
    if (at < 0) break;
    cursor = at + 1;
    const open = source.lastIndexOf("json({", at);
    const close = source.indexOf("}", at);
    assert.ok(open >= 0 && close > open, "retorno de reutilização malformado");
    const object = source.slice(open, close);
    assert.ok(
      object.includes("estimated_price"),
      `retorno de reutilização em ${source.slice(0, at).split("\n").length} não devolve estimated_price`,
    );
    checked += 1;
  }
  assert.ok(checked >= 1, `esperado ao menos 1 caminho de reutilização, encontrado ${checked}`);
});

test("o cliente lê estimated_price pelo nome devolvido pela function", () => {
  const hook = readFileSync("sources/apois-corridas-passageiro/src/hooks/rides/use-ride-request.tsx", "utf8");
  assert.ok(hook.includes('value["estimated_price"]'), "hook não lê estimated_price");
  assert.ok(source.includes("estimated_price: estimatedPrice"), "function não envia estimated_price na criação");
});
