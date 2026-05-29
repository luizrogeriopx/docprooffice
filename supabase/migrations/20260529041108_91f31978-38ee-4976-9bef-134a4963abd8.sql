-- 1. Stop publishing collaborator changes over Realtime (never subscribed to in app)
ALTER PUBLICATION supabase_realtime DROP TABLE public.document_collaborators;

-- 2. Tighten docs_select: only owner or collaborator can read directly (remove link-existence bypass)
DROP POLICY IF EXISTS docs_select ON public.documents;
CREATE POLICY docs_select ON public.documents
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = user_id)
    OR is_document_collaborator(id, auth.uid())
  );

-- 3. Token-validated read for shared viewers (proves possession of the share token)
CREATE OR REPLACE FUNCTION public.get_shared_document(_token text)
RETURNS TABLE(id uuid, title text, content jsonb, content_html text, mode share_mode)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select d.id, d.title, d.content, d.content_html, sl.mode
  from public.share_links sl
  join public.documents d on d.id = sl.document_id
  where sl.token = _token
  limit 1;
$$;

REVOKE ALL ON FUNCTION public.get_shared_document(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_document(text) TO anon, authenticated;
