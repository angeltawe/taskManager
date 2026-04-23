import { GoogleGenAI, Type } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export const geminiService = {
  async generateSubtasks(taskTitle: string, taskDescription?: string) {
    const prompt = `Given the task: "${taskTitle}" ${taskDescription ? `with description: "${taskDescription}"` : ""}, 
    generate a list of logical subtasks to complete it. 
    Return a JSON array of objects, each with a 'title' field.`;

    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
              },
              required: ["title"],
            },
          },
        },
      });

      return JSON.parse(response.text);
    } catch (e) {
      console.error("Gemini subtask generation failed", e);
      return [];
    }
  },

  async suggestPriority(taskTitle: string, taskDescription?: string) {
    const prompt = `Given the task: "${taskTitle}" ${taskDescription ? `with description: "${taskDescription}"` : ""},
    suggest the most appropriate priority level from: "low", "medium", "high", "urgent".
    Return a single word choice.`;

    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const text = response.text.toLowerCase().trim();
      if (["low", "medium", "high", "urgent"].includes(text)) {
        return text as "low" | "medium" | "high" | "urgent";
      }
    } catch (e) {
      console.error("Gemini priority suggestion failed", e);
    }
    return "medium";
  }
};
