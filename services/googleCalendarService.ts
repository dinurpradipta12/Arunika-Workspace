
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

  public async createEvent(accessToken: string, task: any): Promise<any> {
    try {
      const event = {
        summary: task.title,
        description: task.description || 'Task created via TaskPlay',
        start: {
          dateTime: task.due_date ? new Date(task.due_date).toISOString() : new Date().toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: task.due_date 
            ? new Date(new Date(task.due_date).getTime() + 3600000).toISOString() 
            : new Date(Date.now() + 3600000).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
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

  public async updateEvent(accessToken: string, eventId: string, task: any): Promise<any> {
    try {
      const event = {
        summary: task.title,
        description: task.description || 'Task updated via TaskPlay',
        start: {
          dateTime: task.due_date ? new Date(task.due_date).toISOString() : new Date().toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: task.due_date 
            ? new Date(new Date(task.due_date).getTime() + 3600000).toISOString() 
            : new Date(Date.now() + 3600000).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
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
