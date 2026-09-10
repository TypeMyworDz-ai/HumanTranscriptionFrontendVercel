-- TypeMyworDz Human Transcription foundation
-- Preview project only. No payment provider or live client data is connected here.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('client','worker','trainee','admin')),
  display_name text not null default '',
  email text not null default '',
  country_code text,
  status text not null default 'active' check (status in ('active','pending','suspended','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  size_bytes bigint,
  duration_seconds numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete restrict,
  audio_asset_id uuid references public.audio_assets(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','pending_admin_review','approved_open','claimed','in_progress','submitted','admin_review','revision_requested','client_ready','delivered','cancelled','rejected')),
  service_type text not null default 'general',
  turnaround text not null default 'standard' check (turnaround in ('standard','rush')),
  difficulty text not null default 'standard' check (difficulty in ('standard','difficult')),
  speaker_count integer check (speaker_count is null or speaker_count > 0),
  timestamps_requested boolean not null default false,
  formatting_notes text not null default '',
  quote_currency text not null default 'KES',
  quote_amount numeric(12,2),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','failed','refunded')),
  payment_provider text check (payment_provider is null or payment_provider in ('kora','paystack')),
  payment_reference text,
  due_at timestamptz,
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_claims (
  order_id uuid primary key references public.orders(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete restrict,
  claimed_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text
);

create table if not exists public.transcript_submissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete restrict,
  revision_number integer not null default 1,
  transcript_path text,
  editor_snapshot jsonb not null default '{}'::jsonb,
  worker_notes text not null default '',
  status text not null default 'submitted' check (status in ('submitted','accepted','changes_requested','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_notes text not null default '',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  worker_id uuid references public.profiles(id) on delete set null,
  trainee_id uuid references public.profiles(id) on delete set null,
  admin_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  status text not null default 'open' check (status in ('open','waiting','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (((client_id is not null)::integer + (worker_id is not null)::integer + (trainee_id is not null)::integer) = 1)
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.training_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table if not exists public.trainee_progress (
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  module_id uuid not null references public.training_modules(id) on delete cascade,
  status text not null default 'locked' check (status in ('locked','in_progress','complete')),
  score numeric(5,2),
  reviewed_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (trainee_id, module_id)
);

create table if not exists public.worker_earnings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  worker_id uuid not null references public.profiles(id) on delete restrict,
  amount_kes numeric(12,2) not null check (amount_kes >= 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','held')),
  payout_provider text check (payout_provider is null or payout_provider = 'kora'),
  payout_reference text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists orders_client_idx on public.orders(client_id, created_at desc);
create index if not exists orders_status_idx on public.orders(status, created_at asc);
create index if not exists claims_worker_idx on public.job_claims(worker_id, claimed_at desc);
create index if not exists events_order_idx on public.order_events(order_id, created_at desc);
create index if not exists messages_thread_idx on public.support_messages(thread_id, created_at asc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists threads_updated_at on public.support_threads;
create trigger threads_updated_at before update on public.support_threads for each row execute function public.set_updated_at();

create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.claim_open_job(p_order_id uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  claimed_order public.orders;
  worker_role text;
begin
  worker_role := public.current_role();
  if worker_role <> 'worker' then
    raise exception 'Only approved workers can claim jobs';
  end if;

  update public.orders
     set status = 'claimed', updated_at = now()
   where id = p_order_id
     and status = 'approved_open'
     and not exists (select 1 from public.job_claims c where c.order_id = p_order_id)
  returning * into claimed_order;

  if claimed_order.id is null then
    raise exception 'This job is no longer available';
  end if;

  insert into public.job_claims(order_id, worker_id) values (p_order_id, auth.uid());
  insert into public.order_events(order_id, actor_id, event_type, from_status, to_status)
  values (p_order_id, auth.uid(), 'worker_claimed', 'approved_open', 'claimed');
  return claimed_order;
end;
$$;

alter table public.profiles enable row level security;
alter table public.audio_assets enable row level security;
alter table public.orders enable row level security;
alter table public.job_claims enable row level security;
alter table public.transcript_submissions enable row level security;
alter table public.order_events enable row level security;
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.training_modules enable row level security;
alter table public.trainee_progress enable row level security;
alter table public.worker_earnings enable row level security;

create policy profiles_self_or_admin on public.profiles for select using (id = auth.uid() or public.current_role() = 'admin');
create policy profiles_self_update on public.profiles for update using (id = auth.uid());

create policy audio_owner_or_worker_or_admin on public.audio_assets for select using (
  owner_id = auth.uid() or public.current_role() = 'admin' or exists (select 1 from public.job_claims c join public.orders o on o.id = c.order_id where o.audio_asset_id = audio_assets.id and c.worker_id = auth.uid())
);

create policy orders_client_worker_admin_select on public.orders for select using (
  client_id = auth.uid() or public.current_role() = 'admin' or (status = 'approved_open' and public.current_role() = 'worker') or exists (select 1 from public.job_claims c where c.order_id = orders.id and c.worker_id = auth.uid())
);
create policy orders_client_insert on public.orders for insert with check (client_id = auth.uid() and public.current_role() = 'client');
create policy orders_client_update on public.orders for update using (client_id = auth.uid() and status = 'draft');
create policy orders_admin_update on public.orders for update using (public.current_role() = 'admin');

create policy claims_worker_or_admin_select on public.job_claims for select using (worker_id = auth.uid() or public.current_role() = 'admin');
create policy submissions_worker_admin_select on public.transcript_submissions for select using (worker_id = auth.uid() or public.current_role() = 'admin' or exists (select 1 from public.orders o where o.id = transcript_submissions.order_id and o.client_id = auth.uid() and status in ('client_ready','delivered')));
create policy submissions_worker_insert on public.transcript_submissions for insert with check (worker_id = auth.uid() and public.current_role() = 'worker');
create policy submissions_admin_update on public.transcript_submissions for update using (public.current_role() = 'admin');

create policy events_related_select on public.order_events for select using (public.current_role() = 'admin' or actor_id = auth.uid() or exists (select 1 from public.orders o where o.id = order_events.order_id and o.client_id = auth.uid()));
create policy training_public_read on public.training_modules for select using (is_active = true or public.current_role() = 'admin');
create policy trainee_progress_self_or_admin on public.trainee_progress for select using (trainee_id = auth.uid() or public.current_role() = 'admin');
create policy earnings_worker_or_admin on public.worker_earnings for select using (worker_id = auth.uid() or public.current_role() = 'admin');

create policy threads_participant_or_admin on public.support_threads for select using (public.current_role() = 'admin' or client_id = auth.uid() or worker_id = auth.uid() or trainee_id = auth.uid());
create policy messages_participant_or_admin on public.support_messages for select using (public.current_role() = 'admin' or sender_id = auth.uid() or exists (select 1 from public.support_threads t where t.id = support_messages.thread_id and (t.client_id = auth.uid() or t.worker_id = auth.uid() or t.trainee_id = auth.uid())));
create policy messages_participant_insert on public.support_messages for insert with check (sender_id = auth.uid());

insert into public.training_modules(title, description, sort_order)
select * from (values
  ('Clean verbatim and speaker changes', 'Preserve meaning while removing noise and handling speaker turns.', 1),
  ('Timestamps that follow the audio', 'Keep the editor, audio and transcript aligned.', 2),
  ('Difficult audio and crosstalk', 'Work carefully through noise, overlap and uncertain speech.', 3),
  ('Final quality checklist', 'Prepare a submission that is ready for Admin review.', 4)
) as seed(title, description, sort_order)
where not exists (select 1 from public.training_modules);
