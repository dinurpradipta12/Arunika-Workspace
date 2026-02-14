
import { GoogleGenAI, Type } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // Corrected initialization according to guidelines
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async detectProductivityPatterns(taskHistory: any[]) {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this task history and provide productivity insights in a playful, encouraging tone: ${JSON.stringify(taskHistory)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            mostProductiveDay: { type: Type.STRING },
            burnoutRisk: { type: Type.BOOLEAN },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });
    return JSON.parse(response.text);
  }

  async suggestSmartReschedule(conflicts: any[]) {
    // Advanced reasoning for rescheduling logic
    const response = await this.ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Find optimal time slots for these conflicting tasks, prioritizing deep work in the morning: ${JSON.stringify(conflicts)}`,
      config: { thinkingConfig: { thinkingBudget: 32768 } }
    });
    return response.text;
  }
}
