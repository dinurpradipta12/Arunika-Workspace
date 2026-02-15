
-- ==========================================
-- SCRIPT DATABASE TASKPLAY (FINAL FIX - RECURSION & 500 ERROR)
-- ==========================================

-- 1. PASTIKAN TABEL UTAMA ADA
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT,
  username TEXT,
  name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'Member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  app_settings JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  category TEXT DEFAULT 'General',
  description TEXT
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  start_date TIMESTAMP WITH TIME ZONE,
  is_all_day BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_archived BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'General',
  google_event_id TEXT,
  google_calendar_id TEXT
);

-- 2. BERSIHKAN POLICY LAMA (Reset Total)
DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE tablename IN ('workspaces', 'workspace_members', 'tasks', 'users') 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.' || pol.tablename; 
    END LOOP;
END $$;

-- 3. FUNGSI BYPASS RLS (The Chain Breaker)
-- Fungsi ini membaca workspace_members SECARA LANGSUNG (bypassing RLS)
-- Ini memutus rantai: Workspaces -> Policy -> Fungsi -> Raw Data (Stop)
DROP FUNCTION IF EXISTS public.get_my_workspace_ids();
CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER -- Berjalan sebagai superuser/creator, bypass RLS tabel
SET search_path = public
STABLE
AS $$
    SELECT workspace_id 
    FROM public.workspace_members 
    WHERE user_id = auth.uid()::text
$$;

-- 4. PERBAIKI CONSTRAINT
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_user_id_fkey;
ALTER TABLE public.workspace_members 
  ADD CONSTRAINT workspace_members_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES public.users(id) 
  ON DELETE CASCADE;

-- 5. GRANT PERMISSIONS (Termasuk Anon untuk Login Check)
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;
GRANT SELECT ON TABLE public.users TO anon; -- Fix 401 error saat login check

GRANT ALL ON TABLE public.workspaces TO authenticated;
GRANT ALL ON TABLE public.workspaces TO service_role;

GRANT ALL ON TABLE public.workspace_members TO authenticated;
GRANT ALL ON TABLE public.workspace_members TO service_role;

GRANT ALL ON TABLE public.tasks TO authenticated;
GRANT ALL ON TABLE public.tasks TO service_role;

-- 6. AKTIFKAN RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 7. POLICY: USERS
-- Semua orang (termasuk anon) bisa baca profil (untuk login & collab)
CREATE POLICY "view_all_users" ON public.users FOR SELECT USING (true);
-- Hanya user ybs bisa edit
CREATE POLICY "update_own_profile" ON public.users FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "insert_own_profile" ON public.users FOR INSERT WITH CHECK (auth.uid()::text = id);

-- 8. POLICY: WORKSPACES (Menggunakan Fungsi Bypass)
-- User bisa lihat workspace jika Owner ATAU Member (via fungsi bypass)
CREATE POLICY "view_accessible_workspaces" ON public.workspaces FOR SELECT USING (
  owner_id = auth.uid()::text 
  OR 
  id IN (SELECT public.get_my_workspace_ids())
);

CREATE POLICY "create_workspaces" ON public.workspaces FOR INSERT WITH CHECK (
  owner_id = auth.uid()::text
);

CREATE POLICY "update_own_workspaces" ON public.workspaces FOR UPDATE USING (
  owner_id = auth.uid()::text
);

-- 9. POLICY: WORKSPACE MEMBERS (Mengandalkan Workspaces)
-- User bisa lihat member dari workspace yang BISA DIA LIHAT.
-- Rantai: Members -> Workspaces Policy -> Fungsi Bypass -> Raw Data. Aman.
CREATE POLICY "view_members" ON public.workspace_members FOR SELECT USING (
  workspace_id IN (SELECT id FROM public.workspaces)
);

-- Hanya owner workspace yang bisa menambah/mengubah member
-- Menggunakan subquery langsung ke workspaces untuk menghindari ambiguitas
CREATE POLICY "manage_members" ON public.workspace_members FOR ALL USING (
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()::text)
);

-- Member bisa leave (hapus diri sendiri)
CREATE POLICY "leave_workspace" ON public.workspace_members FOR DELETE USING (
  user_id = auth.uid()::text
);

-- 10. POLICY: TASKS (Mengandalkan Workspaces)
-- User bisa lihat task di workspace yang BISA DIA LIHAT.
CREATE POLICY "view_tasks" ON public.tasks FOR SELECT USING (
  workspace_id IN (SELECT id FROM public.workspaces)
);

CREATE POLICY "create_tasks" ON public.tasks FOR INSERT WITH CHECK (
  created_by = auth.uid()::text
);

-- Edit/Hapus task: Pembuat task ATAU Owner Workspace
CREATE POLICY "manage_tasks" ON public.tasks FOR ALL USING (
  created_by = auth.uid()::text
  OR
  workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid()::text)
);

-- 11. KHUSUS: PASTIKAN ARUNIKA ADALAH ADMIN
UPDATE public.users 
SET status = 'Admin' 
WHERE email = 'arunika@taskplay.com' OR username = 'arunika';

-- 12. RELOAD CACHE
NOTIFY pgrst, 'reload schema';
