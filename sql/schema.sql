
-- ==========================================
-- SCRIPT DATABASE TASKPLAY (DEV MODE: AUTO CONFIRM v14 - ADMIN CONTROL)
-- ==========================================

-- 1. DROP EXISTING TABLES (CLEANUP)
DROP TABLE IF EXISTS public.app_config CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Cleanup Triggers & Functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_signup_confirm ON auth.users;
DROP TRIGGER IF EXISTS on_task_assigned ON public.tasks; -- New Trigger Cleanup
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.auto_confirm_email() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_workspace_ids() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_owned_workspace_ids() CASCADE;
DROP FUNCTION IF EXISTS public.join_workspace_by_code(text) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_or_owner() CASCADE;
DROP FUNCTION IF EXISTS public.handle_task_assignment() CASCADE; -- New Function Cleanup

-- 2. CREATE TABLES
CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
  email TEXT,
  username TEXT,
  name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'Member', -- System Role
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  app_settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true, -- Status Login Active/Non-Active
  temp_password TEXT -- Disimpan untuk Admin (Sesuai Request)
);

-- Table for Global App Configuration (Single Row)
CREATE TABLE public.app_config (
  id INT PRIMARY KEY DEFAULT 1,
  app_name TEXT DEFAULT 'TaskPlay',
  app_logo TEXT,
  app_favicon TEXT,
  updated_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert Default Config
INSERT INTO public.app_config (id, app_name) VALUES (1, 'TaskPlay') ON CONFLICT DO NOTHING;

CREATE TABLE public.workspaces (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  category TEXT DEFAULT 'General',
  description TEXT,
  join_code TEXT DEFAULT UPPER(substring(md5(random()::text) from 0 for 7)),
  notepad TEXT,
  assets JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE public.workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- Workspace Role (admin/member)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id) 
);

CREATE TABLE public.tasks (
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
  assigned_to TEXT REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_archived BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'General',
  google_event_id TEXT,
  google_calendar_id TEXT,
  assets JSONB DEFAULT '[]'::jsonb -- NEW: Task specific assets
);

CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, 
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. FUNCTIONS & TRIGGERS

-- Auto Confirm Email
CREATE OR REPLACE FUNCTION public.auto_confirm_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_signup_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.auto_confirm_email();

-- User Sync
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, username, avatar_url, status, is_active)
  VALUES (
    new.id::text, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'name', new.email),
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    'Member',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger: Handle Task Assignment Notification
CREATE OR REPLACE FUNCTION public.handle_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  assigner_name TEXT;
BEGIN
  -- Cek jika assigned_to diisi atau berubah
  IF (TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to <> NEW.assigned_to)) THEN
     
     -- Jangan kirim notifikasi jika assign ke diri sendiri
     IF NEW.assigned_to <> NEW.created_by THEN
        -- Ambil nama pembuat task
        SELECT name INTO assigner_name FROM public.users WHERE id = NEW.created_by;
        
        INSERT INTO public.notifications (user_id, type, title, message, metadata)
        VALUES (
          NEW.assigned_to,
          'assignment',
          'Tugas Baru Diberikan',
          COALESCE(assigner_name, 'Seseorang') || ' menugaskan Anda: ' || NEW.title,
          jsonb_build_object('task_id', NEW.id, 'workspace_id', NEW.workspace_id)
        );
     END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_task_assigned
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.handle_task_assignment();


