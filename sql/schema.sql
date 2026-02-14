-- Enable RLS
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_calendars ENABLE ROW LEVEL SECURITY;

-- USERS Table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'Member',
  app_settings JSONB DEFAULT '{
    "notificationsEnabled": true,
    "sourceColors": {},
    "visibleSources": []
  }'::jsonb,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kebijakan User: Hanya bisa melihat & edit profil sendiri
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can manage their own profile" ON public.users;
    CREATE POLICY "Users can manage their own profile" ON public.users
      FOR ALL USING (auth.uid() = id);
END $$;

-- WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('personal', 'team')) DEFAULT 'personal',
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kebijakan Workspace: User bisa melihat workspace miliknya ATAU di mana dia menjadi member
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view accessible workspaces" ON public.workspaces;
    CREATE POLICY "Users can view accessible workspaces" ON public.workspaces
      FOR SELECT USING (
        auth.uid() = owner_id OR 
        id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
      );

    DROP POLICY IF EXISTS "Owners can manage workspaces" ON public.workspaces;
    CREATE POLICY "Owners can manage workspaces" ON public.workspaces
      FOR ALL USING (auth.uid() = owner_id);
END $$;

-- WORKSPACE_MEMBERS
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can see their own memberships" ON public.workspace_members;
    CREATE POLICY "Users can see their own memberships" ON public.workspace_members
      FOR SELECT USING (auth.uid() = user_id);
END $$;

-- TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES public.users(id),
  due_date TIMESTAMP WITH TIME ZONE,
  start_date TIMESTAMP WITH TIME ZONE,
  is_all_day BOOLEAN DEFAULT TRUE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('todo', 'in_progress', 'done')) DEFAULT 'todo',
  is_archived BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Kebijakan Task: User hanya bisa akses task jika mereka anggota workspace tersebut
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can manage tasks in accessible workspaces" ON public.tasks;
    CREATE POLICY "Users can manage tasks in accessible workspaces" ON public.tasks
      FOR ALL USING (
        workspace_id IN (
          SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
          UNION
          SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
        )
      );
END $$;
