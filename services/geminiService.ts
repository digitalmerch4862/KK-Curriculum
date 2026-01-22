
import { GoogleGenAI, Type } from "@google/genai";

export const generateLessonSummary = async (content: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Summarize the following lesson content into 2-3 engaging sentences for teachers. Content: ${content}`,
  });
  return response.text;
};

export const generateDiscussionQuestions = async (content: string, gradeRange: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate 5 age-appropriate discussion questions for children in grades ${gradeRange} based on this lesson content: ${content}`,
  });
  return response.text;
};

export const generateActivitiesDraft = async (content: string, gradeRange: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Create 2 creative hands-on activities based on this lesson for children in grades ${gradeRange}. Return as a JSON list.`,
    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    supplies: { type: Type.ARRAY, items: { type: Type.STRING } },
                    instructions: { type: Type.STRING },
                    duration_minutes: { type: Type.NUMBER }
                },
                required: ["title", "supplies", "instructions", "duration_minutes"]
            }
        }
    }
  });
  try {
      const text = response.text || '[]';
      return JSON.parse(text);
  } catch (e) {
      console.error("Failed to parse Gemini response as JSON", e);
      return [];
  }
};
