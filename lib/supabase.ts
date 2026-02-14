
// In a real application, you would use createClient from @supabase/supabase-js
// with actual environment variables. Here we provide a conceptual setup.

export const supabaseConfig = {
  url: 'https://placeholder.supabase.co',
  key: 'placeholder-key',
};

// Mock Supabase implementation for the demo
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
  tasks: [
    { 
      id: 't-1', 
      workspace_id: 'ws-1', 
      title: 'Design high-fidelity wireframes', 
      status: 'in_progress', 
      priority: 'high', 
      due_date: new Date().toISOString() 
    },
    { 
      id: 't-2', 
      workspace_id: 'ws-1', 
      title: 'Update design system documentation', 
      status: 'todo', 
      priority: 'medium', 
      due_date: new Date(Date.now() + 86400000).toISOString() 
    }
  ]
};
