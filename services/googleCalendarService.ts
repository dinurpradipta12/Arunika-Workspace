
export const GOOGLE_CLIENT_ID = '1053561763575-ms46mm7vb0rsjtsc6u44o8nuo9lo1oas.apps.googleusercontent.com';

export interface GoogleCalendar {
  id: string;
  summary: string;
  backgroundColor?: string;
  primary?: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

declare global {
  interface Window {
    google: any;
  }
}

export class GoogleCalendarService {
  private tokenClient: any;

  constructor(onTokenReceived: (token: string) => void) {
    if (typeof window !== 'undefined' && window.google) {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
        prompt: 'consent',
        callback: (response: any) => {
          if (response.error) {
            console.error("Google Auth Error:", response.error);
            return;
          }
          if (response.access_token) {
            onTokenReceived(response.access_token);
          }
        },
      });
    }
  }

  public requestAccessToken() {
    if (this.tokenClient) {
      this.tokenClient.requestAccessToken();
    } else {
      console.error("Google GIS client not initialized");
    }
  }

  public async fetchCalendars(accessToken: string): Promise<GoogleCalendar[]> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/users/me/calendarList`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch calendar list");
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error("Error fetching calendars:", error);
      return [];
    }
  }

  public async fetchEvents(accessToken: string, calendarId: string = 'primary'): Promise<GoogleCalendarEvent[]> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${new Date().toISOString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch calendar events: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error("Error fetching Google Calendar events:", error);
      throw error;
    }
  }

  public async createEvent(accessToken: string, task: any, calendarId: string = 'primary'): Promise<any> {
    try {
      const isAllDay = task.is_all_day;
      const start = isAllDay 
        ? { date: task.start_date ? task.start_date.split('T')[0] : new Date().toISOString().split('T')[0] }
        : { dateTime: task.start_date ? new Date(task.start_date).toISOString() : new Date().toISOString() };
      
      const end = isAllDay 
        ? { date: task.due_date ? task.due_date.split('T')[0] : new Date().toISOString().split('T')[0] }
        : { dateTime: task.due_date ? new Date(task.due_date).toISOString() : new Date(Date.now() + 3600000).toISOString() };

      const event = {
        summary: task.title,
        description: task.description || 'Task created via TaskPlay',
        start,
        end,
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) throw new Error("Failed to create Google Calendar event");
      return await response.json();
    } catch (error) {
      console.error("Error creating Google Calendar event:", error);
      return null;
    }
  }

  public async updateEvent(accessToken: string, eventId: string, task: any, calendarId: string = 'primary'): Promise<any> {
    try {
      const isAllDay = task.is_all_day;
      const start = isAllDay 
        ? { date: task.start_date ? task.start_date.split('T')[0] : new Date().toISOString().split('T')[0] }
        : { dateTime: task.start_date ? new Date(task.start_date).toISOString() : new Date().toISOString() };
      
      const end = isAllDay 
        ? { date: task.due_date ? task.due_date.split('T')[0] : new Date().toISOString().split('T')[0] }
        : { dateTime: task.due_date ? new Date(task.due_date).toISOString() : new Date(Date.now() + 3600000).toISOString() };

      const event = {
        summary: task.title,
        description: task.description || 'Task updated via TaskPlay',
        start,
        end,
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) throw new Error("Failed to update Google Calendar event");
      return await response.json();
    } catch (error) {
      console.error("Error updating Google Calendar event:", error);
      return null;
    }
  }
}
