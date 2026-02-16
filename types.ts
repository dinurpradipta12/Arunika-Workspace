
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  DONE = 'done'
}

export enum WorkspaceType {
  PERSONAL = 'personal',
  TEAM = 'team'
}

export enum MemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member'
}

export interface User {
  id: string;
  email: string;
  username?: string; 
  name: string;
  avatar_url: string;
  created_at: string;
  last_seen?: string;
  status?: string;
  is_active?: boolean;
  temp_password?: string;
  app_settings?: {
    // appName, appLogo, appFavicon moved to AppConfig for global sync
    notificationsEnabled?: boolean;
    sourceColors?: Record<string, string>;
    visibleSources?: string[];
    googleAccessToken?: string; 
    googleConnected?: boolean; // New field to persist connection status
  };
}

// New Interface for Global Branding
export interface AppConfig {
  id: number;
  app_name: string;
  app_logo: string;
  app_favicon: string;
  updated_at?: string;
}

export interface WorkspaceAsset {
  id: number;
  name: string;
  url: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  owner_id: string;
  created_at: string;
  description?: string;
  category?: string;
  join_code?: string;
  notepad?: string; // New: Persisted Notepad Content
  assets?: WorkspaceAsset[]; // New: Persisted Assets List
  logo_url?: string; // NEW: Custom Workspace Icon (Base64 or URL)
}

export interface Task {
  id: string;
  workspace_id: string;
  parent_id?: string;
  title: string;
  description?: string;
  assigned_to?: string;
  due_date?: string; 
  start_date?: string;
  is_all_day?: boolean;
  priority: TaskPriority;
  status: TaskStatus;
  google_event_id?: string;
  google_calendar_id?: string;
  created_by: string;
  created_at: string;
  completed_at?: string;
  is_archived?: boolean;
  category?: string;
  assets?: WorkspaceAsset[]; // NEW FIELD: Task specific assets
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata?: any;
}

export interface MessageReaction {
  id: string;
  emoji: string;
  user_ids: string[];
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  reactions?: MessageReaction[];
  parent_id?: string;
  is_optimistic?: boolean;
  reply_count?: number;
}

export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface PresenceState {
  [key: string]: {
    online: boolean;
    last_seen: string;
  };
}
