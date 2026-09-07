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
