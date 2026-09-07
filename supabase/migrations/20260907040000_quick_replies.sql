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
