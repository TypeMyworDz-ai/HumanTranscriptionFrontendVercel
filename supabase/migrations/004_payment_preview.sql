-- Preview-only payment ledger and callback simulation.
-- Provider secrets never live in the browser; production checkout will call a server adapter.

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null check (provider in ('kora','paystack')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null,
  status text not null default 'created' check (status in ('created','pending','paid','failed','refunded')),
  reference text unique,
  checkout_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists payment_attempts_order_idx on public.payment_attempts(order_id, created_at desc);
alter table public.payment_attempts enable row level security;
drop policy if exists payment_attempts_client_or_admin on public.payment_attempts;
create policy payment_attempts_client_or_admin on public.payment_attempts for select using (client_id = auth.uid() or public.current_role() = 'admin');

grant select on public.payment_attempts to authenticated;

create or replace function public.record_preview_payment(p_order_id uuid, p_provider text)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  current_order public.orders;
  ref text;
  updated_order public.orders;
begin
  if public.current_role() <> 'client' then raise exception 'Only clients can pay for orders'; end if;
  if p_provider not in ('kora','paystack') then raise exception 'Unsupported preview provider'; end if;
  select * into current_order from public.orders where id = p_order_id and client_id = auth.uid();
  if current_order.id is null or current_order.status <> 'draft' then raise exception 'Order is not awaiting payment'; end if;
  ref := upper(p_provider) || '-PREVIEW-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.payment_attempts(order_id, client_id, provider, amount, currency, status, reference, metadata, completed_at)
  values (p_order_id, auth.uid(), p_provider, coalesce(current_order.quote_amount, 0), current_order.quote_currency, 'paid', ref, jsonb_build_object('preview', true), now());
  update public.orders set payment_status = 'paid', payment_provider = p_provider, payment_reference = ref, status = 'pending_admin_review', updated_at = now() where id = p_order_id returning * into updated_order;
  insert into public.order_events(order_id, actor_id, event_type, from_status, to_status, note)
  values (p_order_id, auth.uid(), 'preview_payment_paid', 'draft', 'pending_admin_review', 'Preview payment recorded; replace with provider webhook in production.');
  return updated_order;
end;
$$;

grant execute on function public.record_preview_payment(uuid, text) to authenticated;
