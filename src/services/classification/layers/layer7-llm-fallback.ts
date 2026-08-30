import { UserSubject, CandidateScore } from '../types';
import { CLASSIFICATION_CONFIG } from '../config';
import { getAIClient } from '@/services/ai/gemini';

/**
 * Layer 7 — Constrained LLM Classification (Final Fallback)
 *
 * Only invoked when deterministic and semantic classifiers are uncertain.
 * Strictly constrained to the current user's existing subjects.
 *
 * Rejects any hallucinated or invented subject IDs.
 */
export async function evaluateLLMFallback(
  filename: string,
  sampleText: string,
  userSubjects: UserSubject[]
): Promise<{ winner: CandidateScore | null; reason?: string; aiCalls: number }> {
  if (userSubjects.length === 0) {
    return { winner: null, reason: 'User has no registered subjects', aiCalls: 0 };
  }

  const snippet = (sampleText || '').substring(
    0,
    CLASSIFICATION_CONFIG.MAX_LLM_SNIPPET_CHARS
  );

  const subjectListPayload = userSubjects.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code || undefined,
    aliases: s.aliases && s.aliases.length > 0 ? s.aliases : undefined,
  }));

  const systemPrompt = `You are an academic document subject classifier for Neuron OS.
Your task is to classify an uploaded document strictly into one of the user's existing subjects.

STRICT RULES:
1. You MUST ONLY choose a subject ID from the provided "Available User Subjects" list.
2. NEVER invent a new subject name, new category, or new UUID.
3. If the document content does not clearly match any of the user's subjects with >= 0.75 confidence, you MUST return subjectId: null.
4. Return pure JSON matching this schema:
{
  "subjectId": "<UUID of matched subject or null>",
  "confidence": <number between 0.0 and 1.0>,
  "reason": "<brief 1-sentence justification>"
}`;

  const userPrompt = `Document Filename: "${filename}"
Document Excerpt:
"""
${snippet || 'No text extracted from document.'}
"""

Available User Subjects:
${JSON.stringify(subjectListPayload, null, 2)}

Classify this document now. Return only the JSON object.`;

  try {
    const ai = getAIClient();
    const model = ai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const response = await model.generateContent(
      `${systemPrompt}\n\n${userPrompt}`
    );

    const rawResponseText = response?.response?.text();
    if (!rawResponseText) {
      return { winner: null, reason: 'Empty response from LLM', aiCalls: 1 };
    }

    const parsed = JSON.parse(rawResponseText) as {
      subjectId: string | null;
      confidence: number;
      reason: string;
    };

    if (!parsed || !parsed.subjectId) {
      return {
        winner: null,
        reason: parsed?.reason || 'LLM found no confident subject match',
        aiCalls: 1,
      };
    }

    // STRICT VALIDATION: Verify returned subjectId belongs to current user
    const matchedSubject = userSubjects.find((s) => s.id === parsed.subjectId);
    if (!matchedSubject) {
      console.warn(
        `[SubjectClassifier][LLM] Rejected invalid/hallucinated subjectId "${parsed.subjectId}" not in user subjects list.`
      );
      return {
        winner: null,
        reason: 'LLM returned a subject ID not belonging to the current user.',
        aiCalls: 1,
      };
    }

    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.85;

    if (confidence >= CLASSIFICATION_CONFIG.VERIFY_THRESHOLD) {
      return {
        winner: {
          subjectId: matchedSubject.id,
          subjectName: matchedSubject.name,
          score: Number(confidence.toFixed(2)),
          method: 'llm',
          evidence: [parsed.reason || `LLM classified as ${matchedSubject.name}`],
        },
        reason: parsed.reason,
        aiCalls: 1,
      };
    }

    return {
      winner: null,
      reason: `LLM confidence (${(confidence * 100).toFixed(0)}%) is below required threshold.`,
      aiCalls: 1,
    };
  } catch (err: any) {
    console.error('[SubjectClassifier][LLM] Classification error:', err);
    return {
      winner: null,
      reason: `LLM classification error: ${err?.message || String(err)}`,
      aiCalls: 1,
    };
  }
}
