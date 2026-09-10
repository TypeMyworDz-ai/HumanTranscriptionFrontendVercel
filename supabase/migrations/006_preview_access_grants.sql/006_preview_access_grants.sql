-- Preview-only access grants and client audio insert policy.
-- RLS remains the authority for row-level access.

grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;

drop policy if exists audio_owner_insert on public.audio_assets;
create policy audio_owner_insert on public.audio_assets
for insert to authenticated
with check (owner_id = auth.uid() and public.current_role() = 'client');
