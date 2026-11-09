-- APOIS RELATORIO 10 / INV-061 (P1) — PREPARADO, NAO APLICADO.
-- Supabase Corridas: tbbzkrfupmqdywnzgnms.
-- NAO executar sem autorizacao especifica; nao rodar por builders.
-- Modifica apenas um predicado da funcao privada existente, preservando:
-- auth.uid(), ownership, bloqueios legados, auditoria, soft deletion,
-- GRANTs, SECURITY DEFINER, search_path e wrapper public.
-- IMPORTANTE: nao comprova atomicidade concorrente com criacao/aceite.
DO $apois_report10_guard$
DECLARE
  target_oid oid := to_regprocedure('apois_rpc_private.request_own_account_deletion()');
  current_definition text;
  prior_predicate constant text :=
    'r.status in (''aguardando_pagamento'',''solicitada'',''requested'',''buscando_motorista'',''searching'',''motorista_a_caminho'',''motorista_chegou'',''em_viagem'',''active'',''accepted'',''in_progress'',''started'')';
  corrected_predicate constant text :=
    'r.status in (''aguardando_pagamento'',''solicitada'',''requested'',''buscando_motorista'',''procurar_motorista'',''searching'',''motorista_a_caminho'',''motorista_chegou'',''em_viagem'',''active'',''accepted'',''in_progress'',''started'')';
BEGIN
  IF target_oid IS NULL THEN
    RAISE EXCEPTION 'INV-061: RPC privada ausente; migracao abortada';
  END IF;
  SELECT pg_get_functiondef(target_oid) INTO current_definition;
  IF current_definition IS NULL OR
     position('auth.uid()' in current_definition) = 0 OR
     position('u.deleted_at is null for update' in current_definition) = 0 OR
     position('public.rides r' in current_definition) = 0 OR
     position('public.drivers' in current_definition) = 0 OR
     position('public.audit_logs' in current_definition) = 0 OR
     position('profile.account_deletion_requested' in current_definition) = 0 THEN
    RAISE EXCEPTION 'INV-061: contrato RPC divergiu; revisar antes de aplicar';
  END IF;
  IF position(corrected_predicate in current_definition) > 0 THEN
    RAISE NOTICE 'INV-061: estado procurar_motorista ja protegido; nenhuma alteracao';
    RETURN;
  END IF;
  IF position(prior_predicate in current_definition) = 0 OR
     (length(current_definition) - length(replace(current_definition, prior_predicate, ''))) <> length(prior_predicate) THEN
    RAISE EXCEPTION 'INV-061: lista de estados mudou ou ocorre repetida; revisar antes de aplicar';
  END IF;

  EXECUTE replace(current_definition, prior_predicate, corrected_predicate);

  IF position(corrected_predicate in pg_get_functiondef(target_oid)) = 0 THEN
    RAISE EXCEPTION 'INV-061: verificacao de rotina apos troca falhou';
  END IF;
END;
$apois_report10_guard$;

-- Verificacoes obrigatorias apenas APOS implantacao autorizada:
-- 1. Conferir pg_get_functiondef(apois_rpc_private.request_own_account_deletion()).
-- 2. Conferir ACL/owner/security_definer/search_path sem ampliacoes.
-- 3. Testar perfis inteiramente sinteticos em staging (nao no banco vivo):
-- procurar_motorista, aguardando_pagamento, solicitada/requested,
-- buscando_motorista/searching, motorista_a_caminho, motorista_chegou,
-- em_viagem/active/accepted/in_progress/started: bloqueiam a solicitacao.
-- concluida/completed e cancelada/cancelled: nao bloquear por este predicado.
-- Testar isolamento de contas e concorrencia criacao/aceite versus exclusao.
-- Politica de corrida agendada NAO alterada; deliberacao pendente.
