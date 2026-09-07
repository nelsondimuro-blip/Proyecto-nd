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
