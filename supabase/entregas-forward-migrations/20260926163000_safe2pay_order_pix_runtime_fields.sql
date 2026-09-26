-- Runtime fields consumed by the Safe2Pay order checkout/status Edge Functions.
-- Forward-only and idempotent. No historical payment rows are rewritten.

alter table public.safe2pay_order_transactions
  add column if not exists pix_copy_paste text,
  add column if not exists pix_qr_code_base64 text,
  add column if not exists expires_at timestamptz;

comment on column public.safe2pay_order_transactions.pix_copy_paste is
  'Public BR Code / Pix copy-and-paste payload returned for the current Safe2Pay transaction.';
comment on column public.safe2pay_order_transactions.pix_qr_code_base64 is
  'Public QR image payload returned by Safe2Pay when available.';
comment on column public.safe2pay_order_transactions.expires_at is
  'Local expiration timestamp for pending Safe2Pay Pix transactions.';
