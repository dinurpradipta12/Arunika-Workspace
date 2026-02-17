
-- ==========================================
-- SCRIPT PERBAIKAN TOTAL PERMISSIONS (FIX 42501)
-- Jalankan script ini di SQL Editor Supabase
-- ==========================================

-- 1. Ensure Tables Exist
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
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

-- 2. HARD RESET GRANTS (Kunci Perbaikan 42501)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON TABLE public.task_comments TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.task_comment_reactions TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.notifications TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 3. RLS POLICIES (Row Level Access)
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Reset Policies for Comments
DROP POLICY IF EXISTS "Allow all for task_comments" ON public.task_comments;
CREATE POLICY "Allow all for task_comments" ON public.task_comments FOR ALL USING (true) WITH CHECK (true);

-- Reset Policies for Reactions
DROP POLICY IF EXISTS "Allow all for task_comment_reactions" ON public.task_comment_reactions;
CREATE POLICY "Allow all for task_comment_reactions" ON public.task_comment_reactions FOR ALL USING (true) WITH CHECK (true);

-- Reset Policies for Notifications (CRITICAL FOR POPUP)
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

-- Ensure Users are readable
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
CREATE POLICY "Public profiles are viewable by everyone" ON public.users FOR SELECT USING (true);

-- 4. ENABLE REALTIME (CRITICAL FOR POPUP TO APPEAR WITHOUT REFRESH)
-- This forces the notifications table to broadcast changes
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.tasks, public.task_comments, public.task_comment_reactions, public.notifications, public.workspace_members;
COMMIT;

-- 5. Refresh API Cache
NOTIFY pgrst, 'reload config';
