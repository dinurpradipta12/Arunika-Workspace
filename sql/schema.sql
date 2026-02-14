
-- 1. Pastikan tabel users ada dengan struktur yang benar
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY, -- Menggunakan TEXT agar mendukung dev-id manual
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'Owner',
  app_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Matikan RLS sementara untuk testing jika Anda merasa kesulitan dengan auth
-- Atau gunakan policy yang lebih longgar untuk development:
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Akses Penuh Untuk Semua" ON public.users;
CREATE POLICY "Akses Penuh Untuk Semua" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- 3. Pastikan tabel tasks juga mengizinkan akses tanpa login auth resmi untuk sementara
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Akses Tasks Penuh" ON public.tasks;
CREATE POLICY "Akses Tasks Penuh" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- 4. Masukkan data user dev secara manual agar ID dev-user-01 dikenali
INSERT INTO public.users (id, name, email, avatar_url, app_settings)
VALUES (
  'dev-user-01', 
  'Developer User', 
  'dev@taskplay.io', 
  'https://api.dicebear.com/7.x/avataaars/svg?seed=dev', 
  '{"appName": "TaskPlay"}'
)
ON CONFLICT (id) DO NOTHING;
