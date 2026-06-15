import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { processDocument } from '@/services/ai/processor';
import { chunkText } from '@/services/ai/chunker';
import { extractDeadlinesFromText, classifyAcademicDocument } from '@/services/ai/gemini';
import { logger } from '@/lib/logger';
import { getEmbedding, getEmbeddings } from '@/services/ai/embeddings';
import { routeAIRequest } from '@/services/ai/router';
import * as fs from 'fs';

// Maximum retries for extraction
const MAX_RETRIES = 2;

// Disk logger for background diagnostics
function logToDisk(message: string, error?: unknown) {
  try {
    const logPath = 'd:/FYP Project/neuron/background_logs.txt';
    const timestamp = new Date().toISOString();
    let logMsg = `[${timestamp}] ${message}\n`;
    if (error) {
      const err = error as Error;
      logMsg += `ERROR: ${err.message || String(error)}\n`;
      if (err.stack) {
        logMsg += `STACK: ${err.stack}\n`;
      }
    }
    fs.appendFileSync(logPath, logMsg);
  } catch (e) {
    console.error("Failed to write log to disk", e);
  }
}

/**
 * Pre-generates summaries, quizzes, flashcards, and populates the Academic Knowledge Graph.
 * Runs in the background to ensure instantaneous user response times (< 1s cached responses).
 */
