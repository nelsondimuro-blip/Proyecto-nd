-- ===========================================================================
-- Gestion de miembros desde la interfaz
--
-- Un administrador invita por correo. Si la persona ya tiene cuenta, entra al
-- equipo la proxima vez que abre la app; si todavia no la tiene, queda dentro
-- apenas se registra con ese correo.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Rol del usuario actual (con privilegios elevados, para usar en triggers)
-- ---------------------------------------------------------------------------
create or replace function public.org_role(p_org uuid)
returns public.member_role
language sql
stable
security definer
set search_path = public
as $$
  select m.role
    from public.org_members m
   where m.org_id = p_org and m.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Reglas que RLS no puede expresar por si sola
-- ---------------------------------------------------------------------------
create or replace function public.guard_org_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_old_role public.member_role;
  v_new_role public.member_role;
  v_actor public.member_role;
  v_owners integer;
begin
  if tg_op = 'DELETE' then
    v_org := old.org_id;
    v_old_role := old.role;
  elsif tg_op = 'INSERT' then
    v_org := new.org_id;
    v_new_role := new.role;
  else
    v_org := new.org_id;
    v_old_role := old.role;
    v_new_role := new.role;
  end if;

  v_actor := public.org_role(v_org);

  -- Sin actor: es la creacion de la organizacion o la aceptacion de una
  -- invitacion, dos caminos que ya validan quien puede hacer que.
  if auth.uid() is null or v_actor is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' and v_new_role = 'owner' and v_actor <> 'owner' then
    raise exception 'Solo un propietario puede nombrar a otro propietario';
  end if;

  if tg_op = 'UPDATE' and (v_old_role = 'owner' or v_new_role = 'owner') and v_actor <> 'owner' then
    raise exception 'Solo un propietario puede cambiar el rol de un propietario';
  end if;

  if tg_op = 'DELETE' and v_old_role = 'owner' and v_actor <> 'owner' then
    raise exception 'Solo un propietario puede quitar a otro propietario';
  end if;

  -- La organizacion nunca puede quedarse sin propietario.
  if v_old_role = 'owner' and (tg_op = 'DELETE' or v_new_role <> 'owner') then
    select count(*) into v_owners
      from public.org_members
     where org_id = v_org and role = 'owner';

    if v_owners <= 1 then
      raise exception 'La organizacion necesita al menos un propietario';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger org_members_guard
  before insert or update or delete on public.org_members
  for each row execute function public.guard_org_members();

-- ---------------------------------------------------------------------------
-- Invitaciones
-- ---------------------------------------------------------------------------
create table public.org_invitations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  email        text not null check (position('@' in email) > 1 and char_length(email) <= 320),
  role         public.member_role not null default 'agent',
  invited_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users (id) on delete set null
);

-- Una sola invitacion pendiente por correo y organizacion.
create unique index org_invitations_pending_idx
  on public.org_invitations (org_id, email)
  where accepted_at is null;

create index org_invitations_email_idx
  on public.org_invitations (email)
  where accepted_at is null;

create or replace function public.prepare_org_invitation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := lower(btrim(new.email));

  if tg_op = 'INSERT' then
    new.invited_by := auth.uid();
    new.accepted_at := null;
    new.accepted_by := null;
  end if;

  if new.role = 'owner' and public.org_role(new.org_id) is distinct from 'owner' then
    raise exception 'Solo un propietario puede invitar a otro propietario';
  end if;

  return new;
end;
$$;

create trigger org_invitations_prepare
  before insert or update on public.org_invitations
  for each row execute function public.prepare_org_invitation();

alter table public.org_invitations enable row level security;

create policy "miembros ven las invitaciones"
  on public.org_invitations for select
  using (public.is_org_member(org_id));

create policy "admins gestionan las invitaciones"
  on public.org_invitations for all
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

-- ---------------------------------------------------------------------------
-- Aceptacion
-- ---------------------------------------------------------------------------

-- Para quien ya tenia cuenta cuando lo invitaron: la app la llama al entrar.
create or replace function public.accept_pending_invitations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_count integer := 0;
begin
  if auth.uid() is null or v_email is null then return 0; end if;

  with pending as (
    select id, org_id, role
      from public.org_invitations
     where accepted_at is null and email = v_email
  ), joined as (
    insert into public.org_members (org_id, user_id, role)
    select org_id, auth.uid(), role from pending
    on conflict (org_id, user_id) do nothing
    returning org_id
  )
  update public.org_invitations i
     set accepted_at = now(), accepted_by = auth.uid()
    from pending p
   where i.id = p.id;

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

-- Para quien se registra despues de ser invitado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  insert into public.org_members (org_id, user_id, role)
  select i.org_id, new.id, i.role
    from public.org_invitations i
   where i.accepted_at is null and i.email = lower(new.email)
  on conflict (org_id, user_id) do nothing;

  update public.org_invitations
     set accepted_at = now(), accepted_by = new.id
   where accepted_at is null and email = lower(new.email);

  return new;
end;
$$;
