
-- ==========================================
-- SCRIPT DATABASE TASKPLAY (RLS TYPE CAST FIX FINAL)
-- ==========================================

-- 1. Setup Tabel Dasar (Idempotent)
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

-- 2. RESET TOTAL POLICY & FUNCTION
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

-- 3. FUNGSI BYPASS RLS (Jalur Cepat dengan Casting)
DROP FUNCTION IF EXISTS public.get_my_workspace_ids();
CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT workspace_id::text  -- Pastikan output selalu text
    FROM public.workspace_members 
    WHERE user_id::text = auth.uid()::text -- Bandingkan Text vs Text
$$;

-- 4. PERBAIKI CONSTRAINT FOREIGN KEY (Safe Mode)
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_user_id_fkey;
        ALTER TABLE public.workspace_members 
          ADD CONSTRAINT workspace_members_user_id_fkey 
          FOREIGN KEY (user_id) 
          REFERENCES public.users(id) 
          ON DELETE CASCADE;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Skipping Foreign Key creation due to type mismatch: %', SQLERRM;
    END;
END $$;

-- 5. GRANT PERMISSIONS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO authenticated, service_role;
GRANT SELECT ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.workspaces TO authenticated, service_role;
GRANT ALL ON TABLE public.workspace_members TO authenticated, service_role;
GRANT ALL ON TABLE public.tasks TO authenticated, service_role;

-- 6. AKTIFKAN RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 7. POLICY: USERS
CREATE POLICY "view_all_users" ON public.users FOR SELECT USING (true);
CREATE POLICY "update_own_profile" ON public.users FOR UPDATE USING (auth.uid()::text = id::text);
CREATE POLICY "insert_own_profile" ON public.users FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- 8. POLICY: WORKSPACES
-- Casting id::text di sisi kiri memastikan perbandingan IN selalu Text vs Text
CREATE POLICY "view_accessible_workspaces" ON public.workspaces FOR SELECT USING (
  owner_id::text = auth.uid()::text 
  OR 
  id::text IN (SELECT public.get_my_workspace_ids())
);

CREATE POLICY "create_workspaces" ON public.workspaces FOR INSERT WITH CHECK (owner_id::text = auth.uid()::text);
CREATE POLICY "update_own_workspaces" ON public.workspaces FOR UPDATE USING (owner_id::text = auth.uid()::text);
CREATE POLICY "delete_own_workspaces" ON public.workspaces FOR DELETE USING (owner_id::text = auth.uid()::text);

-- 9. POLICY: WORKSPACE MEMBERS
-- Casting workspace_id::text di sisi kiri sangat penting di sini
CREATE POLICY "view_members" ON public.workspace_members FOR SELECT USING (
  workspace_id::text IN (SELECT public.get_my_workspace_ids())
);

-- Manage Members: Owner Only
CREATE POLICY "manage_members" ON public.workspace_members FOR ALL USING (
  workspace_id::text IN (SELECT id::text FROM public.workspaces WHERE owner_id::text = auth.uid()::text)
);

CREATE POLICY "leave_workspace" ON public.workspace_members FOR DELETE USING (
  user_id::text = auth.uid()::text
);

-- 10. POLICY: TASKS
-- Casting workspace_id::text di sisi kiri
CREATE POLICY "view_tasks" ON public.tasks FOR SELECT USING (
  workspace_id::text IN (SELECT public.get_my_workspace_ids())
  OR
  workspace_id::text IN (SELECT id::text FROM public.workspaces WHERE owner_id::text = auth.uid()::text)
);

CREATE POLICY "create_tasks" ON public.tasks FOR INSERT WITH CHECK (created_by::text = auth.uid()::text);

CREATE POLICY "manage_tasks" ON public.tasks FOR ALL USING (
  created_by::text = auth.uid()::text
  OR
  workspace_id::text IN (SELECT id::text FROM public.workspaces WHERE owner_id::text = auth.uid()::text)
);

-- 11. FIX USER ADMIN
UPDATE public.users SET status = 'Admin' WHERE email = 'arunika@taskplay.com' OR username = 'arunika';

-- 12. RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';
