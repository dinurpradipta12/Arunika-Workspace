
import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://pbheoefyraqjrctjrmzy.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiaGVvZWZ5cmFxanJjdGpybXp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDQxNTcsImV4cCI6MjA4NjU4MDE1N30.dtVLeKi2B50bWE0shWIvVgMBQK7y56cjykbxTHHkr4g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Mock data as fallback or for reference
export const mockData = {
  user: {
    id: 'user-123',
    email: 'hello@example.com',
    name: 'Jane Doe',
    avatar_url: 'https://picsum.photos/200'
  },
  workspaces: [
    { id: 'ws-1', name: 'My Personal Workspace', type: 'personal', owner_id: 'user-123' },
    { id: 'ws-2', name: 'Growth Team', type: 'team', owner_id: 'user-123' }
  ],
  tasks: []
};
