
-- ==========================================
-- SCRIPT MIGRASI AMAN (SAFE MIGRATION)
-- Jalankan script ini di SQL Editor Supabase
-- Data lama TIDAK AKAN HILANG.
-- ==========================================

-- 1. Tambahkan kolom 'assets' ke tabel 'tasks' jika belum ada
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='assets') THEN
        ALTER TABLE public.tasks ADD COLUMN assets JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. Tambahkan kolom 'logo_url' ke tabel 'workspaces' jika belum ada (FIX ERROR: PGRST204)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workspaces' AND column_name='logo_url') THEN
        ALTER TABLE public.workspaces ADD COLUMN logo_url TEXT;
    END IF;
END $$;

-- 3. Fungsi untuk Menangani Notifikasi saat Task Di-Assign
CREATE OR REPLACE FUNCTION public.handle_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  assigner_name TEXT;
BEGIN
  -- Cek jika assigned_to diisi (INSERT) atau berubah (UPDATE)
  IF (TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to <> NEW.assigned_to)) THEN
     
     -- Jangan kirim notifikasi jika assign ke diri sendiri
     IF NEW.assigned_to <> NEW.created_by THEN
        -- Ambil nama pembuat task (assigner)
        SELECT name INTO assigner_name FROM public.users WHERE id = NEW.created_by;
        
        -- Masukkan notifikasi ke database (Supabase Realtime akan menangkap INSERT ini)
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

-- 4. Pasang Trigger ke tabel Tasks
DROP TRIGGER IF EXISTS on_task_assigned ON public.tasks;
CREATE TRIGGER on_task_assigned
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.handle_task_assignment();

-- 5. Force Schema Cache Reload (Agar API langsung mengenali kolom baru)
NOTIFY pgrst, 'reload config';
