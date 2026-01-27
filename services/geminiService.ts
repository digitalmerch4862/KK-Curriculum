
import { GoogleGenAI, Modality, Type } from "@google/genai";

// Always use the API key from process.env.API_KEY as per system requirements
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a full lesson structure using Gemini AI.
 * Adheres to the "Faith Pathway AI Lesson Architect" persona and schema.
 */
export const generateFullLesson = async (goal: string, context: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: `You are the "Faith Pathway AI Lesson Architect," an expert Sunday School Curriculum Creator. 
      Your goal is to generate engaging, age-appropriate Christian lessons for kids (ages 5-11).
      You must ALWAYS respond in valid JSON format so the app can render the content.

      Lesson Structure:
      1. title: A catchy name for the lesson.
      2. scripture: The primary Bible verse (include the version, e.g., NIV).
      3. objective: One sentence on what the kids will learn.
      4. the_hook: A 2-minute opening activity or story to grab attention.
      5. the_lesson: An array of 3 clear, simple points for the teacher to explain.
      6. group_activity: A hands-on game or craft related to the theme.
      7. closing_prayer: A short, 2-sentence prayer.

      Constraints:
      - Use simple language suitable for ages 5-11.
      - DO NOT include any conversational text outside of the JSON block.
      - Ensure all JSON keys are lowercase and use underscores (e.g., "closing_prayer").`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          scripture: { type: Type.STRING },
          objective: { type: Type.STRING },
          the_hook: { type: Type.STRING },
          the_lesson: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "An array of 3 clear teaching points"
          },
          group_activity: { type: Type.STRING },
          closing_prayer: { type: Type.STRING }
        },
        required: ["title", "scripture", "objective", "the_hook", "the_lesson", "group_activity", "closing_prayer"]
      }
    },
    contents: `Create a Sunday School lesson based on this objective: "${goal}". Existing context: ${context}.`,
  });

  const text = response.text;
  if (!text) throw new Error("No response text received from Gemini");
  return JSON.parse(text);
};

/**
 * Categorizes a lesson title into predefined biblical categories.
 */
export const categorizeLessonTitle = async (title: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Categorize this Bible lesson title: "${title}". 
      Options: PENTATEUCH, HISTORY, POETRY, THE PROPHETS, THE GOSPELS, ACTS & EPISTLES, REVELATION.
      Return ONLY the category name.`,
  });
  return response.text.trim();
};

/**
 * Generates a short summary for the mission dashboard.
 */
export const generateLessonSummary = async (content: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Summarize this lesson into 2 short, engaging sentences for a teacher's briefing. Use professional and encouraging English: ${content}`,
  });
  return response.text.trim();
};

/**
 * Generates base64 PCM audio data for lesson narration.
 */
export const generateTTS = async (text: string, voiceName: string = 'Kore') => {
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
