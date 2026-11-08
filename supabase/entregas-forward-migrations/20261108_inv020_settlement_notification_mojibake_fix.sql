-- INV-020: fix one confirmed double-encoded notification description in financial settlement.
-- Financial amounts, ledger events, grants, logic and existing rows are preserved.
-- Reads the live canonical body to avoid restoring an old function implementation.
DO $apois_inv020$
DECLARE
  fn oid := to_regprocedure('public.settle_delivered_order_financials(uuid)');
  before_text constant text := 'Repasse do pedido liberado apÃƒÂ³s conclusÃƒÂ£o';
  after_text constant text := 'Repasse do pedido liberado após conclusão';
  body_sql text;
  body_new text;
BEGIN
  IF fn IS NULL THEN RAISE EXCEPTION 'Expected settlement function is missing'; END IF;
  SELECT pg_get_functiondef(fn) INTO body_sql;
  IF position(before_text IN body_sql) = 0 THEN
    IF position(after_text IN body_sql) > 0 THEN RETURN; END IF;
    RAISE EXCEPTION 'Settlement function has unexpected message; refusing blind replacement';
  END IF;
  IF length(body_sql) - length(replace(body_sql,before_text,'')) <> length(before_text) THEN
    RAISE EXCEPTION 'Expected exactly one legacy message literal';
  END IF;
  body_new := replace(body_sql,before_text,after_text);
  EXECUTE body_new;
  IF pg_get_functiondef(fn) <> body_new THEN
    -- Pretty-printed bodies may normalize harmless whitespace; check the exact target instead.
    IF position(after_text IN pg_get_functiondef(fn)) = 0
      OR position(before_text IN pg_get_functiondef(fn)) > 0 THEN
      RAISE EXCEPTION 'Financial message was not replaced safely';
    END IF;
  END IF;
  IF has_function_privilege('anon',fn,'EXECUTE')
     OR has_function_privilege('authenticated',fn,'EXECUTE')
     OR NOT has_function_privilege('service_role',fn,'EXECUTE') THEN
    RAISE EXCEPTION 'INV-009 ACL was not preserved';
  END IF;
END
$apois_inv020$;