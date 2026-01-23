import { GoogleGenAI, Type } from "@google/genai";

const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  return '';
};

const SYSTEM_INSTRUCTION = `You are a friendly kids-ministry expert, joyful, and Christ-centered. 
Target Audience: Kids ages 5–10 (Primary), Volunteer teachers & parents (Secondary).
Tone: Warm, simple, encouraging, never preachy.
STRICT RULES:
1. No emojis inside lesson content.
2. Follow the exact hierarchy provided.
3. No admin commentary.`;

export const generateStructuredLesson = async (topic: string) => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Write a full lesson about "${topic}" following this EXACT structure:

# 1. Read
## Bible Text
(Main scripture with short paraphrase for kids)
## The Biggest Story
(3–5 sentences connecting to God’s big redemption story)

# 2. Teach
## Big Picture
(Short paragraph explaining what this is about)
## Tell the Story
(Narrative-style retelling, visual, kid-friendly)
## Teach the Story
(Key meanings, context, and moments)
## Big Truth
(Starts with: "God wants us to know that...")
## Gospel Connection
(Explicitly connect to Jesus)

# 3. Engage
## Discussion
(4–6 open-ended questions)
## Memory Verse
(Short verse with reference)
## Activities
(2–3 hands-on group activities)
## Crafts
(1–2 simple crafts with common supplies)

# 4. How to Use
(Step-by-step teacher guidance, timing tips, flow)

Rules: No emojis. Use clear headers. Christ-centered. Target kids 5-10.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION
    }
  });
  return response.text;
};

export const generateLessonSummary = async (content: string) => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Summarize this lesson for a teacher's preview in 2-3 engaging sentences. No emojis. Content: ${content}`,
    config: { systemInstruction: SYSTEM_INSTRUCTION }
  });
  return response.text;
};

export const generateDiscussionQuestions = async (content: string) => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Based on this content, generate 5 age-appropriate discussion questions for kids 5-10. No emojis. Content: ${content}`,
    config: { systemInstruction: SYSTEM_INSTRUCTION }
  });
  return response.text;
};

export const generateActivitiesDraft = async (content: string) => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Create 2 creative hands-on activities for kids 5-10 based on this lesson. Return as JSON. No emojis in text.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
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
    return JSON.parse(response.text || '[]');
  } catch (e) {
    return [];
  }
};
