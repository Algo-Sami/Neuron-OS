import { getAIClient, getAIModelName } from "./gemini";
import { logger } from "@/lib/logger";

/**
 * Summarizes the collaborative chat transcript logs into a brief meeting summary.
 */
export async function summarizeRoomDiscussion(messages: string[]): Promise<string> {
  try {
    const aiClient = getAIClient();
    const model = aiClient.getGenerativeModel({ model: getAIModelName() });

    const prompt = `
      You are "Neuron Meeting Assistant", an expert academic secretary.
      Your task is to analyze the following collaborative study room discussion log and generate a highly structured, beautiful executive meeting summary.
      
      DISCUSSION LOG TRANSCRIPT:
      \"\"\"
      ${messages.join("\n")}
      \"\"\"
      
      INSTRUCTIONS:
      1. Briefly distill what subjects, chapters, or concepts the students discussed.
      2. Extract 2-3 key academic learning points they agreed upon.
      3. List 2 actionable revision action items or homework tasks.
      4. Keep the summary highly clear, brief, and bulleted. Format in standard clean markdown text.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text().trim() || "No core summary compiled.";
  } catch (error) {
    logger.error("Failed to generate meeting room summary via Gemini", error);
    return "Failed to compile AI meeting summaries. Continue active learning chat!";
  }
}

/**
 * Explains a selected concept using context text from the active lecture document.
 */
export async function explainRoomTopic(
  topic: string,
  lectureSnippet: string
): Promise<string> {
  try {
    const aiClient = getAIClient();
    const model = aiClient.getGenerativeModel({ model: getAIModelName() });

    const prompt = `
      You are "Neuron AI Tutor", a world-class university professor.
      A student inside a live collaborative study room has requested an explanation of the topic: "${topic}".
      
      Here is the context snippet from the active lecture document being reviewed:
      \"\"\"
      ${lectureSnippet.substring(0, 10000)}
      \"\"\"
      
      INSTRUCTIONS:
      1. Provide a highly precise, beginner-friendly conceptual explanation of the topic.
      2. Cross-reference theories and mechanisms in the lecture notes context if relevant. If not explicitly found, use your general expert university catalog knowledge.
      3. Point out 1 key trade-off or practical application example.
      4. Keep the explanation compact, clear, and highly engaging (maximum 3 concise paragraphs).
    `;

    const result = await model.generateContent(prompt);
    return result.response.text().trim() || "Explanation could not be formulated.";
  } catch (error) {
    logger.error("Failed to explain room topic via Gemini", error);
    return `Apologies, I experienced an operational disruption. In simple terms, ${topic} represents a crucial component in computer science and system architecture. Make sure to review your lecture slides!`;
  }
}
