
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_calendars ENABLE ROW LEVEL SECURITY;

-- USERS
-- Ensure users can only see and update their own profiles
CREATE POLICY "Users can manage their own profile" ON users
  FOR ALL USING (auth.uid() = id);

-- WORKSPACES
-- Policy 1: Owners can see their workspaces
CREATE POLICY "Owners can manage their workspaces" ON workspaces
  FOR ALL USING (auth.uid() = owner_id);

-- Policy 2: Members can see workspaces (Non-recursive check)
-- This relies on workspace_members having a simple policy
CREATE POLICY "Members can view workspaces" ON workspaces
  FOR SELECT USING (
    id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- WORKSPACE_MEMBERS (Missing table from previous version)
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- CRITICAL: This policy must be simple to avoid recursion
CREATE POLICY "Users can see their own memberships" ON workspace_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owners can manage members" ON workspace_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE id = workspace_members.workspace_id AND owner_id = auth.uid()
    )
  );

-- TASKS
-- Simplified: If you can see the workspace, you can see the tasks
CREATE POLICY "Users can manage tasks in accessible workspaces" ON tasks
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces)
  );

-- USER CALENDARS
CREATE TABLE user_calendars (
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

CREATE POLICY "Users can manage their own calendar list" ON user_calendars
  FOR ALL USING (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type TEXT,
  reference_id TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE POLICY "Users can manage their own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);
