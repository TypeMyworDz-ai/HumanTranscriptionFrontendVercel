-- Preview-only workflow helpers for TypeMyworDz Human.
-- No production tables, payments, or AI data are touched.

create or replace function public.submit_client_order(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  updated_order public.orders;
begin
  if public.current_role() <> 'client' then raise exception 'Only clients can submit orders'; end if;
  update public.orders
     set status = 'pending_admin_review', updated_at = now()
   where id = p_order_id and client_id = auth.uid() and status = 'draft'
   returning * into updated_order;
  if updated_order.id is null then raise exception 'Order is not an editable draft'; end if;
  insert into public.order_events(order_id, actor_id, event_type, from_status, to_status)
  values (p_order_id, auth.uid(), 'client_submitted', 'draft', 'pending_admin_review');
  return updated_order;
end;
$$;

grant execute on function public.submit_client_order(uuid) to authenticated;

create or replace function public.approve_order_for_workers(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  updated_order public.orders;
begin
  if public.current_role() <> 'admin' then raise exception 'Only Admin can approve orders'; end if;
  update public.orders
     set status = 'approved_open', updated_at = now()
   where id = p_order_id and status = 'pending_admin_review'
   returning * into updated_order;
  if updated_order.id is null then raise exception 'Order is not awaiting Admin approval'; end if;
  insert into public.order_events(order_id, actor_id, event_type, from_status, to_status)
  values (p_order_id, auth.uid(), 'admin_approved_order', 'pending_admin_review', 'approved_open');
  return updated_order;
end;
$$;

grant execute on function public.approve_order_for_workers(uuid) to authenticated;

create or replace function public.submit_worker_transcript(p_order_id uuid, p_editor_snapshot jsonb, p_worker_notes text default '')
returns public.transcript_submissions
language plpgsql security definer set search_path = public
as $$
declare
  claimed_worker uuid;
  new_submission public.transcript_submissions;
begin
  if public.current_role() <> 'worker' then raise exception 'Only workers can submit transcripts'; end if;
  select worker_id into claimed_worker from public.job_claims where order_id = p_order_id and released_at is null;
  if claimed_worker is distinct from auth.uid() then raise exception 'This order is not claimed by you'; end if;
  update public.orders set status = 'submitted', updated_at = now() where id = p_order_id and status in ('claimed','in_progress');
  if not found then raise exception 'Order is not ready for submission'; end if;
  insert into public.transcript_submissions(order_id, worker_id, editor_snapshot, worker_notes, status)
  values (p_order_id, auth.uid(), coalesce(p_editor_snapshot, '{}'::jsonb), coalesce(p_worker_notes, ''), 'submitted')
  returning * into new_submission;
  insert into public.order_events(order_id, actor_id, event_type, from_status, to_status)
  values (p_order_id, auth.uid(), 'worker_submitted', 'claimed', 'submitted');
  return new_submission;
end;
$$;

grant execute on function public.submit_worker_transcript(uuid, jsonb, text) to authenticated;

create or replace function public.approve_transcript_delivery(p_submission_id uuid, p_review_notes text default '')
returns public.transcript_submissions
language plpgsql security definer set search_path = public
as $$
declare
  submission public.transcript_submissions;
  updated_submission public.transcript_submissions;
  order_status text;
begin
  if public.current_role() <> 'admin' then raise exception 'Only Admin can approve delivery'; end if;
  select * into submission from public.transcript_submissions where id = p_submission_id;
  if submission.id is null then raise exception 'Submission not found'; end if;
  update public.transcript_submissions
     set status = 'accepted', reviewed_by = auth.uid(), review_notes = coalesce(p_review_notes, ''), reviewed_at = now()
   where id = p_submission_id and status = 'submitted'
   returning * into updated_submission;
  if updated_submission.id is null then raise exception 'Submission is not awaiting review'; end if;
  update public.orders set status = 'client_ready', updated_at = now() where id = submission.order_id returning status into order_status;
  insert into public.order_events(order_id, actor_id, event_type, from_status, to_status, note)
  values (submission.order_id, auth.uid(), 'admin_approved_delivery', 'submitted', 'client_ready', coalesce(p_review_notes, ''));
  insert into public.worker_earnings(order_id, worker_id, amount_kes, status, payout_provider)
  select o.id, submission.worker_id, case when o.quote_currency = 'KES' then coalesce(o.quote_amount, 0) * 0.70 else coalesce(o.quote_amount, 0) * 0.70 end, 'approved', 'kora'
  from public.orders o
  where o.id = submission.order_id
  on conflict (order_id) do nothing;
  return updated_submission;
end;
$$;

grant execute on function public.approve_transcript_delivery(uuid, text) to authenticated;

insert into storage.buckets (id, name, public)
values ('human-audio', 'human-audio', false)
on conflict (id) do nothing;

drop policy if exists human_audio_client_upload on storage.objects;
create policy human_audio_client_upload on storage.objects
for insert to authenticated
with check (bucket_id = 'human-audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists human_audio_owner_read on storage.objects;
create policy human_audio_owner_read on storage.objects
for select to authenticated
using (bucket_id = 'human-audio' and ((storage.foldername(name))[1] = auth.uid()::text or public.current_role() = 'admin' or exists (
  select 1 from public.job_claims c join public.orders o on o.id = c.order_id
  where o.audio_asset_id::text = (storage.foldername(name))[2] and c.worker_id = auth.uid()
)));
