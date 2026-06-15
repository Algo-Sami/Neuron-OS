import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SchemaType, Schema, Tool } from '@google/generative-ai';
import { logger } from '@/lib/logger';
import { searchChunks } from '@/services/ai/search';
import { getAIClient, getAIModelName } from '@/services/ai/gemini';
import { routeAIRequest } from '@/services/ai/router';
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

async function createReminder(userId: string, title: string, dueDate: string, type: 'assignment' | 'exam' | 'generic') {
  const supabase = await createClient();
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

  if (error) return { error: error.message };
  return { success: true, reminder: data };
}

// -------------------------------------------------------------
// POST Handler & AI Loop
// -------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, conversationId: reqConversationId, documentIds } = await request.json();
    if (!message) {
      return NextResponse.json({ error: 'Missing chat message' }, { status: 400 });
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
    const startTime = Date.now();
    logger.info(`[RAG] Querying vector database chunks for: "${message}"`);
    const searchResults = await searchChunks(user.id, message, documentIds, 5, 0.20);
    
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
    } catch (err) {
      logger.warn('[Chat Route] Knowledge graph table query bypassed/failed.');
    }

    // 6. Retrieve Student Long-Term Memory context
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
    } catch (err) {
      logger.warn('[Chat Route] Long-term memory query bypassed/failed.');
    }

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

    let response = await chat.sendMessage(fullPromptText);
    let calls = response.response.functionCalls();

    // Loop to execute tools requested by Gemini
    while (calls && calls.length > 0) {
      const call = calls[0];
      logger.info(`Gemini Agent called function: ${call.name} with params:`, call.args);

      let toolResult: unknown = null;

      if (call.name === 'listFolders') {
        toolResult = await listFolders(user.id);
      } else if (call.name === 'listDocuments') {
        toolResult = await listDocuments(user.id);
      } else if (call.name === 'searchDocumentContent') {
        const queryArg = (call.args as Record<string, unknown>).query as string;
        const toolRes = await searchDocumentContent(user.id, queryArg, documentIds);
        
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

      response = await chat.sendMessage([
        {
          functionResponse: {
            name: call.name,
            response: typeof toolResult === 'object' && toolResult !== null ? toolResult as object : { result: toolResult }
          }
        }
      ]);

      calls = response.response.functionCalls();
    }

    const responseText = response.response.text();

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

    // Save to usage log under the router budget system
    try {
      const promptTokensEst = Math.ceil((contextString.length + message.length) / 4);
      const responseTokensEst = Math.ceil(cleanContent.length / 4);
      const estimatedCost = ((promptTokensEst / 1000000) * 0.075) + ((responseTokensEst / 1000000) * 0.30);
      
      await supabase.from('ai_usage_logs').insert({
        user_id: user.id,
        model_name: getAIModelName(),
        prompt_tokens: promptTokensEst,
        completion_tokens: responseTokensEst,
        estimated_cost: estimatedCost
      });
    } catch (e) {
      logger.warn('[Chat Route] Failsafe usage log save bypassed.');
    }

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
    logger.error('Failed to run Agentic AI chat loop', err);
    return NextResponse.json({ error: err.message || 'AI Chat failed' }, { status: 500 });
  }
}
