import { GoogleGenAI, Modality, Type } from "@google/genai";

/**
 * Initialize Gemini AI Client.
 * Using import.meta.env for Vite/Vercel compatibility.
 */
const getAIClient = () => {
  // Use VITE_ prefix for client-side environment variables
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn("⚠️ API_KEY is not defined in environment variables. AI features will fail.");
  }
  // The SDK usually expects the key as a direct string argument
  return new GoogleGenAI(apiKey || '');
};

/**
 * Generates a full lesson structure using Gemini AI.
 */
export const generateFullLesson = async (goal: string, context: string) => {
  const ai = getAIClient();
  const model = ai.getGenerativeModel({ 
    model: "gemini-3-flash-preview",
    systemInstruction: `You are the "Faith Pathway AI Lesson Architect," an expert Sunday School Curriculum Creator...`, // Keep your full instructions here
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `Create a Sunday School lesson based on this objective: "${goal}". Existing context: ${context}.` }] }],
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  const response = await result.response;
  const text = response.text(); // text() is a function, not a property
  if (!text) throw new Error("No response text received from Gemini");
  return JSON.parse(text);
};

/**
 * Categorizes a lesson title.
 */
export const categorizeLessonTitle = async (title: string) => {
  const ai = getAIClient();
  const model = ai.getGenerativeModel({ model: "gemini-3-flash-preview" });
  const result = await model.generateContent(`Categorize this Bible lesson title: "${title}". 
      Options: PENTATEUCH, HISTORY, POETRY, THE PROPHETS, THE GOSPELS, ACTS & EPISTLES, REVELATION.
      Return ONLY the category name.`);
  
  const response = await result.response;
  return response.text()?.trim() || 'HISTORY';
};

/**
 * Generates a short summary.
 */
export const generateLessonSummary = async (title: string, content: string) => {
  const ai = getAIClient();
  const model = ai.getGenerativeModel({ model: "gemini-3-flash-preview" });
  const result = await model.generateContent(`You are the Faith Pathway AI Architect. Based on the lesson title "${title}" and the following content: "${content}"...`);
  
  const response = await result.response;
  return response.text()?.trim() || '';
};

// ... keep your generateTTS function logic, but ensure it uses response.text() or modality checks