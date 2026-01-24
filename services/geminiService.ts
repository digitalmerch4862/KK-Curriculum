
import { GoogleGenAI, Type, Modality } from "@google/genai";

/**
 * Service for generating Sunday School lesson content and audio using Gemini.
 */

// Helper to get a fresh AI instance with the current environment key
const getAi = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please add API_KEY to your environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateLessonSummary = async (content: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Summarize the following lesson content into 2-3 engaging sentences for teachers. Content: ${content}`,
  });
  return response.text;
};

export const categorizeLessonTitle = async (title: string) => {
  const categories = [
    "PENTATEUCH",
    "HISTORY",
    "POETRY",
    "THE PROPHETS",
    "THE GOSPELS",
    "ACTS & EPISTLES",
    "REVELATION"
  ];
  
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Given the Sunday School lesson title "${title}", which of these biblical categories does it best fit into? 
    Categories: [${categories.join(', ')}]. 
    Return only the category name from the list provided exactly as written. If unsure, return "HISTORY".`,
  });
  
  const result = response.text?.trim().toUpperCase() || "HISTORY";
  return categories.find(c => result.includes(c)) || "HISTORY";
};

export const generateFullLesson = async (goal: string, existingContext: string) => {
  const prompt = `
    Architect a complete Sunday School lesson plan based on this user's summary goal or lesson objective:
    "${goal}"

    This objective describes what the lesson is about, who it is for, and the spiritual goals for the listeners.

    Context of existing lessons in the system: [${existingContext}]
    
    CRITICAL INSTRUCTION:
    - If a lesson with this title or core story already exists in the context, do NOT duplicate the approach. Propose a FRESH perspective or a complementary deep-dive.
    - If it is new, provide a comprehensive standard plan.
    
    Structure your response as a valid JSON object with:
    - title: A compelling lesson title.
    - summary: A 2-sentence teacher overview.
    - read: Array of objects { title, content }
    - teach: Array of objects { title, content }
    - engage: Array of objects { title, content }
  `;

  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          read: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, content: { type: Type.STRING } } } },
          teach: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, content: { type: Type.STRING } } } },
          engage: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, content: { type: Type.STRING } } } },
        },
        required: ["title", "summary", "read", "teach", "engage"]
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Failed to parse AI generation result", e);
    return null;
  }
};

export const generateDiscussionQuestions = async (content: string, gradeRange: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate 5 age-appropriate discussion questions for children in grades ${gradeRange} based on this lesson content: ${content}`,
  });
  return response.text;
};

export const generateActivitiesDraft = async (content: string, gradeRange: string) => {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
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
      const text = response.text?.trim() || '[]';
      return JSON.parse(text);
  } catch (e) {
      console.error("Failed to parse Gemini response as JSON", e);
      return [];
  }
};

/**
 * Sanitizes text for TTS to prevent API rejection errors.
 */
function sanitizeForTTS(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim();
  if (cleaned.length < 5) return null;
  
  cleaned = cleaned
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^\w\s.,!?;:'\-()&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleaned.length < 5) return null;
  if (!/[.!?]$/.test(cleaned)) cleaned += '.';
  return cleaned;
}

/**
 * Generates audio bytes from text using the Gemini TTS model.
 */
export const generateTTS = async (text: string, voiceName: string = 'Kore') => {
  const sanitized = sanitizeForTTS(text);
  if (!sanitized) return null;
  
  try {
    const ai = getAi();
    // Use proper voice casing from documentation (e.g., 'Kore', 'Puck')
    const formattedVoiceName = voiceName.charAt(0).toUpperCase() + voiceName.slice(1).toLowerCase();
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Please speak this clearly for a children's lesson: ${sanitized}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: formattedVoiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error('TTS Generation Error:', error);
    return null;
  }
};
