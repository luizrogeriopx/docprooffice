
-- share mode enum
do $$ begin
  create type public.share_mode as enum ('view','fork','collab');
exception when duplicate_object then null; end $$;

-- share_links table
create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  owner_id uuid not null,
  mode public.share_mode not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  unique (document_id, mode)
);

alter table public.share_links enable row level security;

create policy "share_links_owner_all"
  on public.share_links for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- document_collaborators table
create table if not exists public.document_collaborators (
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

alter table public.document_collaborators enable row level security;

-- security definer helpers (avoid recursion in RLS)
create or replace function public.is_document_owner(_doc uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.documents where id = _doc and user_id = _user);
$$;

create or replace function public.is_document_collaborator(_doc uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.document_collaborators where document_id = _doc and user_id = _user);
$$;

create or replace function public.document_has_link(_doc uuid, _modes public.share_mode[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.share_links where document_id = _doc and mode = any(_modes));
$$;

-- collaborators policies
create policy "collab_select_owner_or_self"
  on public.document_collaborators for select
  to authenticated
  using (auth.uid() = user_id or public.is_document_owner(document_id, auth.uid()));

create policy "collab_owner_manage"
  on public.document_collaborators for all
  to authenticated
  using (public.is_document_owner(document_id, auth.uid()))
  with check (public.is_document_owner(document_id, auth.uid()));

-- replace documents RLS
drop policy if exists docs_select_own on public.documents;
drop policy if exists docs_update_own on public.documents;
drop policy if exists docs_delete_own on public.documents;
drop policy if exists docs_insert_own on public.documents;

create policy "docs_select"
  on public.documents for select
  to anon, authenticated
  using (
    auth.uid() = user_id
    or (auth.uid() is not null and public.is_document_collaborator(id, auth.uid()))
    or public.document_has_link(id, array['view','fork','collab']::public.share_mode[])
  );

create policy "docs_insert_own"
  on public.documents for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "docs_update"
  on public.documents for update
  to authenticated
  using (
    auth.uid() = user_id
    or public.is_document_collaborator(id, auth.uid())
  );

create policy "docs_delete_own"
  on public.documents for delete
  to authenticated
  using (auth.uid() = user_id);

-- public function to resolve token
create or replace function public.get_share_link(_token text)
returns table (document_id uuid, mode public.share_mode, owner_id uuid, title text)
language sql stable security definer set search_path = public as $$
  select sl.document_id, sl.mode, sl.owner_id, d.title
  from public.share_links sl
  join public.documents d on d.id = sl.document_id
  where sl.token = _token
  limit 1;
$$;

grant execute on function public.get_share_link(text) to anon, authenticated;

-- accept collab invite
create or replace function public.accept_collab_invite(_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_doc uuid;
  v_mode public.share_mode;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select document_id, mode into v_doc, v_mode from public.share_links where token = _token;
  if v_doc is null then raise exception 'invalid token'; end if;
  if v_mode <> 'collab' then raise exception 'not a collab link'; end if;
  insert into public.document_collaborators(document_id, user_id)
    values (v_doc, auth.uid()) on conflict do nothing;
  return v_doc;
end; $$;

grant execute on function public.accept_collab_invite(text) to authenticated;

-- fork document
create or replace function public.fork_document(_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_doc uuid;
  v_mode public.share_mode;
  v_new uuid;
  v_title text;
  v_content jsonb;
  v_html text;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select document_id, mode into v_doc, v_mode from public.share_links where token = _token;
  if v_doc is null then raise exception 'invalid token'; end if;
  if v_mode <> 'fork' then raise exception 'not a fork link'; end if;
  select title, content, content_html into v_title, v_content, v_html
    from public.documents where id = v_doc;
  insert into public.documents (user_id, title, content, content_html)
    values (auth.uid(), v_title || ' (cópia)', v_content, v_html)
    returning id into v_new;
  return v_new;
end; $$;

grant execute on function public.fork_document(text) to authenticated;

-- list collaborators with email for owner UI
create or replace function public.list_collaborators(_doc uuid)
returns table (user_id uuid, email text, full_name text, added_at timestamptz)
language sql stable security definer set search_path = public as $$
  select dc.user_id, p.email, p.full_name, dc.added_at
  from public.document_collaborators dc
  left join public.profiles p on p.id = dc.user_id
  where dc.document_id = _doc
    and public.is_document_owner(_doc, auth.uid());
$$;

grant execute on function public.list_collaborators(uuid) to authenticated;

-- realtime for collaborators table (documents already added per chat history)
alter publication supabase_realtime add table public.document_collaborators;
