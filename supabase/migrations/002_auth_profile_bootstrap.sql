-- TypeMyworDz Human Auth foundation
-- Preview project only. Creates a profile automatically for each Supabase Auth user.

create or replace function public.handle_new_human_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  safe_role text := case
    when requested_role in ('client','worker','trainee','admin') then requested_role
    else 'client'
  end;
  display_name_value text := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  );
  country_value text := nullif(new.raw_user_meta_data ->> 'country_code', '');
begin
  insert into public.profiles(id, role, display_name, email, country_code)
  values (new.id, safe_role, display_name_value, coalesce(new.email, ''), country_value)
  on conflict (id) do update set
    email = excluded.email,
    display_name = case when public.profiles.display_name = '' then excluded.display_name else public.profiles.display_name end,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_human_profile on auth.users;
create trigger on_auth_user_created_human_profile
after insert on auth.users
for each row execute function public.handle_new_human_user();

insert into public.profiles(id, role, display_name, email)
select
  u.id,
  case
    when u.raw_user_meta_data ->> 'role' in ('client','worker','trainee','admin') then u.raw_user_meta_data ->> 'role'
    else 'client'
  end,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'name', ''), split_part(coalesce(u.email, ''), '@', 1), ''),
  coalesce(u.email, '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
