-- APOIS Superapp / Entregas
-- Fila segura para solicitações de exclusão iniciadas fora do aplicativo.

create table if not exists public.external_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','rejected','cancelled')),
  source text not null default 'public_web',
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolution_note text,
  constraint external_account_deletion_requests_email_length
    check (char_length(email) between 3 and 254)
);

create index if not exists external_account_deletion_requests_status_requested_idx
  on public.external_account_deletion_requests(status, requested_at);
create index if not exists external_account_deletion_requests_email_lower_idx
  on public.external_account_deletion_requests(lower(email));

alter table public.external_account_deletion_requests enable row level security;
revoke all on table public.external_account_deletion_requests from public, anon, authenticated;
grant all on table public.external_account_deletion_requests to service_role;
