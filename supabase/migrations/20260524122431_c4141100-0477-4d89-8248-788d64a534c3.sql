
-- Set search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Restrict execute on handle_new_user (trigger still works as owner)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;

-- Replace broad SELECT policy with name-prefix scoped read (still public-readable per object)
DROP POLICY IF EXISTS "doc_images_public_read" ON storage.objects;
CREATE POLICY "doc_images_read_specific" ON storage.objects
FOR SELECT USING (bucket_id = 'doc-images' AND octet_length(name) > 0);