-- FUNCTION: Join Workspace By Code
CREATE OR REPLACE FUNCTION public.join_workspace_by_code(code_input TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_ws RECORD;
  is_member BOOLEAN;
  current_user_id TEXT;
  current_user_name TEXT;
BEGIN
  current_user_id := auth.uid()::text;
  
  -- 1. Cari Workspace
  SELECT * INTO target_ws FROM public.workspaces WHERE join_code = UPPER(code_input);
  
  IF target_ws.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kode workspace tidak valid.');
  END IF;

  -- 2. Cek apakah sudah member
  SELECT EXISTS(SELECT 1 FROM public.workspace_members WHERE workspace_id = target_ws.id AND user_id = current_user_id) INTO is_member;
  
  IF is_member THEN
    RETURN jsonb_build_object('success', false, 'message', 'Anda sudah menjadi anggota workspace ini.');
  END IF;

  -- 3. Masukkan sebagai Member
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (target_ws.id, current_user_id, 'member');

  -- 4. Kirim Notifikasi ke Owner
  SELECT name INTO current_user_name FROM public.users WHERE id = current_user_id;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    target_ws.owner_id, 
    'join_workspace', 
    'Anggota Baru Bergabung', 
    COALESCE(current_user_name, 'Seseorang') || ' telah bergabung ke workspace ' || target_ws.name || ' menggunakan kode akses.',
    jsonb_build_object('workspace_id', target_ws.id, 'joiner_id', current_user_id)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Berhasil bergabung ke ' || target_ws.name, 'workspace_id', target_ws.id);
END;
$$;

-- 4. BACKFILL & SYNC
DO $$
BEGIN
    UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;
END $$;

INSERT INTO public.users (id, email, name, username, avatar_url, status, is_active)
SELECT 
  id::text, 
  email, 
  COALESCE(raw_user_meta_data->>'name', email), 
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)), 
  COALESCE(raw_user_meta_data->>'avatar_url', ''),
  'Member',
  true
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 5. RLS HELPERS
CREATE OR REPLACE FUNCTION public.get_my_owned_workspace_ids()
RETURNS SETOF text
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT id FROM public.workspaces WHERE owner_id = auth.uid()::text $$;

CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF text
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()::text $$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$ 
  SELECT EXISTS(
    SELECT 1 FROM public.users 
    WHERE id = auth.uid()::text 
    AND (status ILIKE 'Admin' OR status ILIKE 'Owner')
  ) 
$$;

-- 6. RLS POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY "Users view all" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users update self or admin" ON public.users FOR UPDATE USING (true); 
CREATE POLICY "System insert users" ON public.users FOR INSERT WITH CHECK (true);

-- App Config
CREATE POLICY "Everyone view config" ON public.app_config FOR SELECT USING (true);
CREATE POLICY "Admins manage config" ON public.app_config FOR ALL USING (public.is_admin_or_owner());

-- Workspaces
CREATE POLICY "View workspaces" ON public.workspaces FOR SELECT USING (
  owner_id = auth.uid()::text OR id IN (SELECT public.get_my_workspace_ids())
);
CREATE POLICY "Manage owned workspaces" ON public.workspaces FOR ALL USING (owner_id = auth.uid()::text);
CREATE POLICY "Create workspaces" ON public.workspaces FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Members
CREATE POLICY "View members" ON public.workspace_members FOR SELECT USING (
  workspace_id IN (SELECT public.get_my_owned_workspace_ids()) OR workspace_id IN (SELECT public.get_my_workspace_ids())
);
CREATE POLICY "Manage members" ON public.workspace_members FOR ALL USING (
  workspace_id IN (SELECT public.get_my_owned_workspace_ids())
);
CREATE POLICY "Self leave" ON public.workspace_members FOR DELETE USING (user_id = auth.uid()::text);

-- Tasks
CREATE POLICY "View tasks" ON public.tasks FOR SELECT USING (
  workspace_id IN (SELECT public.get_my_owned_workspace_ids()) OR workspace_id IN (SELECT public.get_my_workspace_ids())
);
CREATE POLICY "Manage tasks" ON public.tasks FOR ALL USING (
  workspace_id IN (SELECT public.get_my_owned_workspace_ids()) OR workspace_id IN (SELECT public.get_my_workspace_ids())
);

-- Notifications
CREATE POLICY "View own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "System insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid()::text);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

NOTIFY pgrst, 'reload schema';
