
-- 1. Pastikan tabel users ada dengan struktur yang benar
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY, 
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'Owner',
  app_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Aktifkan RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Policy Penuh untuk Development (Hapus jika masuk produksi)
DROP POLICY IF EXISTS "Akses Penuh Untuk Semua" ON public.users;
CREATE POLICY "Akses Penuh Untuk Semua" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- 4. PENTING: Memberikan izin eksplisit ke role database (Mengatasi error permission denied)
GRANT ALL ON TABLE public.users TO postgres;
GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;

-- 5. Lakukan hal yang sama untuk tabel tasks jika diperlukan
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Tasks Penuh" ON public.tasks;
CREATE POLICY "Akses Tasks Penuh" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.tasks TO postgres;
GRANT ALL ON TABLE public.tasks TO anon;
GRANT ALL ON TABLE public.tasks TO authenticated;
GRANT ALL ON TABLE public.tasks TO service_role;
