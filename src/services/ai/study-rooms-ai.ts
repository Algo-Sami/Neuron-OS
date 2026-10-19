import { routeAIRequest } from './router';
import { logger } from "@/lib/logger";

/**
 * Summarizes the collaborative chat transcript logs into a brief meeting summary.
 *
 * Quota charged against: the user who typed /summarize (senderId), not the room host.
 * This matches the principle that the person who triggers the LLM call pays the quota cost.
 *
 * skipCache: true — room discussion transcripts are unique per session and will never produce
 * a semantically identical query across different rooms or different points in time.
 */
export async function summarizeRoomDiscussion(messages: string[], userId: string): Promise<string> {
  try {
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

    const routerRes = await routeAIRequest({
      userId,          // The user who typed /summarize — they pay the quota cost
      taskType: 'summary',
      prompt,
      skipCache: true  // Room transcript is unique per session; caching would serve wrong content
    });

    return routerRes.success
      ? (routerRes.content || "No core summary compiled.")
      : "Failed to compile AI meeting summaries. Continue active learning chat!";
  } catch (error) {
    logger.error("Failed to generate meeting room summary via AI Router", error);
    return "Failed to compile AI meeting summaries. Continue active learning chat!";
  }
}

/**
 * Explains a selected concept using context text from the active lecture document.
 *
 * Quota charged against: the user who typed /explain <topic> (senderId).
 *
 * skipCache: false — topic explanations derived from a stable lecture document are genuinely
 * reusable. If two students in different rooms ask about "deadlock" from the same OS lecture,
 * the router can serve the cached explanation, saving cost and latency.
 */
export async function explainRoomTopic(
  topic: string,
  lectureSnippet: string,
  userId: string
): Promise<string> {
  try {
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

    const routerRes = await routeAIRequest({
      userId,          // The user who typed /explain — they pay the quota cost
      taskType: 'concept-explanation',
      prompt
      // skipCache defaults to false — topic explanations from a stable document are cacheable
    });

    return routerRes.success
      ? (routerRes.content || "Explanation could not be formulated.")
      : `Apologies, I experienced an operational disruption. In simple terms, ${topic} represents a crucial component in computer science and system architecture. Make sure to review your lecture slides!`;
  } catch (error) {
    logger.error("Failed to explain room topic via AI Router", error);
    return `Apologies, I experienced an operational disruption. In simple terms, ${topic} represents a crucial component in computer science and system architecture. Make sure to review your lecture slides!`;
  }
}
