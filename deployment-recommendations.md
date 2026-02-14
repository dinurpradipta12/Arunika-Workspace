
# TaskPlay: Deployment & Scalability

### Deployment Steps (Cloudflare Pages)
1. **Frontend**: Deploy the Next.js App Router project to Cloudflare Pages.
2. **Environment Variables**: Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `API_KEY` (Gemini) in the Cloudflare dashboard.
3. **Custom Domain**: Connect your domain and enable SSL/TLS (Full).
4. **Google OAuth**: Set up a GCP Project, configure the OAuth Consent Screen, and add Cloudflare redirect URIs (`/auth/callback`).

### Backend (Supabase)
- **Supabase Realtime**: Used for immediate UI updates when team members change task statuses.
- **Edge Functions**: Deploy the reminder logic as a Supabase Edge Function triggered by a Cron schedule (PG_CRON).

### Scalability Recommendation
1. **Database Indexing**: Ensure `workspace_id` and `user_id` columns have indexes to speed up RLS checks.
2. **Edge Caching**: Use Cloudflare Workers to cache static assets and common API responses.
3. **Queueing**: For heavy Google Calendar sync operations, use a message queue (like Upstash QStash) to avoid blocking the main request cycle.
4. **Multi-Region**: If the user base grows globally, consider Supabase's Read Replicas to reduce latency.

### Future Features (AI-Driven)
- **Auto-Time Blocking**: Integration with Gemini to automatically find gaps in the calendar for high-priority tasks.
- **Burnout Detection**: Analysis of task completion speed vs. frequency to alert owners of potential team burnout.
