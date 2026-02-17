
-- ==========================================
-- SCRIPT PERBAIKAN PERMISSIONS FINAL (FIX 42501)
-- Jalankan script ini di SQL Editor Supabase
-- ==========================================

-- 1. Ensure Tables Exist (Idempotent)
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

-- 2. EXPLICIT GRANTS (Fix Permission Denied at Table Level)
-- Ini penting karena kadang RLS aktif tapi role tidak punya izin 'USAGE' atau 'ALL'
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON TABLE public.task_comments TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.task_comment_reactions TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO postgres, anon, authenticated, service_role; -- Ensure users can be joined

-- 3. RLS POLICIES (Fix Permission Denied at Row Level)
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy for Comments: Allow EVERYTHING for ANYONE
-- USING(true) WITH CHECK(true) artinya "Bolehkan semua baris"
DROP POLICY IF EXISTS "Allow all for task_comments" ON public.task_comments;
CREATE POLICY "Allow all for task_comments" 
ON public.task_comments 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Policy for Reactions
DROP POLICY IF EXISTS "Allow all for task_comment_reactions" ON public.task_comment_reactions;
CREATE POLICY "Allow all for task_comment_reactions" 
ON public.task_comment_reactions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Policy for Users (Agar bisa join nama user di komentar)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.users 
FOR SELECT 
USING (true);

-- 4. Refresh API Cache
NOTIFY pgrst, 'reload config';
