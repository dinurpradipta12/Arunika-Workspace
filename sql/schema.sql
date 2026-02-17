
-- ==========================================
-- SCRIPT PERBAIKAN TOTAL PERMISSIONS (FIX TYPE MISMATCH & CHAT FEATURES)
-- Jalankan script ini di SQL Editor Supabase
-- ==========================================

-- 1. Ensure Tables Exist
-- Menggunakan TEXT untuk task_id agar cocok dengan tabel tasks yang mungkin menggunakan string ID
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
    type TEXT NOT NULL, -- 'comment_reply', 'reaction', 'task_completed', etc
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- WORKSPACE CHAT TABLES
-- Menggunakan TEXT untuk workspace_id agar cocok dengan tabel workspaces (fix error 42804)
CREATE TABLE IF NOT EXISTS public.workspace_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.workspace_messages(id) ON DELETE SET NULL, -- Added for Reply
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MIGRATION: Ensure parent_id exists if table already existed without it
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

-- Added for Workspace Chat Reactions
CREATE TABLE IF NOT EXISTS public.workspace_message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES public.workspace_messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- 2. HARD RESET GRANTS (Kunci Perbaikan Permissions)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON TABLE public.task_comments TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.task_comment_reactions TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.notifications TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.workspace_messages TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.workspace_message_reads TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.workspace_message_reactions TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 3. RLS POLICIES (Row Level Access)
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_message_reactions ENABLE ROW LEVEL SECURITY;

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

-- Allow users to see their own notifications
CREATE POLICY "Users can select their own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid()::text = user_id);

-- Allow anyone (system/other users) to insert notifications for others
CREATE POLICY "Users can insert notifications" 
ON public.notifications FOR INSERT 
WITH CHECK (true); 

-- Allow users to update (mark read) their own notifications
CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid()::text = user_id);

-- Allow users to delete their own notifications
CREATE POLICY "Users can delete their own notifications" 
ON public.notifications FOR DELETE 
USING (auth.uid()::text = user_id);

-- Workspace Chat Policies
DROP POLICY IF EXISTS "Allow all for workspace_messages" ON public.workspace_messages;
CREATE POLICY "Allow all for workspace_messages" ON public.workspace_messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for workspace_message_reads" ON public.workspace_message_reads;
CREATE POLICY "Allow all for workspace_message_reads" ON public.workspace_message_reads FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for workspace_message_reactions" ON public.workspace_message_reactions;
CREATE POLICY "Allow all for workspace_message_reactions" ON public.workspace_message_reactions FOR ALL USING (true) WITH CHECK (true);

-- Ensure Users are readable
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
CREATE POLICY "Public profiles are viewable by everyone" ON public.users FOR SELECT USING (true);

-- 4. ENABLE REALTIME (CRITICAL FOR POPUP TO APPEAR WITHOUT REFRESH)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.tasks, public.task_comments, public.task_comment_reactions, public.notifications, public.workspace_members, public.workspace_messages, public.workspace_message_reads, public.workspace_message_reactions;
COMMIT;

-- 5. Refresh API Cache
NOTIFY pgrst, 'reload config';
