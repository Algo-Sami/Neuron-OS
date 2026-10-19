import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SchemaType, Schema, Tool } from '@google/generative-ai';
import { logger } from '@/lib/logger';
import { searchChunks } from '@/services/ai/search';
import { getAIClient, getAIModelName } from '@/services/ai/gemini';
import { routeAIRequest, checkUsageAndLog } from '@/services/ai/router';
import { executeWithAIRetry, DEFAULT_RETRY_CONFIG } from '@/services/ai/errors/retry-policy';
import { acquireAIRateLimitToken } from '@/lib/rate-limiter';
import { LECTURE_EXPERT_SYSTEM_INSTRUCTION, buildLectureQAPrompt } from '@/services/ai/agents/lecture-expert';

// -------------------------------------------------------------
// Database Tool Handlers (Ensure strict security checks)
// -------------------------------------------------------------

async function listFolders(userId: string) {
  const supabase = await createClient();
  const { data: subjects } = await supabase.from('subjects').select('id, name, code').eq('user_id', userId).is('deleted_at', null);
  const { data: folders } = await supabase.from('folders').select('id, name, subject_id').eq('user_id', userId);
  return { subjects: subjects || [], folders: folders || [] };
}

async function listDocuments(userId: string) {
  const supabase = await createClient();
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, file_type, file_url, upload_date')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('upload_date', { ascending: false });
  return { documents: documents || [] };
}

interface SearchDocumentContentResponse {
  results?: {
    id: string;
    documentTitle: string;
    documentId: string;
    chunkIndex: number;
    content: string;
    similarity: number;
  }[];
  error?: string;
}

async function searchDocumentContent(userId: string, query: string, documentIds?: string[] | null): Promise<SearchDocumentContentResponse> {
  try {
    const results = await searchChunks(userId, query, documentIds, 8);
    return {
      results: results.map(r => ({
        id: r.id,
        documentTitle: r.document_title || 'Untitled Document',
        documentId: r.document_id,
        chunkIndex: r.chunk_index,
        content: r.content,
        similarity: r.similarity
      }))
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to search document chunks semantically', err);
    return { error: err.message || 'Vector search failed' };
  }
}

async function getDocumentSummary(userId: string, documentId: string) {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('documents')
    .select('id, title, summary_status')
    .eq('id', documentId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();
  if (!doc) return { error: 'Document not found or unauthorized' };

  const { data: summaries } = await supabase
    .from('ai_summaries')
    .select('summary_text, key_points')
    .eq('document_id', documentId)
    .limit(1);

  let existingSummary = '';
  if (summaries && summaries.length > 0) {
    existingSummary = summaries[0].summary_text;
    existingSummary = existingSummary.replace(/<!-- MODE: \w+ -->/g, '').trim();
    if (summaries[0].key_points && summaries[0].key_points.length > 0) {
      existingSummary += '\n\nKey Points:\n' + (summaries[0].key_points as string[]).map((kp: string) => `- ${kp}`).join('\n');
    }
  }

  const { data: chunks } = await supabase
    .from('document_chunks')
    .select('content')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })
    .limit(10);

  const text = chunks?.map(c => c.content).join('\n') || '';
  return { 
    title: doc.title, 
    summaryStatus: doc.summary_status,
    existingSummary: existingSummary || null,
    textSnippet: text 
  };
}

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

async function createReminder(userId: string, title: string, dueDate: string, type: 'assignment' | 'exam' | 'generic') {
  const supabase = await createClient();

  // 1. Attempt direct insert with unique-constraint race protection
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      user_id: userId,
      title,
      due_date: dueDate,
      reminder_type: type,
      description: 'Scheduled dynamically by Neuron AI Agent',
      completed_status: false
    })
    .select()
    .single();

  if (error) {
    // If blocked by unique constraint (23505) or duplicate detected, fetch and return existing reminder
    if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
      const { data: existing } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', userId)
        .eq('title', title)
        .eq('due_date', dueDate)
        .maybeSingle();

      if (existing) {
        logger.info(`[createReminder] Atomic deduplication on unique constraint for user ${userId}, title "${title}", due ${dueDate}`);
        return { success: true, reminder: existing, deduplicated: true };
      }
    }
    return { error: error.message };
  }

  return { success: true, reminder: data, deduplicated: false };
}

/**
 * Acquires rate limit capacity for tool iterations with dynamic bounded wait.
 * Respects remaining execution budget so serverless function is never killed mid-flight.
 */
