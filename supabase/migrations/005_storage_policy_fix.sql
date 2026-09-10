drop policy if exists human_audio_owner_read on storage.objects;
create policy human_audio_owner_read on storage.objects
for select to authenticated
using (
  bucket_id = 'human-audio'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_role() = 'admin'
    or exists (
      select 1
      from public.audio_assets a
      join public.orders o on o.audio_asset_id = a.id
      join public.job_claims c on c.order_id = o.id
      where a.storage_path = name
        and c.worker_id = auth.uid()
        and c.released_at is null
    )
  )
);
