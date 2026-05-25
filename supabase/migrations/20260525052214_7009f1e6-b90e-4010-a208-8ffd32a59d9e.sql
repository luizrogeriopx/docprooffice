create table if not exists public.document_forks (
  share_link_id uuid not null references public.share_links(id) on delete cascade,
  user_id uuid not null,
  document_id uuid not null references public.documents(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (share_link_id, user_id)
);

alter table public.document_forks enable row level security;

drop policy if exists document_forks_select_own on public.document_forks;
create policy document_forks_select_own
on public.document_forks
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.fork_document(_token text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_share_link uuid;
  v_doc uuid;
  v_mode public.share_mode;
  v_existing uuid;
  v_new uuid;
  v_title text;
  v_content jsonb;
  v_html text;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(_token || ':' || auth.uid()::text, 0));

  select id, document_id, mode
    into v_share_link, v_doc, v_mode
    from public.share_links
    where token = _token;

  if v_doc is null then
    raise exception 'invalid token';
  end if;

  if v_mode <> 'fork' then
    raise exception 'not a fork link';
  end if;

  select document_id
    into v_existing
    from public.document_forks
    where share_link_id = v_share_link
      and user_id = auth.uid();

  if v_existing is not null then
    return v_existing;
  end if;

  select title, content, content_html
    into v_title, v_content, v_html
    from public.documents
    where id = v_doc;

  insert into public.documents (user_id, title, content, content_html)
    values (auth.uid(), v_title || ' (cópia)', v_content, v_html)
    returning id into v_new;

  insert into public.document_forks (share_link_id, user_id, document_id)
    values (v_share_link, auth.uid(), v_new);

  return v_new;
end;
$function$;