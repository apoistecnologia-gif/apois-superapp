-- APOIS ENTREGAS — HOMOLOGAÇÃO ISOLADA, NUNCA PRODUÇÃO.
-- NÃO aplicar nos projetos ptgkwyyolrdgnqketkjj ou sbvhdgyuuperszlsllji.
-- Preparar em branch/projeto Supabase novo e SEM dados de usuários/pedidos.
-- Checkout cash/pending: nenhum PIX, nenhum webhook falso, nenhuma receita real.
begin;

-- Barrar execução por engano em um banco de produção já em uso.
do $gate$
begin
  if exists(select 1 from auth.users limit 1)
     or exists(select 1 from public.orders limit 1)
     or exists(select 1 from public.merchants limit 1)
  then
    raise exception 'STAGING_ONLY: homologação requer banco vazio. Não executar em produção.';
  end if;
end;
$gate$;

create schema if not exists private;
create table if not exists private.apois_cash_homologation_merchants(
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  enabled boolean not null default false,
  enabled_at timestamptz not null default now(),
  note text not null default 'APOIS homologue cash pending, no real money'
);
alter table private.apois_cash_homologation_merchants enable row level security;
revoke all on private.apois_cash_homologation_merchants from public, anon, authenticated;
-- Inserções somente pelo responsável pelo banco HOMOLOGAÇÃO, após criar merchant TEST-*.

create or replace function public.enforce_supported_order_payment_method()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
begin
  if new.payment_method='cash' then
    if new.payment_status <> 'pending'
       or not exists(
         select 1 from private.apois_cash_homologation_merchants a
         where a.merchant_id=new.merchant_id and a.enabled
       )
    then
      raise exception 'cash direct test only: merchant not whitelisted or payment not pending';
    end if;
  elsif new.payment_method <> 'pix' then
    raise exception 'payment method is not enabled in staging';
  end if;
  return new;
end;
$fn$;

-- Preservar entitlement normal; apenas o MERCHANT TEST-* listado na branch
-- recebe isenção de assinatura sem criar pagamentos aprovados fictícios.
create or replace function public.merchant_subscription_in_good_standing(_merchant_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $fn$
  select case
    when not exists (
      select 1 from public.merchants m
      where m.id=_merchant_id and m.approval_status='approved' and m.is_active=true
    ) then true
    when exists (
      select 1 from private.apois_cash_homologation_merchants h
      where h.merchant_id=_merchant_id and h.enabled
    ) then true
    else exists (
      select 1
      from public.merchant_subscriptions ms
      join public.platform_settings ps on ps.key='mercado_pago_environment'
      where ms.merchant_id=_merchant_id
        and ms.current_period_end is not null
        and ms.current_period_end > now()
        and coalesce(ms.metadata->>'environment','')=coalesce(ps.value #>> '{}','')
        and coalesce(ms.last_payment_status,'')='approved'
    )
  end;
$fn$;

-- Políticas aditivas: somente dados cash/pending de lojas TEST-* autorizadas.
-- NÃO alterar políticas existentes de pedidos Pix/pagos.
create policy "Merchant staging cash order read"
on public.orders for select to authenticated
using (
  payment_method='cash'
  and payment_status in ('pending','cancelled')
  and public.current_user_is_merchant_member(merchant_id)
  and exists (
    select 1 from private.apois_cash_homologation_merchants h
    where h.merchant_id=orders.merchant_id and h.enabled
  )
);

create policy "Merchant staging cash items read"
on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders o
    join private.apois_cash_homologation_merchants h on h.merchant_id=o.merchant_id and h.enabled
    where o.id=order_items.order_id
      and o.payment_method='cash'
      and o.payment_status in ('pending','cancelled')
      and public.current_user_is_merchant_member(o.merchant_id)
  )
);

create policy "Merchant staging cash history read"
on public.order_status_history for select to authenticated
using (
  exists (
    select 1 from public.orders o
    join private.apois_cash_homologation_merchants h on h.merchant_id=o.merchant_id and h.enabled
    where o.id=order_status_history.order_id
      and o.payment_method='cash'
      and o.payment_status in ('pending','cancelled')
      and public.current_user_is_merchant_member(o.merchant_id)
  )
);

-- As rotinas existentes merchant_transition_order e merchant_request_courier
-- permitem cash/pending; não criar nem acionar provider PIX.
-- A liquidação financeira posterior será sempre simulada nesta branch.
commit;

-- Após criar merchant TEST-* e conferir project ref isolado:
-- INSERT INTO private.apois_cash_homologation_merchants(merchant_id,enabled)
-- VALUES ('<UUID_DE_MERCHANT_TESTE>',true);
-- O registro de teste é explicitamente restrito ao banco novo.
