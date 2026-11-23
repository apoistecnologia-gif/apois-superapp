-- Real no-show RPC migration behavior in a dedicated throwaway database.
DO $assert$
DECLARE v_message text; v_ride public.rides%rowtype; v_result jsonb;
BEGIN
  IF (SELECT value FROM public.app_settings WHERE key='ride.driver_no_show_code_v1') IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'no_show_contract_flag_missing';
  END IF;

  -- Cannot claim absence before the driver arrived, whether coded or legacy.
  BEGIN
    PERFORM apois_rpc_private.driver_cancel_ride(
      '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'APOIS_NO_SHOW_V1:Passageiro não apareceu'
    );
    RAISE EXCEPTION 'no_show_before_arrival_was_accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    IF v_message<>'no_show_requires_driver_arrival' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM apois_rpc_private.driver_cancel_ride(
      '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Passageiro não apareceu'
    );
    RAISE EXCEPTION 'accented_legacy_no_show_before_arrival_accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    IF v_message<>'no_show_requires_driver_arrival' THEN RAISE; END IF;
  END;

  -- Arrived, but less than the configured minimum waiting time: deny.
  BEGIN
    PERFORM apois_rpc_private.driver_cancel_ride(
      '22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'APOIS_NO_SHOW_V1:Passageiro não apareceu'
    );
    RAISE EXCEPTION 'no_show_before_wait_time_was_accepted';
  EXCEPTION WHEN SQLSTATE '55000' THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    IF v_message<>'driver_no_show_wait_not_elapsed' THEN RAISE; END IF;
  END;

  SELECT * INTO v_ride FROM public.rides WHERE id='22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF v_ride.status<>'motorista_chegou' THEN
    RAISE EXCEPTION 'denied_no_show_changed_ride_state';
  END IF;

  -- Arrival confirmed + more than two minutes elapsed: clean termination.
  v_result:=apois_rpc_private.driver_cancel_ride(
    '33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'APOIS_NO_SHOW_V1:Passageiro não apareceu'
  );
  SELECT * INTO v_ride FROM public.rides WHERE id='33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF v_ride.status<>'cancelada_motorista'
    OR v_ride.cancellation_reason<>'Passageiro não apareceu'
    OR v_ride.payment_method<>'cash'
    OR v_ride.payment_status<>'pending'
    OR (v_result->>'status')<>'cancelada_motorista'
    OR NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE action='ride.driver_no_show_cancelled' AND entity_id=v_ride.id::text)
  THEN
    RAISE EXCEPTION 'post_wait_no_show_terminal_or_audit_invalid';
  END IF;

  -- Standard cancellation must continue redispatch with old driver rejected.
  v_result:=apois_rpc_private.driver_cancel_ride(
    '44444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Problema operacional no veiculo'
  );
  SELECT * INTO v_ride FROM public.rides WHERE id='44444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF v_ride.status<>'procurar_motorista'
    OR v_ride.driver_id IS NOT NULL
    OR v_ride.accepted_driver_id IS NOT NULL
    OR v_ride.request_expires_at IS NULL
    OR NOT '11111111-1111-4111-8111-111111111111'::uuid=ANY(v_ride.rejected_driver_ids)
    OR '11111111-1111-4111-8111-111111111111'::uuid=ANY(v_ride.offered_driver_ids)
    OR v_ride.payment_method<>'cash'
    OR v_ride.payment_status<>'pending'
    OR NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE action='ride.driver_cancelled_for_redispatch' AND entity_id=v_ride.id::text)
  THEN
    RAISE EXCEPTION 'ordinary_cancel_redispatch_regressed';
  END IF;
END
$assert$;

-- Unauthorized caller is rejected without changing any ride.
SET apois.test_auth_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
DO $assert$
DECLARE v_message text;
BEGIN
  BEGIN
    PERFORM apois_rpc_private.driver_cancel_ride(
      '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Problema operacional no veiculo'
    );
    RAISE EXCEPTION 'unauthorized_driver_was_allowed';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
    IF v_message<>'unauthorized' THEN RAISE; END IF;
  END;
END
$assert$;
SELECT 'APOIS no-show reason code and original wait/arrival rules verified in disposable PostgreSQL' AS result;
