
export const GOOGLE_CLIENT_ID = '1053561763575-ms46mm7vb0rsjtsc6u44o8nuo9lo1oas.apps.googleusercontent.com';

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
        scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
        callback: (response: any) => {
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

  public async fetchEvents(accessToken: string): Promise<GoogleCalendarEvent[]> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${new Date().toISOString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch calendar events');
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error("Error fetching Google Calendar events:", error);
      throw error;
    }
  }
}