async function acquireWithBoundedWait(userId: string, maxWaitMs = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const check = await acquireAIRateLimitToken({
      userId,
      isBackground: false,
      operation: 'chat-tool-iteration',
    });
    if (check.allowed) return true;
    const retryDelay = (check.retryAfterSec || 2) * 1000;
    const waitMs = Math.min(retryDelay, Math.max(500, maxWaitMs - (Date.now() - start)));
    if (Date.now() - start + waitMs > maxWaitMs) {
      break;
    }
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return false;
}

// -------------------------------------------------------------
// POST Handler & AI Loop
// -------------------------------------------------------------

export async function POST(request: Request) {
  const requestStartTime = Date.now();
  const FUNCTION_BUDGET_MS = 54_000; // 54s hard limit (6s buffer before Vercel 60s kill)
  const SAFETY_CLEANUP_MARGIN_MS = 4_000; // 4s buffer to save message to DB and return response
  const deadlineMs = requestStartTime + FUNCTION_BUDGET_MS - SAFETY_CLEANUP_MARGIN_MS;

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 0. Pre-flight Quota & Rate Guard: Block exhausted users BEFORE executing any AI logic
    const preFlight = await checkUsageAndLog(
      user.id,
      getAIModelName(),
      0,
      0,
      0,
      true // isCheckOnly
    );
    if (preFlight.limitExceeded) {
      logger.warn(`[Chat Route] Request blocked for student ${user.id}: daily AI quota or budget limit exceeded.`);
      return NextResponse.json(
        { error: 'Daily AI usage quota or budget limit exceeded. Please wait until quota resets at midnight UTC or upgrade your tier.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { message, conversationId: reqConversationId } = body;
    const rawDocIds = body.referenceDocumentIds || body.documentIds;
    if (!message) {
      return NextResponse.json({ error: 'Missing chat message' }, { status: 400 });
    }

    // Validate reference document IDs: enforce ownership, non-deleted status, and max 5 limit
    let validatedDocumentIds: string[] | null = null;
    if (Array.isArray(rawDocIds) && rawDocIds.length > 0) {
      const cappedIds = rawDocIds.slice(0, 5).filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
      if (cappedIds.length > 0) {
        const { data: userOwnedDocs } = await supabase
          .from('documents')
          .select('id')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .in('id', cappedIds);
        
        if (userOwnedDocs && userOwnedDocs.length > 0) {
          validatedDocumentIds = userOwnedDocs.map(d => d.id);
        }
      }
    }

    let conversationId = reqConversationId;

    // 1. Manage Conversation Session
    if (!conversationId) {
      const defaultTitle = message.trim().split(/\s+/).slice(0, 5).join(' ') + (message.trim().split(/\s+/).length > 5 ? '...' : '');
      const { data: conv, error: convErr } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          title: defaultTitle || 'New Conversation'
        })
        .select('id')
        .single();
      if (convErr) {
        logger.error('Failed to create chat_conversation', convErr);
        throw new Error(`Failed to create conversation: ${convErr.message}`);
      }
      conversationId = conv.id;
    } else {
      const { data: currentConv } = await supabase
        .from('chat_conversations')
        .select('title')
        .eq('id', conversationId)
        .single();
      if (currentConv && (currentConv.title === 'New Conversation' || currentConv.title === 'New Chat')) {
        const shortTitle = message.trim().split(/\s+/).slice(0, 5).join(' ') + (message.trim().split(/\s+/).length > 5 ? '...' : '');
        await supabase
          .from('chat_conversations')
          .update({ title: shortTitle })
          .eq('id', conversationId);
      }
    }

    // 2. Save user message to database
    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message
    });

    // 3. Load conversation history
    const { data: dbMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    let activeHistory = dbMessages || [];
    let historySummaryText = '';

    // 3.5 Conversation Compression: Summarize older messages if history exceeds 8 turns (16 messages)
    if (activeHistory.length > 16) {
      logger.info(`[Chat Pipeline] History size [${activeHistory.length}] exceeds limit. Running compression...`);
      const messagesToCompress = activeHistory.slice(0, -6);
      const remainingMessages = activeHistory.slice(-6);

      const historyFormatted = messagesToCompress.map(m => `${m.role === 'ai' ? 'assistant' : 'user'}: ${m.content}`).join('\n');
      const compressionPrompt = `Write a short, single-paragraph summary of the following academic discussion history, highlighting key concepts covered:\n\n${historyFormatted}`;
      
      const compressionRes = await routeAIRequest({
        userId: user.id,
        taskType: 'summary',
        prompt: compressionPrompt,
        skipCache: true
      });

      if (compressionRes.success) {
        historySummaryText = `Summary of previous discussion: ${compressionRes.content}`;
        logger.info('[Chat Pipeline] Conversation history compressed successfully.');
      }
      activeHistory = remainingMessages;
    }

    const pastMessages = activeHistory ? activeHistory.slice(0, -1) : [];
    const rawHistory = pastMessages.map((m: { role: string; content: string }) => ({
      role: (m.role === 'ai' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: m.content }]
    }));

    const firstUserIdx = rawHistory.findIndex((h: { role: string }) => h.role === 'user');
    const cleanHistory = firstUserIdx !== -1 ? rawHistory.slice(firstUserIdx) : [];

    // 4. Pre-retrieve grounding document contexts (RAG vector search)
    const phaseTimings: Record<string, number> = {};
    phaseTimings['auth_preflight_ms'] = Date.now() - requestStartTime;
    const startTime = Date.now();
    const ragStart = Date.now();
    logger.info(`[RAG] Querying vector database chunks for: "${message}"`);
    const searchResults = await searchChunks(user.id, message, validatedDocumentIds, 5, 0.20);
    phaseTimings['rag_search_ms'] = Date.now() - ragStart;
    
    interface SourceItem {
      id: string;
      document_id: string;
      document_title: string;
      chunk_index: number;
      content: string;
      similarity: number;
    }

    const sources: SourceItem[] = searchResults.map(r => ({
      id: r.id,
      document_id: r.document_id,
      document_title: r.document_title || 'Untitled Document',
      chunk_index: r.chunk_index,
      content: r.content,
      similarity: r.similarity
    }));

    let contextString = "";
    if (sources.length > 0) {
      contextString = "Retrieved Grounding Context from User Documents:\n" + sources.map((s, idx) => {
        return `[Source ${idx + 1}] Document: "${s.document_title}" (ID: ${s.document_id}, Chunk: ${s.chunk_index})\nContent: ${s.content}`;
      }).join("\n\n");
    }

    // 5. Retrieve related concepts from Knowledge Graph (for concept context)
    const kgStart = Date.now();
    let knowledgeGraphNodes = '';
    try {
      const { data: kgNodes } = await supabase
        .from('knowledge_graph')
        .select('concept, prerequisites, related_concepts, description')
        .limit(5); // Grab some graph mappings
      
      if (kgNodes && kgNodes.length > 0) {
        knowledgeGraphNodes = kgNodes.map(k => {
          return `- Concept: "${k.concept}" (Prereqs: ${k.prerequisites?.join(', ') || 'None'}), Related: ${k.related_concepts?.join(', ') || 'None'}\n  Description: ${k.description || ''}`;
        }).join('\n');
      }
    } catch {
      logger.warn('[Chat Route] Knowledge graph table query bypassed/failed.');
    }

    phaseTimings['kg_query_ms'] = Date.now() - kgStart;

    // 6. Retrieve Student Long-Term Memory context
    const memoryStart = Date.now();
    let memorySummary = '';
    try {
      const [
        { data: progress },
        { data: weaknesses },
        { data: studyPlan }
      ] = await Promise.all([
        supabase.from('user_progress').select('total_xp, current_level').eq('user_id', user.id).maybeSingle(),
        supabase.from('weakness_tracking').select('weak_concepts, strong_concepts').eq('user_id', user.id).limit(3),
        supabase.from('study_plans').select('learning_style, academic_goals').eq('user_id', user.id).maybeSingle()
      ]);

      const weakList: string[] = [];
      const strongList: string[] = [];
      weaknesses?.forEach(w => {
        if (w.weak_concepts) weakList.push(...(w.weak_concepts as string[]));
        if (w.strong_concepts) strongList.push(...(w.strong_concepts as string[]));
      });

      memorySummary = `Student Level: ${progress?.current_level || 1}
Learning Style: ${studyPlan?.learning_style || 'visual'}
Academic Goals: "${studyPlan?.academic_goals || 'Study consistency'}"
Struggles with concepts: [${weakList.slice(0, 5).join(', ')}]
Strong in concepts: [${strongList.slice(0, 5).join(', ')}]`;
    } catch {
      logger.warn('[Chat Route] Long-term memory query bypassed/failed.');
    }

    phaseTimings['memory_query_ms'] = Date.now() - memoryStart;

    // 7. Construct optimized prompt using Agent Dynamic Prompt Builder
    const optimizedPrompt = buildLectureQAPrompt(
      message,
      contextString,
      memorySummary,
      knowledgeGraphNodes
    );

    const fullPromptText = historySummaryText 
      ? `${historySummaryText}\n\n${optimizedPrompt}`
      : optimizedPrompt;

    // Define tools
    const tools: Tool[] = [
      {
        functionDeclarations: [
          { name: 'listFolders', description: 'Retrieve all folders and subjects in the user\'s workspace.' },
          { name: 'listDocuments', description: 'Retrieve the list of all files and uploaded study documents in the user\'s upload history. Call this whenever the user asks about their files, documents, uploads, or references a specific lecture/file by name.' },
          {
            name: 'searchDocumentContent',
            description: 'Search for specific words or matching sentences inside all your files.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                query: { type: SchemaType.STRING, description: 'The word, topic, or phrase to search for inside documents.' }
              },
              required: ['query']
            }
          },
          {
            name: 'getDocumentSummary',
            description: 'Retrieve the text contents of a document to analyze or summarize it.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                documentId: { type: SchemaType.STRING, description: 'The UUID of the target document.' }
              },
              required: ['documentId']
            }
          },
          {
            name: 'createReminder',
            description: 'Add a new due date, homework deadline, or alarm to the user\'s schedule.',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING, description: 'Alarm/reminder title (e.g. Bio Homework).' },
                dueDate: { type: SchemaType.STRING, description: 'ISO 8601 string of when it is due (YYYY-MM-DDTHH:mm:ssZ).' },
                type: { type: SchemaType.STRING, enum: ['assignment', 'exam', 'generic'], description: 'Category of alarm.' } as unknown as Schema
              },
              required: ['title', 'dueDate', 'type']
            }
          }
        ]
      }
    ];

    // Initialize Gemini model configured with the Lecture Expert Agent instructions and tools
    const ai = getAIClient();
    const model = ai.getGenerativeModel({
      model: getAIModelName(),
      systemInstruction: LECTURE_EXPERT_SYSTEM_INSTRUCTION,
      tools
    });

    const chat = model.startChat({
      history: cleanHistory,
      tools
    });

    // Helper to log usage per model call turn
    const logTurnUsage = async (inputLength: number, outputLength: number) => {
      try {
        const promptTokensEst = Math.ceil(inputLength / 4);
        const completionTokensEst = Math.ceil(outputLength / 4);
        const estimatedCost = ((promptTokensEst / 1000000) * 0.075) + ((completionTokensEst / 1000000) * 0.30);
        await checkUsageAndLog(
          user.id,
          getAIModelName(),
          promptTokensEst,
          completionTokensEst,
          estimatedCost,
          false // record log in ai_usage_logs
        );
      } catch (err) {
        logger.warn('[Chat Route] Failed to log model turn usage', err);
      }
    };

    const limiterStart = Date.now();
    const rateCheck = await acquireAIRateLimitToken({
      userId: user.id,
      isBackground: false,
      operation: 'chat-initial-turn',
    });
    phaseTimings['limiter_acquire_ms'] = Date.now() - limiterStart;

    if (!rateCheck.allowed) {
      logger.warn(`[Chat Route] Rate limit rejected for user ${user.id}. Retry-After: ${rateCheck.retryAfterSec || 15}s`);
      return NextResponse.json(
        {
          error: `AI service is experiencing high demand. Please try again in ${rateCheck.retryAfterSec || 15} seconds.`,
          retryAfter: rateCheck.retryAfterSec || 15,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfterSec || 15),
          },
        }
      );
    }

    const aiCallStart = Date.now();
    let response = await executeWithAIRetry(
      () => chat.sendMessage(fullPromptText),
      {
        operation: 'chat-initial-turn',
        userId: user.id,
        providerName: 'gemini',
        deadlineMs,
        alreadyAcquired: true,
      },
      undefined,
      { ...DEFAULT_RETRY_CONFIG, maxAttempts: 3 }
    );
    phaseTimings['provider_gemini_call_ms'] = Date.now() - aiCallStart;
    phaseTimings['ai_initial_turn_total_ms'] = (phaseTimings['limiter_acquire_ms'] || 0) + phaseTimings['provider_gemini_call_ms'];
    let calls = response.response.functionCalls();
    const initialText = response.response.candidates?.[0]?.content?.parts?.map(p => ('text' in p ? p.text : '')).join('') || '';
    await logTurnUsage(fullPromptText.length, initialText.length || 100);

    // Loop to execute tools requested by Gemini (capped at MAX_TOOL_ITERATIONS)
    const MAX_TOOL_ITERATIONS = 5;
    let toolIterations = 0;
    let partialFallbackMessage: string | null = null;

    while (calls && calls.length > 0 && toolIterations < MAX_TOOL_ITERATIONS) {
      toolIterations++;
      const call = calls[0];
      logger.info(`[Chat Route] Gemini Agent tool iteration ${toolIterations}/${MAX_TOOL_ITERATIONS}: ${call.name}`);

      let toolResult: unknown = null;

      if (call.name === 'listFolders') {
        toolResult = await listFolders(user.id);
      } else if (call.name === 'listDocuments') {
        toolResult = await listDocuments(user.id);
      } else if (call.name === 'searchDocumentContent') {
        const queryArg = (call.args as Record<string, unknown>).query as string;
        const toolRes = await searchDocumentContent(user.id, queryArg, validatedDocumentIds);
        
        if (toolRes.results) {
          toolRes.results.forEach((r) => {
            if (!sources.some(s => s.id === r.id)) {
              sources.push({
                id: r.id,
                document_id: r.documentId,
                document_title: r.documentTitle,
                chunk_index: r.chunkIndex,
                content: r.content,
                similarity: r.similarity || 1.0
              });
            }
          });
        }
        toolResult = toolRes;
      } else if (call.name === 'getDocumentSummary') {
        toolResult = await getDocumentSummary(user.id, (call.args as Record<string, unknown>).documentId as string);
      } else if (call.name === 'createReminder') {
        const { title, dueDate, type } = call.args as Record<string, string>;
        toolResult = await createReminder(user.id, title, dueDate, type as "assignment" | "exam" | "generic");
      }

      const functionResponsePart = {
        functionResponse: {
          name: call.name,
          response: typeof toolResult === 'object' && toolResult !== null ? toolResult as object : { result: toolResult }
        }
      };

      // Check remaining execution time budget before attempting further tool turns
      const elapsedMs = Date.now() - requestStartTime;
      const remainingBudgetMs = FUNCTION_BUDGET_MS - elapsedMs;

      if (remainingBudgetMs <= SAFETY_CLEANUP_MARGIN_MS) {
        logger.warn(`[Chat Route] Execution budget depleted (${elapsedMs}ms elapsed). Breaking tool loop to prevent mid-flight timeout.`);
        partialFallbackMessage =
          call.name === 'createReminder'
            ? "I created your reminder, but due to time limits, I couldn't generate the full summary. Please feel free to ask me to continue!"
            : "I processed your request, but due to time limits, I couldn't complete the full follow-up. Everything requested has been saved!";
        break;
      }

      // Calculate bounded wait budget dynamically (remaining time minus safety margin, capped at 10s)
      const allowedWaitMs = Math.min(10_000, remainingBudgetMs - SAFETY_CLEANUP_MARGIN_MS);
      const toolWaitStart = Date.now();
      const acquiredCapacity = await acquireWithBoundedWait(user.id, allowedWaitMs);
      phaseTimings[`tool_${toolIterations}_limiter_wait_ms`] = Date.now() - toolWaitStart;

      if (!acquiredCapacity) {
        logger.warn(
          `[Chat Route] Rate limit capacity unavailable after bounded wait (${allowedWaitMs}ms) for user ${user.id} on tool iteration ${toolIterations}. Returning graceful partial response.`
        );
        partialFallbackMessage =
          call.name === 'createReminder'
            ? "I created your reminder, but due to high service demand, I couldn't generate the full summary. Please feel free to ask me to continue!"
            : "I processed your request, but due to high service demand, I couldn't complete the full follow-up. Everything requested has been saved!";
        break;
      }

      let turnOutput = '';
      const turnInputLen = JSON.stringify(functionResponsePart).length;
      const toolAiStart = Date.now();

      try {
        response = await executeWithAIRetry(
          async () => {
            try {
              return await chat.sendMessage([functionResponsePart]);
            } catch (err: unknown) {
              const errorMsg = err instanceof Error ? err.message : String(err);
              if (errorMsg.includes("Role 'function' is not supported")) {
                const history = await chat.getHistory();
                const contents = [
                  ...history,
                  {
                    role: 'user',
                    parts: [functionResponsePart]
                  }
                ];
                return await model.generateContent({ contents });
              }
              throw err;
            }
          },
          {
            operation: `chat-tool-turn-${toolIterations}`,
            userId: user.id,
            providerName: 'gemini',
            alreadyAcquired: true,
            deadlineMs,
          },
          undefined,
          { ...DEFAULT_RETRY_CONFIG, maxAttempts: 2 }
        );
        phaseTimings[`tool_${toolIterations}_provider_gemini_call_ms`] = Date.now() - toolAiStart;
        turnOutput = response.response.candidates?.[0]?.content?.parts?.map(p => ('text' in p ? p.text : '')).join('') || '';
      } catch (err: unknown) {
        phaseTimings[`tool_${toolIterations}_provider_gemini_call_ms`] = Date.now() - toolAiStart;
        logger.warn(`[Chat Route] Tool turn ${toolIterations} call failed after retries. Returning graceful partial response:`, err);
        partialFallbackMessage =
          call.name === 'createReminder'
            ? "I created your reminder, but couldn't finish the final response due to high demand."
            : "I completed your action, but could not finish the final summary due to service load.";
        break;
      }

      await logTurnUsage(turnInputLen, turnOutput.length || 100);
      calls = response.response.functionCalls();
    }

    if (calls && calls.length > 0 && toolIterations >= MAX_TOOL_ITERATIONS) {
      logger.warn(`[Chat Route] Reached max tool iterations (${MAX_TOOL_ITERATIONS}) for user ${user.id}. Breaking loop to prevent runaway token spend.`);
    }

    let responseText = '';
    if (partialFallbackMessage) {
      responseText = partialFallbackMessage;
    } else {
      try {
        responseText = response.response.text();
      } catch {
        responseText = initialText || "Your request was processed successfully.";
      }
    }

    let followUps: string[] = [];
    let cleanContent = responseText;
    const followUpMatch = responseText.match(/---FOLLOW_UP_START---([\s\S]*?)---FOLLOW_UP_END---/);
    if (followUpMatch) {
      try {
        followUps = JSON.parse(followUpMatch[1].trim());
      } catch {
        followUps = followUpMatch[1]
          .split('\n')
          .map(line => line.replace(/^[-\s*"'\[\],]+|[\]"',]+$/g, '').trim())
          .filter(Boolean);
      }
      cleanContent = responseText.replace(/---FOLLOW_UP_START---[\s\S]*?---FOLLOW_UP_END---/, '').trim();
    }

    // Save AI response message to database
    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      role: 'ai',
      content: cleanContent,
      sources: sources
    });

    const endTime = Date.now();
    const speedMs = endTime - startTime;
    phaseTimings['total_request_ms'] = endTime - requestStartTime;
    phaseTimings['response_assembly_ms'] = endTime - (aiCallStart + (phaseTimings['provider_gemini_call_ms'] || 0));
    logger.info(`[Chat Route] Phase timings: ${JSON.stringify(phaseTimings)}`);

    // 8. Confidence System Metrics Calculations
    const avgSimilarity = sources.length > 0 
      ? sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length
      : 0;

    const notFoundKeywords = [
      "does not contain sufficient information", 
      "not mention", 
      "unable to find", 
      "could not find"
    ];
    const isNotFound = notFoundKeywords.some(kw => cleanContent.toLowerCase().includes(kw));

    const confidenceScore = sources.length === 0 ? 0.50 : isNotFound ? 0.35 : Math.min(1.0, avgSimilarity * 1.1);
    const retrievalQuality = avgSimilarity;
    const sourceCoverage = Math.min(1.0, sources.length / 5);


    return NextResponse.json({
      content: cleanContent,
      sources: sources,
      conversationId: conversationId,
      followUps: followUps,
      metrics: {
        speedMs,
        tokenEstimate: Math.ceil((contextString.length + message.length + cleanContent.length) / 4),
        confidenceScore,
        retrievalQuality,
        sourceCoverage
      }
    });

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const statusCode = (error as any)?.statusCode || ((error as any)?.status === 429 ? 429 : 500);
    const retryAfter = (error as any)?.retryAfter;

    if (statusCode === 429) {
      logger.warn(`[Chat Route] Returning 429 to client: ${err.message} (retryAfter: ${retryAfter || 15}s)`);
      return NextResponse.json(
        { error: err.message, retryAfter: retryAfter || 15 },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter || 15) }
        }
      );
    }

    logger.error('Failed to run Agentic AI chat loop', err);
    return NextResponse.json({ error: err.message || 'AI Chat failed' }, { status: 500 });
  }
}
