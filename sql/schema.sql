-- Enable RLS
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_calendars ENABLE ROW LEVEL SECURITY;

-- USERS Table
-- Custom profiles table to extend auth.users
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

-- Ensure users can only see and update their own profiles
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own profile') THEN
        CREATE POLICY "Users can manage their own profile" ON public.users
          FOR ALL USING (auth.uid() = id);
    END IF;
END $$;

-- WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('personal', 'team')) DEFAULT 'personal',
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can manage their workspaces') THEN
        CREATE POLICY "Owners can manage their workspaces" ON public.workspaces
          FOR ALL USING (auth.uid() = owner_id);
    END IF;
END $$;

-- WORKSPACE_MEMBERS
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can see their own memberships') THEN
        CREATE POLICY "Users can see their own memberships" ON workspace_members
          FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can manage members') THEN
        CREATE POLICY "Owners can manage members" ON workspace_members
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM workspaces 
              WHERE id = workspace_members.workspace_id AND owner_id = auth.uid()
            )
          );
    END IF;
END $$;

-- Policy for members to see workspaces
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Members can view workspaces') THEN
        CREATE POLICY "Members can view workspaces" ON workspaces
          FOR SELECT USING (
            id IN (
              SELECT workspace_id FROM workspace_members 
              WHERE user_id = auth.uid()
            )
          );
    END IF;
END $$;

-- TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  due_date TIMESTAMP WITH TIME ZONE,
  start_date TIMESTAMP WITH TIME ZONE,
  is_all_day BOOLEAN DEFAULT TRUE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('todo', 'in_progress', 'done')) DEFAULT 'todo',
  is_archived BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage tasks in accessible workspaces') THEN
        CREATE POLICY "Users can manage tasks in accessible workspaces" ON tasks
          FOR ALL USING (
            workspace_id IN (SELECT id FROM workspaces)
          );
    END IF;
END $$;

-- USER CALENDARS
CREATE TABLE IF NOT EXISTS user_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  calendar_id TEXT NOT NULL,
  summary TEXT,
  timezone TEXT,
  access_role TEXT,
  is_selected BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, calendar_id)
);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own calendar list') THEN
        CREATE POLICY "Users can manage their own calendar list" ON user_calendars
          FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type TEXT,
  reference_id TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own notifications') THEN
        CREATE POLICY "Users can manage their own notifications" ON notifications
          FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;
