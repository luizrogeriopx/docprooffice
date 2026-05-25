CREATE POLICY "collab_self_leave" ON public.document_collaborators
FOR DELETE TO authenticated
USING (auth.uid() = user_id);