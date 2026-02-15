-- =====================================================
-- TASKPLAY FINAL SAFE SCRIPT (NO UUID ERROR)
-- =====================================================

-- WAJIB UNTUK gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. PASTIKAN TABEL ADA (UUID VERSION)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT,
  name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'Member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  app_settings JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  category TEXT DEFAULT 'General',
  description TEXT
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  start_date TIMESTAMP WITH TIME ZONE,
  is_all_day BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_archived BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'General',
  google_event_id TEXT,
  google_calendar_id TEXT
);

-- =====================================================
-- 2. HAPUS POLICY LAMA (ANTI RECURSION)
-- =====================================================

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('users','workspaces','workspace_members','tasks')
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname ||
            '" ON public.' || pol.tablename;
  END LOOP;
END $$;

-- =====================================================
-- 3. ENABLE RLS
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. USERS POLICY
-- =====================================================

CREATE POLICY users_select_all
ON public.users FOR SELECT
USING (true);

CREATE POLICY users_insert_self
ON public.users FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY users_update_self
ON public.users FOR UPDATE
USING (auth.uid() = id);

-- =====================================================
-- 5. WORKSPACES POLICY
-- =====================================================

CREATE POLICY workspaces_select_access
ON public.workspaces FOR SELECT
USING (
  owner_id = auth.uid()
  OR
  id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY workspaces_insert_owner
ON public.workspaces FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY workspaces_update_owner
ON public.workspaces FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY workspaces_delete_owner
ON public.workspaces FOR DELETE
USING (owner_id = auth.uid());

-- =====================================================
-- 6. WORKSPACE MEMBERS POLICY
-- =====================================================

CREATE POLICY members_select
ON public.workspace_members FOR SELECT
USING (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  )
);

CREATE POLICY members_insert_owner
ON public.workspace_members FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  )
);

CREATE POLICY members_delete
ON public.workspace_members FOR DELETE
USING (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  )
);

-- =====================================================
-- 7. TASK POLICY (AMAN & TANPA TYPE ERROR)
-- =====================================================

CREATE POLICY tasks_select_access
ON public.tasks FOR SELECT
USING (
  created_by = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
  OR
  workspace_id IN (
    SELECT id
    FROM public.workspaces
    WHERE owner_id = auth.uid()
  )
);

CREATE POLICY tasks_insert_owner
ON public.tasks FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY tasks_update_access
ON public.tasks FOR UPDATE
USING (
  created_by = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
  OR
  workspace_id IN (
    SELECT id
    FROM public.workspaces
    WHERE owner_id = auth.uid()
  )
);

CREATE POLICY tasks_delete_access
ON public.tasks FOR DELETE
USING (
  created_by = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM public.workspace_members
    WHERE user_id = auth.uid()
  )
  OR
  workspace_id IN (
    SELECT id
    FROM public.workspaces
    WHERE owner_id = auth.uid()
  )
);

-- =====================================================
-- 8. GRANT ACCESS
-- =====================================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- =====================================================
-- 9. SET ADMIN (ARUNIKA)
-- =====================================================

UPDATE public.users
SET status = 'Admin'
WHERE email = 'arunika@taskplay.com'
   OR username = 'arunika';

-- =====================================================
-- 10. RELOAD POSTGREST
-- =====================================================

NOTIFY pgrst, 'reload schema';