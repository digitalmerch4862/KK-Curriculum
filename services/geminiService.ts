import { GoogleGenAI, Modality, Type } from "@google/genai";

/**
 * Initialize Gemini AI Client.
 * Note: process.env.API_KEY is automatically injected by the environment.
 */
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("Warning: API_KEY is not defined. AI features will be unavailable.");
  }
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

/**
 * Generates a full lesson structure using Gemini AI.
 * Uses gemini-3-flash-preview for speed and efficiency.
 */
export const generateFullLesson = async (goal: string, context: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      You are the Kingdom Kids AI Architect. 
      Create a curriculum based on this objective: "${goal}". 
      Existing lessons for context: ${context}.
      IMPORTANT: Respond entirely in English.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "The name of the mission/lesson" },
          summary: { type: Type.STRING, description: "Brief mission briefing in English" },
          read: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["title", "content"]
            }
          },
          teach: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["title", "content"]
            }
          },
          engage: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["title", "content"]
            }
          }
        },
        required: ["title", "summary", "read", "teach", "engage"]
      }
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response text received from Gemini");
  return JSON.parse(text);
};

/**
 * Categorizes a lesson title into predefined biblical categories.
 */
export const categorizeLessonTitle = async (title: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Categorize this Bible lesson title: "${title}". 
      Options: PENTATEUCH, HISTORY, POETRY, THE PROPHETS, THE GOSPELS, ACTS & EPISTLES, REVELATION.
      Return ONLY the category name.`,
  });
  return response.text?.trim() || 'HISTORY';
};

/**
 * Generates a short summary for the mission dashboard.
 */
export const generateLessonSummary = async (content: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Summarize this lesson into 2 short, engaging sentences for a teacher's briefing. Use professional and encouraging English: ${content}`,
  });
  return response.text?.trim() || '';
};

/**
 * Generates base64 PCM audio data for lesson narration using TTS model.
 */
export const generateTTS = async (text: string, voiceName: string = 'Kore') => {
  const ai = getAIClient();
  // Normalize voice name to Title Case as expected by the API
  const formattedVoice = voiceName.charAt(0).toUpperCase() + voiceName.slice(1).toLowerCase();
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: formattedVoice },
        },
      },
    },
  });

  // Extract base64 from candidates
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio;
};