async function preGenerateIntelligence(
  supabase: any,
  documentId: string,
  userId: string,
  extractedText: string,
  fileName: string,
  subjectId: string | null
) {
  logToDisk(`[${documentId}] Starting pre-generated intelligence pipeline...`);
  
  const textSnippet = extractedText.substring(0, 30000); // Bounded size for optimal speed/costs

  // 1. Pre-generate Summary & save to database (detailed mode)
  try {
    const mode = 'detailed';
    const modeTag = `<!-- MODE: ${mode} -->`;
    const prompt = `Analyze the following lecture content and write a detailed, structured study summary under bold markdown headers:\n\n${textSnippet}`;
    
    logToDisk(`[${documentId}] Pre-generating summary...`);
    const summaryRes = await routeAIRequest({
      userId,
      taskType: 'summary',
      prompt,
      skipCache: true
    });

    if (summaryRes.success) {
      const summaryText = `${modeTag}\n\n${summaryRes.content}`;
      const emb = await getEmbedding(summaryRes.content);
      
      await supabase.from('ai_summaries').insert({
        document_id: documentId,
        summary_text: summaryText,
        key_points: ['Review core lecture summary notes', 'Active recall on concepts'],
        embedding: emb
      });
      logToDisk(`[${documentId}] Pre-generated summary saved successfully.`);
    }
  } catch (err) {
    logToDisk(`[${documentId}] Summary pre-generation bypassed/failed:`, err);
  }

  // 2. Pre-generate Flashcards
  try {
    logToDisk(`[${documentId}] Pre-generating flashcards...`);
    const prompt = `Carefully read this study material. Extract 10 core concepts, formulas, or key terms and generate high-yield study flashcards.
Output strictly as a JSON array of objects, each containing "front" (question/term) and "back" (definition/explanation) keys. Do not include markdown wraps.

TEXT CONTENT:
"""
${extractedText.substring(0, 15000)}
"""`;

    const flashcardsRes = await routeAIRequest({
      userId,
      taskType: 'flashcards',
      prompt,
      responseMimeType: 'application/json',
      skipCache: true
    });

    if (flashcardsRes.success) {
      const flashcardsList = JSON.parse(flashcardsRes.content);
      if (Array.isArray(flashcardsList)) {
        const payload = flashcardsList.map((fc: any) => ({
          user_id: userId,
          subject_id: subjectId,
          document_id: documentId,
          front_content: fc.front || fc.term || 'Core Term',
          back_content: fc.back || fc.definition || 'Definition'
        }));

        await supabase.from('flashcards').insert(payload);
        logToDisk(`[${documentId}] Pre-generated ${payload.length} flashcards saved successfully.`);
      }
    }
  } catch (err) {
    logToDisk(`[${documentId}] Flashcards pre-generation bypassed/failed:`, err);
  }

  // 3. Pre-generate Quiz
  try {
    logToDisk(`[${documentId}] Pre-generating assessment quiz...`);
    // Generate 10 adaptive questions
    const prompt = `Based on the lecture document context, generate 8 multiple choice questions (MCQ), 2 true/false, and 2 short conceptual questions.
Output strictly as a JSON array of objects matching the Schema:
[
  {
    "id": "q_1",
    "type": "mcq",
    "questionText": "Question",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "0",
    "explanation": "Why correct",
    "difficulty": "medium"
  }
]

TEXT CONTENT:
"""
${extractedText.substring(0, 12000)}
"""`;

    const quizRes = await routeAIRequest({
      userId,
      taskType: 'quiz-generation',
      prompt,
      responseMimeType: 'application/json',
      skipCache: true
    });

    if (quizRes.success) {
      const questions = JSON.parse(quizRes.content);
      if (Array.isArray(questions)) {
        await supabase.from('quizzes').insert({
          user_id: userId,
          document_id: documentId,
          subject_id: subjectId,
          title: `AI Quiz: ${fileName.replace(/\.[^/.]+$/, "")}`,
          questions: questions,
          total_questions: questions.length,
          score: 0,
          status: 'not_started'
        });
        logToDisk(`[${documentId}] Pre-generated quiz with ${questions.length} questions saved.`);
      }
    }
  } catch (err) {
    logToDisk(`[${documentId}] Quiz pre-generation bypassed/failed:`, err);
  }

  // 4. Extract Concepts for Academic Knowledge Graph
  try {
    logToDisk(`[${documentId}] Populating Academic Knowledge Graph...`);
    const prompt = `Analyze this lecture content and extract the core conceptual building blocks (e.g. "Inheritance", "CPU Scheduling", "Virtual Memory").
Identify prerequisite concepts from the same course domain and a short description.
Output strictly as a JSON array of objects:
[
  {
    "concept": "Concept Name",
    "prerequisites": ["Prerequisite Concept Name"],
    "related": ["Related Concept"],
    "description": "Short explanation"
  }
]

TEXT CONTENT:
"""
${extractedText.substring(0, 15000)}
"""`;

    const kgRes = await routeAIRequest({
      userId,
      taskType: 'key-concepts',
      prompt,
      responseMimeType: 'application/json',
      skipCache: true
    });

    if (kgRes.success) {
      const concepts = JSON.parse(kgRes.content);
      if (Array.isArray(concepts)) {
        const payload = concepts.map((c: any) => ({
          user_id: userId,
          subject_id: subjectId,
          concept: c.concept,
          prerequisites: c.prerequisites || [],
          related_concepts: c.related || [],
          description: c.description || ''
        }));

        await supabase.from('knowledge_graph').upsert(payload, { onConflict: 'subject_id,concept' });
        logToDisk(`[${documentId}] Successfully saved ${payload.length} nodes to Academic Knowledge Graph.`);
      }
    }
  } catch (err) {
    logToDisk(`[${documentId}] Knowledge Graph extraction bypassed/failed:`, err);
  }
}

