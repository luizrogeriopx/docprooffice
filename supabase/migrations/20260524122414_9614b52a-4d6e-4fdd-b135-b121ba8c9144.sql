
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Documento sem título',
  content JSONB NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  content_html TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_user ON public.documents(user_id, updated_at DESC);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_select_own" ON public.documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "docs_insert_own" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "docs_update_own" ON public.documents FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "docs_delete_own" ON public.documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Edit history
CREATE TABLE public.document_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_history_doc ON public.document_history(document_id, created_at DESC);
ALTER TABLE public.document_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hist_select_own" ON public.document_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "hist_insert_own" ON public.document_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_docs_updated BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('doc-images', 'doc-images', true);
CREATE POLICY "doc_images_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'doc-images');
CREATE POLICY "doc_images_auth_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'doc-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "doc_images_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'doc-images' AND auth.uid()::text = (storage.foldername(name))[1]);
