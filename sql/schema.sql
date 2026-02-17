
-- ==========================================
-- SCRIPT PERBAIKAN TOTAL PERMISSIONS & LOOKUP LOGIN
-- Jalankan script ini di SQL Editor Supabase
-- ==========================================

-- ADD NEW COLUMNS TO USERS TABLE IF NOT EXIST
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio') THEN
        ALTER TABLE public.users ADD COLUMN bio TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'custom_status') THEN
        ALTER TABLE public.users ADD COLUMN custom_status TEXT;
    END IF;
END $$;

-- 1. Ensure Tables Exist
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id TEXT,
    parent_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to TEXT,
    due_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    is_all_day BOOLEAN DEFAULT TRUE,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'todo',
    google_event_id TEXT,
    google_calendar_id TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT FALSE,
    category TEXT,
    assets JSONB
);

CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_comment_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id UUID NOT NULL REFERENCES public.task_comments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- WORKSPACE CHAT TABLES
CREATE TABLE IF NOT EXISTS public.workspace_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.workspace_messages(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_messages' AND column_name = 'parent_id') THEN
        ALTER TABLE public.workspace_messages ADD COLUMN parent_id UUID REFERENCES public.workspace_messages(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.workspace_message_reads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES public.workspace_messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.workspace_message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES public.workspace_messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- 2. HARD RESET GRANTS
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON TABLE public.tasks TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.task_comments TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.task_comment_reactions TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.notifications TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.workspace_messages TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.workspace_message_reads TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.workspace_message_reactions TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.workspaces TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.workspace_members TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 3. RLS POLICIES
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Reset Policies for Tasks (CRITICAL FIX)
DROP POLICY IF EXISTS "Allow all for tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks" ON public.tasks;

-- Simplified Task Policy: Authenticated users can do anything with tasks
-- This fixes the 403 Forbidden error when creating/editing tasks
CREATE POLICY "Allow full access to tasks for authenticated users" 
ON public.tasks 
FOR ALL 
USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');

-- Reset Policies for Comments
DROP POLICY IF EXISTS "Allow all for task_comments" ON public.task_comments;
CREATE POLICY "Allow all for task_comments" ON public.task_comments FOR ALL USING (true) WITH CHECK (true);

-- Reset Policies for Reactions
DROP POLICY IF EXISTS "Allow all for task_comment_reactions" ON public.task_comment_reactions;
CREATE POLICY "Allow all for task_comment_reactions" ON public.task_comment_reactions FOR ALL USING (true) WITH CHECK (true);

-- Reset Policies for Notifications
DROP POLICY IF EXISTS "Users can select their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

CREATE POLICY "Users can select their own notifications" ON public.notifications FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true); 
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (auth.uid()::text = user_id);

-- Workspace Chat Policies
DROP POLICY IF EXISTS "Allow all for workspace_messages" ON public.workspace_messages;
CREATE POLICY "Allow all for workspace_messages" ON public.workspace_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for workspace_message_reads" ON public.workspace_message_reads;
CREATE POLICY "Allow all for workspace_message_reads" ON public.workspace_message_reads FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for workspace_message_reactions" ON public.workspace_message_reactions;
CREATE POLICY "Allow all for workspace_message_reactions" ON public.workspace_message_reactions FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- CRITICAL FIX FOR LOGIN: ALLOW PUBLIC READ ACCESS TO USERS TABLE
-- =========================================================================
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
-- Mengizinkan anon (sebelum login) untuk membaca tabel users guna lookup email dari username
CREATE POLICY "Public profiles are viewable by everyone" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.users;
CREATE POLICY "Allow insert for authenticated users" ON public.users FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Workspace & Members Policies
DROP POLICY IF EXISTS "Allow read access for workspaces" ON public.workspaces;
CREATE POLICY "Allow read access for workspaces" ON public.workspaces FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.workspaces;
CREATE POLICY "Allow insert for authenticated users" ON public.workspaces FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow update for owners" ON public.workspaces;
CREATE POLICY "Allow update for owners" ON public.workspaces FOR UPDATE USING (auth.uid()::text = owner_id);

DROP POLICY IF EXISTS "Allow delete for owners" ON public.workspaces;
CREATE POLICY "Allow delete for owners" ON public.workspaces FOR DELETE USING (auth.uid()::text = owner_id);

DROP POLICY IF EXISTS "Allow read access for workspace members" ON public.workspace_members;
CREATE POLICY "Allow read access for workspace members" ON public.workspace_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.workspace_members;
CREATE POLICY "Allow insert for authenticated users" ON public.workspace_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow update/delete for members" ON public.workspace_members;
CREATE POLICY "Allow update/delete for members" ON public.workspace_members FOR ALL USING (auth.role() = 'authenticated');

-- =========================================================================
-- SUPERUSER AUTO-CONFIRMATION TRIGGER
-- This ensures 'arunika' or other superusers are always active and confirmed
-- =========================================================================

-- Trigger to enforce superuser status in public.users
CREATE OR REPLACE FUNCTION enforce_superuser_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Jika username adalah arunika, paksa jadi Owner dan Active
  IF LOWER(NEW.username) = 'arunika' OR LOWER(NEW.email) LIKE '%arunika%' THEN
    NEW.status := 'Owner';
    NEW.is_active := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_upsert_superuser ON public.users;
CREATE TRIGGER on_user_upsert_superuser
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION enforce_superuser_status();

-- 4. ENABLE REALTIME
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.users, public.tasks, public.task_comments, public.task_comment_reactions, public.notifications, public.workspace_members, public.workspace_messages, public.workspace_message_reads, public.workspace_message_reactions, public.workspaces;
COMMIT;

NOTIFY pgrst, 'reload config';
