-- =========================================================================
-- ARCHIVO GENERADO - no editar a mano.
--
-- Es la union de supabase/migrations/*.sql, en orden, para pegar de una sola
-- vez en el SQL Editor de Supabase, sobre una base nueva y vacia.
-- Se regenera con:  npm run build:schema
--
-- Sobre una base que ya tiene datos hay que usar las migraciones, una por una
-- o con "supabase db push".
-- =========================================================================

-- =========================================================================
-- 20260907000000_init.sql
-- =========================================================================

-- ===========================================================================
-- Proyecto ND — Bandeja unificada de WhatsApp
-- Esquema inicial: organizaciones, cuentas de WhatsApp, contactos,
-- conversaciones y mensajes, con RLS por organizacion.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'agent');
create type public.account_status as enum ('disconnected', 'connecting', 'qr', 'connected', 'logged_out', 'error');
create type public.conversation_status as enum ('open', 'pending', 'closed');
create type public.message_direction as enum ('in', 'out');
create type public.message_status as enum ('pending', 'sent', 'delivered', 'read', 'failed');

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizaciones y miembros
-- ---------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.org_members (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.member_role not null default 'agent',
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index org_members_user_idx on public.org_members (user_id);

-- Evita recursion en las politicas de RLS: se consulta con privilegios elevados.
create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = p_org
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

-- Crea la organizacion y deja al usuario actual como propietario.
create or replace function public.create_organization(p_name text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'no autenticado';
  end if;

  insert into public.organizations (name) values (btrim(p_name)) returning * into v_org;
  insert into public.org_members (org_id, user_id, role) values (v_org.id, auth.uid(), 'owner');

  return v_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfiles (espejo de auth.users para poder mostrar y asignar agentes)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.shares_org_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.org_members mine
      join public.org_members other on other.org_id = mine.org_id
     where mine.user_id = auth.uid()
       and other.user_id = p_user
  );
$$;

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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles de quienes ya existian antes de esta migracion.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Cuentas de WhatsApp (un numero = una cuenta)
-- ---------------------------------------------------------------------------
create table public.whatsapp_accounts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  label         text not null check (char_length(btrim(label)) between 1 and 80),
  phone_number  text,
  status        public.account_status not null default 'disconnected',
  qr_code       text,           -- data URL del QR vigente (solo mientras status = 'qr')
  qr_expires_at timestamptz,
  last_error    text,
  connected_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, label)
);

create index whatsapp_accounts_org_idx on public.whatsapp_accounts (org_id);

create trigger whatsapp_accounts_set_updated_at
  before update on public.whatsapp_accounts
  for each row execute function public.set_updated_at();

-- Credenciales de Baileys. Solo accesible con la service role key del gateway:
-- la tabla tiene RLS activo y ninguna politica, asi nadie la lee desde el cliente.
create table public.whatsapp_auth_state (
  account_id  uuid not null references public.whatsapp_accounts (id) on delete cascade,
  key         text not null,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (account_id, key)
);

-- ---------------------------------------------------------------------------
-- Contactos
-- ---------------------------------------------------------------------------
create table public.contacts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  wa_id         text not null,          -- jid normalizado, p.ej. 5491122334455@s.whatsapp.net
  phone         text,
  display_name  text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, wa_id)
);

create index contacts_org_name_idx on public.contacts (org_id, display_name);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Conversaciones
-- ---------------------------------------------------------------------------
create table public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations (id) on delete cascade,
  account_id            uuid not null references public.whatsapp_accounts (id) on delete cascade,
  contact_id            uuid references public.contacts (id) on delete set null,
  chat_id               text not null,   -- jid del chat (individual o grupo)
  is_group              boolean not null default false,
  subject               text,            -- nombre del grupo o del contacto
  status                public.conversation_status not null default 'open',
  assigned_to           uuid references auth.users (id) on delete set null,
  unread_count          integer not null default 0 check (unread_count >= 0),
  last_message_at       timestamptz,
  last_message_preview  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (account_id, chat_id)
);

create index conversations_org_recent_idx on public.conversations (org_id, last_message_at desc nulls last);
create index conversations_assigned_idx on public.conversations (assigned_to) where assigned_to is not null;

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Mensajes
-- ---------------------------------------------------------------------------
create table public.messages (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  conversation_id   uuid not null references public.conversations (id) on delete cascade,
  account_id        uuid not null references public.whatsapp_accounts (id) on delete cascade,
  wa_message_id     text not null,
  direction         public.message_direction not null,
  sender_wa_id      text,
  sender_name       text,
  type              text not null default 'text',
  body              text,
  media_path        text,      -- ruta dentro del bucket 'whatsapp-media'
  media_mime        text,
  media_filename    text,
  status            public.message_status not null default 'sent',
  sent_by           uuid references auth.users (id) on delete set null,
  sent_at           timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (conversation_id, wa_message_id)
);

create index messages_conversation_idx on public.messages (conversation_id, sent_at desc);
create index messages_account_wa_id_idx on public.messages (account_id, wa_message_id);

-- Mantiene el resumen de la conversacion al dia.
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
as $$
begin
  update public.conversations c
     set last_message_at = greatest(coalesce(c.last_message_at, new.sent_at), new.sent_at),
         last_message_preview = left(coalesce(nullif(btrim(new.body), ''), '[' || new.type || ']'), 160),
         unread_count = case when new.direction = 'in' then c.unread_count + 1 else c.unread_count end,
         updated_at = now()
   where c.id = new.conversation_id;

  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- Marca una conversacion como leida (evita carreras al actualizar el contador).
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.conversations
     set unread_count = 0, updated_at = now()
   where id = p_conversation;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.organizations       enable row level security;
alter table public.org_members         enable row level security;
alter table public.profiles            enable row level security;
alter table public.whatsapp_accounts   enable row level security;
alter table public.whatsapp_auth_state enable row level security;
alter table public.contacts            enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;

-- organizations
create policy "miembros ven su organizacion"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "admins editan su organizacion"
  on public.organizations for update
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

-- org_members
create policy "miembros ven el equipo"
  on public.org_members for select
  using (public.is_org_member(org_id));

create policy "admins gestionan el equipo"
  on public.org_members for all
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

-- profiles
create policy "ver perfiles del equipo"
  on public.profiles for select
  using (id = auth.uid() or public.shares_org_with(id));

create policy "editar mi perfil"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- whatsapp_accounts
create policy "miembros ven las cuentas"
  on public.whatsapp_accounts for select
  using (public.is_org_member(org_id));

create policy "admins gestionan las cuentas"
  on public.whatsapp_accounts for all
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

-- whatsapp_auth_state: sin politicas a proposito (solo service role).

-- contacts
create policy "miembros ven contactos"
  on public.contacts for select
  using (public.is_org_member(org_id));

create policy "miembros editan contactos"
  on public.contacts for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- conversations
create policy "miembros ven conversaciones"
  on public.conversations for select
  using (public.is_org_member(org_id));

create policy "miembros actualizan conversaciones"
  on public.conversations for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- messages: se insertan desde el gateway (service role), la app solo lee.
create policy "miembros ven mensajes"
  on public.messages for select
  using (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.whatsapp_accounts;

-- ---------------------------------------------------------------------------
-- Storage para adjuntos (bucket privado; la web firma URLs temporales)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', false)
on conflict (id) do nothing;

-- Los adjuntos se leen firmando URLs con la sesion del propio usuario:
-- el primer segmento de la ruta es el id de la organizacion.
create policy "miembros leen adjuntos de su organizacion"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'whatsapp-media'
    and public.is_org_member(nullif((storage.foldername(name))[1], '')::uuid)
  );

-- =========================================================================
-- 20260907010000_outbound_media.sql
-- =========================================================================

-- ===========================================================================
-- Envio de adjuntos desde el panel
--
-- El navegador sube el archivo directamente al bucket privado, bajo
-- <org_id>/outbox/<conversation_id>/<archivo>, y despues pide al gateway que
-- lo mande. Asi el archivo no atraviesa las funciones serverless de Next.
-- ===========================================================================

create policy "miembros suben adjuntos salientes"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'whatsapp-media'
    and (storage.foldername(name))[2] = 'outbox'
    and public.is_org_member(nullif((storage.foldername(name))[1], '')::uuid)
  );

-- =========================================================================
-- 20260907020000_voice_notes.sql
-- =========================================================================

-- ===========================================================================
-- Notas de voz (PTT)
--
-- WhatsApp distingue una nota de voz de un audio adjunto: se manda como PTT
-- (push to talk) en ogg/opus y se reproduce distinto. Guardamos la marca para
-- poder mostrarla igual en la bandeja.
-- ===========================================================================

alter table public.messages
  add column is_voice boolean not null default false;

-- =========================================================================
-- 20260907030000_team_management.sql
-- =========================================================================

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

-- =========================================================================
-- 20260907040000_quick_replies.sql
-- =========================================================================

-- ===========================================================================
-- Respuestas rapidas
--
-- Biblioteca compartida del equipo: cada respuesta tiene un atajo corto que se
-- escribe con "/" en el compositor. El texto admite variables entre llaves
-- ({{nombre}}, {{numero}}, {{cuenta}}, {{agente}}) que la app completa antes
-- de enviar.
-- ===========================================================================

create table public.quick_replies (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  shortcut     text not null check (shortcut ~ '^[a-z0-9][a-z0-9_-]{0,30}$'),
  title        text check (char_length(btrim(title)) between 1 and 80),
  body         text not null check (char_length(btrim(body)) between 1 and 4096),
  created_by   uuid references auth.users (id) on delete set null,
  usage_count  integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Un atajo por organizacion: es lo que se escribe despues de la barra.
create unique index quick_replies_shortcut_idx on public.quick_replies (org_id, shortcut);

-- Las mas usadas primero, que es como se ordena el listado.
create index quick_replies_popular_idx on public.quick_replies (org_id, usage_count desc);

create trigger quick_replies_set_updated_at
  before update on public.quick_replies
  for each row execute function public.set_updated_at();

create or replace function public.prepare_quick_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.shortcut := lower(btrim(new.shortcut));
  new.title := nullif(btrim(new.title), '');

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.usage_count := coalesce(new.usage_count, 0);
  end if;

  return new;
end;
$$;

create trigger quick_replies_prepare
  before insert or update on public.quick_replies
  for each row execute function public.prepare_quick_reply();

alter table public.quick_replies enable row level security;

create policy "miembros ven las respuestas rapidas"
  on public.quick_replies for select
  using (public.is_org_member(org_id));

create policy "miembros crean respuestas rapidas"
  on public.quick_replies for insert
  with check (public.is_org_member(org_id));

-- Editar y borrar: quien la creo, o cualquier administrador.
create policy "el autor o un admin edita la respuesta"
  on public.quick_replies for update
  using (public.is_org_member(org_id) and (created_by = auth.uid() or public.is_org_admin(org_id)))
  with check (public.is_org_member(org_id));

create policy "el autor o un admin borra la respuesta"
  on public.quick_replies for delete
  using (public.is_org_member(org_id) and (created_by = auth.uid() or public.is_org_admin(org_id)));

-- Cualquier miembro suma un uso, aunque no pueda editar la respuesta.
create or replace function public.use_quick_reply(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_count integer;
begin
  select org_id into v_org from public.quick_replies where id = p_id;

  if v_org is null or not public.is_org_member(v_org) then
    raise exception 'Respuesta rapida no encontrada';
  end if;

  update public.quick_replies
     set usage_count = usage_count + 1
   where id = p_id
  returning usage_count into v_count;

  return v_count;
end;
$$;

-- =========================================================================
-- 20260907050000_labels.sql
-- =========================================================================

-- ===========================================================================
-- Etiquetas para clasificar conversaciones
--
-- Cada organizacion arma su propio juego de etiquetas ("Presupuesto",
-- "Reclamo", "Mayorista") y las aplica a las conversaciones. Una conversacion
-- puede llevar varias.
-- ===========================================================================

create table public.labels (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  color       text not null default '#21c063' check (color ~ '^#[0-9a-f]{6}$'),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Un nombre por organizacion, sin importar mayusculas.
create unique index labels_name_idx on public.labels (org_id, lower(btrim(name)));

create trigger labels_set_updated_at
  before update on public.labels
  for each row execute function public.set_updated_at();

create or replace function public.prepare_label()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.name := btrim(new.name);
  new.color := lower(new.color);

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;

create trigger labels_prepare
  before insert or update on public.labels
  for each row execute function public.prepare_label();

-- ---------------------------------------------------------------------------
-- Etiquetas aplicadas
-- ---------------------------------------------------------------------------
create table public.conversation_labels (
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  label_id         uuid not null references public.labels (id) on delete cascade,
  -- Denormalizado a proposito: deja la politica de RLS en una sola condicion.
  org_id           uuid not null references public.organizations (id) on delete cascade,
  added_by         uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  primary key (conversation_id, label_id)
);

create index conversation_labels_label_idx on public.conversation_labels (label_id);

create or replace function public.prepare_conversation_label()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_org uuid;
  v_label_org uuid;
begin
  select org_id into v_conversation_org from public.conversations where id = new.conversation_id;
  select org_id into v_label_org from public.labels where id = new.label_id;

  if v_conversation_org is null or v_label_org is null or v_conversation_org <> v_label_org then
    raise exception 'La etiqueta y la conversacion son de organizaciones distintas';
  end if;

  new.org_id := v_conversation_org;
  new.added_by := auth.uid();

  return new;
end;
$$;

create trigger conversation_labels_prepare
  before insert or update on public.conversation_labels
  for each row execute function public.prepare_conversation_label();

-- Organizacion de una conversacion, para validar el insert sin depender del
-- orden en que corren el trigger y el WITH CHECK de la politica.
create or replace function public.conversation_org(p_conversation uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.conversations where id = p_conversation;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.labels enable row level security;
alter table public.conversation_labels enable row level security;

create policy "miembros ven las etiquetas"
  on public.labels for select
  using (public.is_org_member(org_id));

create policy "miembros crean etiquetas"
  on public.labels for insert
  with check (public.is_org_member(org_id));

-- Renombrar o borrar: quien la creo, o un administrador.
create policy "el autor o un admin edita la etiqueta"
  on public.labels for update
  using (public.is_org_member(org_id) and (created_by = auth.uid() or public.is_org_admin(org_id)))
  with check (public.is_org_member(org_id));

create policy "el autor o un admin borra la etiqueta"
  on public.labels for delete
  using (public.is_org_member(org_id) and (created_by = auth.uid() or public.is_org_admin(org_id)));

-- Aplicar y quitar etiquetas es trabajo diario: cualquier miembro puede.
create policy "miembros ven las etiquetas aplicadas"
  on public.conversation_labels for select
  using (public.is_org_member(org_id));

create policy "miembros etiquetan conversaciones"
  on public.conversation_labels for insert
  with check (public.is_org_member(public.conversation_org(conversation_id)));

create policy "miembros quitan etiquetas"
  on public.conversation_labels for delete
  using (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Realtime: la bandeja muestra las etiquetas en cada fila
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.conversation_labels;
alter publication supabase_realtime add table public.labels;
