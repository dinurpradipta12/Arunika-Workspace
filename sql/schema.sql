
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

-- 2. HARD RESET GRANTS (Kunci Perbaikan 42501)
-- Memberikan hak akses penuh ke level schema dan tabel
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON TABLE public.task_comments TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.task_comment_reactions TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO postgres, anon, authenticated, service_role;

-- Grant sequence permissions just in case
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 3. RLS POLICIES (Row Level Access)
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Reset Policies for Comments to be absolutely open
DROP POLICY IF EXISTS "Allow all for task_comments" ON public.task_comments;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.task_comments;

CREATE POLICY "Allow all for task_comments" 
ON public.task_comments 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Reset Policies for Reactions
DROP POLICY IF EXISTS "Allow all for task_comment_reactions" ON public.task_comment_reactions;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.task_comment_reactions;

CREATE POLICY "Allow all for task_comment_reactions" 
ON public.task_comment_reactions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Ensure Users are readable
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.users 
FOR SELECT 
USING (true);

-- 4. Refresh API Cache
NOTIFY pgrst, 'reload config';