async function backgroundExtractionTask(
  accessToken: string,
  refreshToken: string,
  documentId: string, 
  userId: string, 
  fileUrl: string, 
  fileType: string
) {
  logToDisk(`[${documentId}] backgroundExtractionTask started for user ${userId}, fileUrl=${fileUrl}, type=${fileType}`);
  
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    if (accessToken && refreshToken) {
      logToDisk(`[${documentId}] Authenticating background Supabase client using session JWT...`);
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (sessionError) {
        logToDisk(`[${documentId}] Supabase setSession warning/error: ${sessionError.message}`);
      } else {
        logToDisk(`[${documentId}] Supabase setSession succeeded.`);
      }
    } else {
      logToDisk(`[${documentId}] WARNING: No access/refresh token provided to background task.`);
    }

    // 1. Mark as processing
    logToDisk(`[${documentId}] Updating DB status to 'processing'...`);
    const { error: markProcError } = await supabase
      .from('documents')
      .update({ summary_status: 'processing' })
      .eq('id', documentId)
      .eq('user_id', userId);

    if (markProcError) {
      logToDisk(`[${documentId}] Failed to update status to processing: ${markProcError.message}`);
    } else {
      logToDisk(`[${documentId}] Successfully updated status to processing.`);
    }

    logger.info(`[${documentId}] Marked as processing. Downloading file...`);

    // 2. Download the file from Supabase Storage
    const pathParts = fileUrl.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const filePath = `${userId}/${fileName}`;
    logToDisk(`[${documentId}] Attempting storage download from path: ${filePath}`);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (downloadError || !fileData) {
      logToDisk(`[${documentId}] Storage download failed!`, downloadError);
      throw new Error(`Storage download failed: ${downloadError?.message}`);
    }

    logToDisk(`[${documentId}] File downloaded successfully. Size: ${fileData.size} bytes.`);
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Process the document with retries
    let extractedText = '';
    let attempt = 0;
    
    logToDisk(`[${documentId}] Starting processDocument (text extraction)...`);
    while (attempt <= MAX_RETRIES) {
      try {
        extractedText = await processDocument(buffer, fileType);
        break; // Success, exit retry loop
      } catch (err) {
        attempt++;
        logToDisk(`[${documentId}] Text extraction failed on attempt ${attempt}. Error: ${(err as Error).message}`);
        if (attempt > MAX_RETRIES) throw err;
        logger.warn(`[${documentId}] Extraction failed, retrying attempt ${attempt}...`);
      }
    }

    logToDisk(`[${documentId}] Text extraction completed successfully. Extracted text length: ${extractedText.length} characters.`);

    // 4. Chunk text and insert into document_chunks using Upgraded Semantic Chunker
    let chunks = chunkText(extractedText);
    logToDisk(`[${documentId}] Text chunked semantically into ${chunks.length} segments.`);
    
    // Graceful fallback for empty/scanned documents
    if (chunks.length === 0) {
      logger.warn(`[${documentId}] Extracted text is empty. PDF is likely scanned or image-only. Inserting fallback placeholder.`);
      chunks = [`[System Notification: This document "${fileName}" appears to be a scanned PDF, an image-only file, or contains no selectable digital text. To analyze its contents, please upload a digitally generated PDF, a word document, or paste the text content directly into the chat.]`];
      logToDisk(`[${documentId}] Extracted text empty. Fallback chunk loaded.`);
    }

    logToDisk(`[${documentId}] Generating embeddings for ${chunks.length} chunks...`);
    const chunkEmbeddings = await getEmbeddings(chunks);
    logToDisk(`[${documentId}] Chunk embeddings generated. generating document-level semantic embedding...`);
    
    const docSemanticText = `${fileName}: ${extractedText.substring(0, 2000)}`;
    const documentEmbedding = await getEmbedding(docSemanticText);
    logToDisk(`[${documentId}] Document semantic embedding generated.`);
    
    // Create payload for bulk insert
    const chunkPayload = chunks.map((content, index) => ({
      document_id: documentId,
      chunk_index: index,
      content: content,
      embedding: chunkEmbeddings[index] || null
    }));

    if (chunkPayload.length > 0) {
      logToDisk(`[${documentId}] Inserting ${chunkPayload.length} chunks with embeddings into DB...`);
      const { error: chunkError } = await supabase
        .from('document_chunks')
        .insert(chunkPayload);
        
      if (chunkError) {
        logToDisk(`[${documentId}] Chunk insert failed!`, chunkError);
        throw new Error(`Chunk insert failed: ${chunkError.message}`);
      } else {
        logToDisk(`[${documentId}] Chunks inserted successfully.`);
      }
    }

    // 5. Update document status to completed chunking and set semantic embedding
    logToDisk(`[${documentId}] Updating DB status to 'completed' and saving semantic embedding...`);
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        summary_status: 'completed',
        semantic_embedding: documentEmbedding,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .eq('user_id', userId);

    if (updateError) {
      logToDisk(`[${documentId}] Failed to update status to completed!`, updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    } else {
      logToDisk(`[${documentId}] Document summary_status marked completed and embedding saved successfully.`);
    }

    // Fetch existing subjects to help the AI map to existing folders
    const { data: currentSubjects } = await supabase
      .from('subjects')
      .select('name')
      .eq('user_id', userId)
      .is('deleted_at', null);
    const existingSubjectNames = currentSubjects?.map(s => String(s.name)) || [];

    logToDisk(`[${documentId}] Running parallel AI jobs: Gemini academic classification & deadline extraction...`);

    const [classification, deadlines] = await Promise.all([
      classifyAcademicDocument(fileName, extractedText.substring(0, 10000), fileType, existingSubjectNames),
      extractDeadlinesFromText(extractedText.substring(0, 15000))
    ]);

    logToDisk(`[${documentId}] Parallel AI jobs completed. classification confidence=${classification.confidence}, deadlines count=${deadlines.length}`);

    // A. Handle Classification Results
    let resolvedSubjectId: string | null = null;
    try {
      const confidence = classification.confidence;
      const suggestedSubject = classification.subject;
      const suggestedTopic = classification.topic;
      const suggestedDocType = classification.docType;
      const suggestedTags = classification.tags;

      logger.info(`[${documentId}] Classified as Subject: ${suggestedSubject}, Topic: ${suggestedTopic}, Confidence: ${confidence}`);

      const updateData: Record<string, unknown> = {
        ai_subject: suggestedSubject,
        ai_topic: suggestedTopic,
        ai_doc_type: suggestedDocType,
        classification_confidence: confidence,
        tags: suggestedTags,
        updated_at: new Date().toISOString()
      };

      let subjectId = null;
      if (confidence >= 0.80) {
        updateData.classification_status = 'auto_applied';

        const { data: existingSubject } = await supabase
          .from('subjects')
          .select('id')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .ilike('name', suggestedSubject)
          .maybeSingle();

        if (existingSubject) {
          subjectId = existingSubject.id;
          resolvedSubjectId = subjectId;
          logToDisk(`[${documentId}] Mapped to existing subject: ${suggestedSubject} (id=${subjectId})`);
        } else {
          logToDisk(`[${documentId}] Subject "${suggestedSubject}" not found. Creating new Subject in DB.`);
          const { data: newSubject, error: subjectError } = await supabase
            .from('subjects')
            .insert({
              user_id: userId,
              name: suggestedSubject,
              color: 'bg-blue-500'
            })
            .select('id')
            .single();

          if (subjectError) throw subjectError;
          subjectId = newSubject.id;
          resolvedSubjectId = subjectId;
          logToDisk(`[${documentId}] Created subject with id: ${subjectId}`);
        }

        let folderId = null;
        const { data: existingFolder } = await supabase
          .from('folders')
          .select('id')
          .eq('user_id', userId)
          .eq('subject_id', subjectId)
          .ilike('name', suggestedTopic)
          .maybeSingle();

        if (existingFolder) {
          folderId = existingFolder.id;
          logToDisk(`[${documentId}] Mapped to existing folder: ${suggestedTopic} (id=${folderId})`);
        } else {
          logToDisk(`[${documentId}] Folder "${suggestedTopic}" not found. Creating new Folder in DB.`);
          const { data: newFolder, error: folderError } = await supabase
            .from('folders')
            .insert({
              user_id: userId,
              subject_id: subjectId,
              name: suggestedTopic
            })
            .select('id')
            .single();

          if (folderError) throw folderError;
          folderId = newFolder.id;
          logToDisk(`[${documentId}] Created folder with id: ${folderId}`);
        }

        updateData.subject_id = subjectId;
        updateData.folder_id = folderId;
      } else {
        updateData.classification_status = 'pending';
        logToDisk(`[${documentId}] Low confidence (${confidence}). Kept as pending for user review.`);
      }

      logToDisk(`[${documentId}] Applying classification subject/folder updates to document...`);
      const { error: classificationError } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', documentId)
        .eq('user_id', userId);

      if (classificationError) {
        logToDisk(`[${documentId}] Failed to save classification results to document: ${classificationError.message}`);
      } else {
        logToDisk(`[${documentId}] Successfully saved academic classification.`);
        try {
          revalidatePath('/subjects');
          revalidatePath('/uploads');
          if (subjectId) {
            revalidatePath(`/subjects/${subjectId}`);
          }
        } catch (e) {
          logger.error('Failed to revalidate paths:', e);
        }
      }
    } catch (err) {
      logToDisk(`[${documentId}] Error applying academic classification!`, err);
    }

    // B. Handle Deadlines & Reminders
    try {
      const finalDeadlines = [...(deadlines || [])];

      if (finalDeadlines.length === 0) {
        const lowerName = fileName.toLowerCase();
        const docTypeLower = (classification?.docType || '').toLowerCase();
        
        let inferredType: 'assignment' | 'exam' | 'quiz' | 'presentation' | 'generic' | null = null;
        let inferredTitle = '';
        let daysAhead = 7;
        
        if (lowerName.includes('assignment') || lowerName.includes('homework') || lowerName.includes('hw') || docTypeLower.includes('assignment')) {
          inferredType = 'assignment';
          inferredTitle = `Complete assignment: ${fileName.replace(/\.[^/.]+$/, "")}`;
          daysAhead = 7;
        } else if (lowerName.includes('quiz') || lowerName.includes('test') || docTypeLower.includes('quiz')) {
          inferredType = 'quiz';
          inferredTitle = `Prep for quiz: ${fileName.replace(/\.[^/.]+$/, "")}`;
          daysAhead = 3;
        } else if (lowerName.includes('exam') || lowerName.includes('midterm') || lowerName.includes('final') || docTypeLower.includes('exam')) {
          inferredType = 'exam';
          inferredTitle = `Study for exam: ${fileName.replace(/\.[^/.]+$/, "")}`;
          daysAhead = 5;
        } else if (lowerName.includes('presentation') || lowerName.includes('ppt') || docTypeLower.includes('presentation')) {
          inferredType = 'presentation';
          inferredTitle = `Prepare presentation: ${fileName.replace(/\.[^/.]+$/, "")}`;
          daysAhead = 4;
        } else if (lowerName.includes('project') || lowerName.includes('report') || lowerName.includes('lab')) {
          inferredType = 'assignment';
          inferredTitle = `Submit project/lab: ${fileName.replace(/\.[^/.]+$/, "")}`;
          daysAhead = 7;
        }
        
        if (inferredType && inferredTitle) {
          const inferredDueDate = new Date();
          inferredDueDate.setDate(inferredDueDate.getDate() + daysAhead);
          inferredDueDate.setHours(23, 59, 59, 0);
          
          logToDisk(`[${documentId}] Inferred task from filename: ${inferredTitle} (${inferredType})`);
          
          finalDeadlines.push({
            title: inferredTitle,
            description: `Auto-generated reminder from uploaded study file "${fileName}".`,
            dueDate: inferredDueDate.toISOString(),
            type: inferredType,
            priority: daysAhead <= 3 ? 'high' : 'medium',
            course: classification?.subject || 'General Study'
          });
        }
      }

      if (finalDeadlines.length > 0) {
        logToDisk(`[${documentId}] Found/Inferred ${finalDeadlines.length} deadlines. Generating reminders in DB...`);
        
        const reminderPayload = [];
        for (const d of finalDeadlines) {
          let subId = resolvedSubjectId;
          if (d.course) {
            try {
              const { data: existingSub } = await supabase
                .from('subjects')
                .select('id')
                .eq('user_id', userId)
                .is('deleted_at', null)
                .ilike('name', d.course.trim())
                .maybeSingle();

              if (existingSub) {
                subId = existingSub.id;
              } else {
                const { data: newSub, error: subError } = await supabase
                  .from('subjects')
                  .insert({
                    user_id: userId,
                    name: d.course.trim(),
                    color: 'bg-indigo-500'
                  })
                  .select('id')
                  .single();
                if (!subError && newSub) {
                  subId = newSub.id;
                }
              }
            } catch (err) {
              logger.error('Error auto-resolving course subject:', err);
            }
          }

          const actualDeadline = new Date(d.dueDate);
          const reminderDate = new Date(actualDeadline.getTime() - 24 * 60 * 60 * 1000);

          reminderPayload.push({
            user_id: userId,
            document_id: documentId,
            subject_id: subId,
            title: d.title,
            description: (d.description || `Extracted automatically from ${fileName}`) + ` (Actual deadline: ${actualDeadline.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})`,
            due_date: reminderDate.toISOString(),
            reminder_type: d.type,
            priority: d.priority || 'medium',
            extracted_from_ai: true,
            completed_status: false
          });
        }

        const { error: reminderError } = await supabase
          .from('reminders')
          .insert(reminderPayload);

        if (reminderError) {
          logToDisk(`[${documentId}] Reminders with priority failed, trying fallback without priority...`, reminderError);
          const fallbackPayload = reminderPayload.map(({ priority: _, ...rest }) => rest);
          const { error: fallbackError } = await supabase
            .from('reminders')
            .insert(fallbackPayload);
            
          if (fallbackError) {
            logToDisk(`[${documentId}] Fallback also failed: ${fallbackError.message}`);
          } else {
            logToDisk(`[${documentId}] Saved reminders successfully via fallback.`);
          }
        } else {
          logToDisk(`[${documentId}] Saved ${finalDeadlines.length} reminders successfully.`);
        }
      }
    } catch (err) {
      logToDisk(`[${documentId}] Error applying deadline extraction!`, err);
    }

    // C. Trigger Pre-generated Intelligence (Route B lightweight model calls in background)
    // Run this asynchronously without blocking the primary background worker flow
    preGenerateIntelligence(supabase, documentId, userId, extractedText, fileName, resolvedSubjectId)
      .then(() => {
        logToDisk(`[${documentId}] Pre-generated intelligence completed successfully.`);
      })
      .catch(err => {
        logToDisk(`[${documentId}] Pre-generated intelligence pipeline failed:`, err);
      });

    logToDisk(`[${documentId}] backgroundExtractionTask finished perfectly!`);

  } catch (error: unknown) {
    logToDisk(`[${documentId}] FATAL: backgroundExtractionTask failed!`, error);
    try {
      await supabase
        .from('documents')
        .update({ summary_status: 'failed' })
        .eq('id', documentId)
        .eq('user_id', userId);
    } catch (dbErr) {
      logToDisk(`[${documentId}] Failed to mark status as failed:`, dbErr);
    }
  }
}

export async function POST(request: Request) {
  let docId = 'unknown';
  try {
    const { documentId, userId, fileUrl, fileType } = await request.json();
    docId = documentId || 'unknown';
    
    logToDisk(`[${docId}] POST /api/process-document received. userId=${userId}, type=${fileType}`);

    if (!documentId || !userId || !fileUrl || !fileType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const serverSupabase = await createClient();
    const { data: { session } } = await serverSupabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    backgroundExtractionTask(
      session.access_token,
      session.refresh_token,
      documentId,
      userId,
      fileUrl,
      fileType
    ).catch(err => {
      logger.error("Fatal error in unhandled background task promise:", err);
    });

    return NextResponse.json({ 
      success: true, 
      message: "Document extraction successfully queued in the background" 
    }, { status: 200 });

  } catch (err: unknown) {
    logger.error("Failed to queue background job:", (err as Error).message);
    return NextResponse.json({ error: "Failed to queue job" }, { status: 500 });
  }
}
