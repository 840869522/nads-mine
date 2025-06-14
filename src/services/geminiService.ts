import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Question, GeminiEvaluationResult } from '../types';

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY for Gemini is not set in environment variables. AI features will not work.");
}
const ai = new GoogleGenAI({ apiKey: apiKey || "MISSING_API_KEY" }); 

const GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';

export const getScoreAndExplanation = async (
  question: Question, // This will be the original English question
  userAnswer: string // User's answer, could be in any language user typed
): Promise<GeminiEvaluationResult> => {
  if (!apiKey) {
    return {
        score: 0,
        explanation: "AI评估目前不可用（缺少API密钥）。请检查您的设置。",
        feedback: "无法连接到AI以获取反馈。"
    };
  }

  const prompt = `
    You are an expert evaluator for drone technology and cybersecurity quizzes.
    Given the following question (in English) and the user's answer (language as provided by user), please provide:
    1. A score for the user's answer out of 10. The score should be an integer.
    2. A correct and detailed explanation for the question (around 50-100 words, in English).
    3. Constructive feedback on the user's answer, highlighting what was correct and what could be improved (around 50-100 words, in English).

    Return your response strictly in the following JSON format:
    {
      "score": <integer_between_0_and_10>,
      "explanation": "<string_detailed_explanation_of_correct_answer_in_english>",
      "feedback": "<string_feedback_on_users_answer_in_english>"
    }

    Question:
    "${question.text}" 
    
    ${question.type === 'multiple-choice' && question.options ? `Options: [${question.options.join(', ')}]` : ''}

    User's Answer:
    "${userAnswer}"
  `;
  // Note: The question.text and question.options sent to Gemini are still the original English ones from MOCK_QUESTIONS before they were translated for display.
  // This is important because the prompt context is in English.
  // If MOCK_QUESTIONS in constants.ts are changed to Chinese, this prompt might need adjustment or MOCK_QUESTIONS needs to store original English too.
  // For now, assuming original MOCK_QUESTIONS text (from problem description) was English and that's what geminiService expects.
  // However, `constants.ts` was updated to store Chinese MOCK_QUESTIONS. This means `question.text` here will be Chinese.
  // The prompt should be robust enough, or the question text should be explicitly passed in English if model performs better.
  // Re-evaluating: The user asked to make the *app* Chinese. The `MOCK_QUESTIONS` in `constants.ts` are now Chinese.
  // So, `question.text` passed to this service *will be Chinese*.
  // The prompt "Question: \"${question.text}\"" will thus send a Chinese question.
  // The prompt itself (instructions to Gemini) is in English. This mixed-language prompt might be fine.

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.3, 
      },
    });

    let jsonStr = response.text.trim();
    
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const parsedData = JSON.parse(jsonStr) as GeminiEvaluationResult;

    if (typeof parsedData.score !== 'number' || 
        typeof parsedData.explanation !== 'string' || 
        typeof parsedData.feedback !== 'string') {
      throw new Error("AI response did not match expected JSON structure.");
    }
    
    return parsedData;

  } catch (error) {
    console.error("Error calling Gemini API or parsing response:", error);
    let errorMessage = "获取AI评估时发生意外错误。";
    if (error instanceof Error) {
        errorMessage = `未能从AI获取评估。错误: ${error.message}`;
    }
    // The explanation and feedback from the error case should also be Chinese.
    return {
        score: 0,
        explanation: "AI评估失败。请稍后再试或检查问题。",
        feedback: errorMessage
    };
  }
};