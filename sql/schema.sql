-- ==========================================================
-- SCRIPT AKTIVASI WORKSPACE & SINKRONISASI USER OTOMATIS
-- ==========================================================

-- 1. Pastikan Ekstensi UUID tersedia
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Buat/Update Tabel Users (Profil Publik)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'Active',
  app_settings JSONB DEFAULT '{
    "notificationsEnabled": true,
    "sourceColors": {},
    "visibleSources": []
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Fungsi Sinkronisasi Otomatis (Auth -> Public Users)
-- Ini memastikan setiap user yang mendaftar langsung terdaftar di tabel profil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || new.id)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang Trigger ke tabel auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Tabel Workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('personal', 'team')) DEFAULT 'personal',
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabel Workspace Members
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- 6. MENGAKTIFKAN RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- 7. KEBIJAKAN (POLICIES) - INI BAGIAN KRUSIAL
-- Users: Siapa saja bisa melihat user lain (untuk pencarian tim), tapi hanya bisa edit profil sendiri
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can edit own profile" ON public.users;
CREATE POLICY "Users can edit own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Workspaces: Owner dan Member bisa melihat
DROP POLICY IF EXISTS "Users can view accessible workspaces" ON public.workspaces;
CREATE POLICY "Users can view accessible workspaces" ON public.workspaces
  FOR SELECT USING (
    auth.uid() = owner_id OR 
    id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );

-- Workspace Members: Izin agar Admin bisa mendaftarkan user baru
DROP POLICY IF EXISTS "Admins can manage members" ON public.workspace_members;
CREATE POLICY "Admins can manage members" ON public.workspace_members
  FOR ALL USING (
    workspace_id IN (
      -- Hanya izinkan jika user yang sedang login adalah owner atau admin di workspace tersebut
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (true);

-- Member biasa bisa melihat siapa saja rekan setimnya
DROP POLICY IF EXISTS "Members can view teammates" ON public.workspace_members;
CREATE POLICY "Members can view teammates" ON public.workspace_members
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );
