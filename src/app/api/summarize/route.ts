import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { getEmbedding } from '@/services/ai/embeddings';
import { routeAIRequest } from '@/services/ai/router';

export async function POST(request: NextRequest) {
  try {
    const { documentId, mode, forceRegenerate } = await request.json();

    if (!documentId) {
      return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
    }

    const validModes = ['beginner', 'concise', 'detailed', 'exam-focused', 'bullet', 'key-concepts'];
    if (!mode || !validModes.includes(mode)) {
      return NextResponse.json({ error: `Invalid summary mode. Must be one of: ${validModes.join(', ')}` }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Verify document ownership
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, summary_status')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
    }

    if (document.summary_status === 'failed') {
      return NextResponse.json({ error: 'Document analysis failed. Please delete and re-upload this file.' }, { status: 422 });
    }

    const modeTag = `<!-- MODE: ${mode} -->`;

    // 2. Unless forced, check dynamic cache
    if (!forceRegenerate) {
      const { data: existingSummaries } = await supabase
        .from('ai_summaries')
        .select('id, summary_text, key_points, created_at')
        .eq('document_id', documentId);

      if (existingSummaries && existingSummaries.length > 0) {
        const cached = existingSummaries.find(s => s.summary_text.startsWith(modeTag));
        if (cached) {
          logger.info(`[Summarize] Cache hit for Document [${documentId}], Mode [${mode}].`);
          const cleanText = cached.summary_text.replace(modeTag, '').trim();
          return NextResponse.json({
            summary: cleanText,
            keyPoints: cached.key_points || [],
            createdAt: cached.created_at,
            cached: true
          });
        }
      }
    }

    logger.info(`[Summarize] Cache miss/forced regeneration for Document [${documentId}], Mode [${mode}]. Extracting chunks...`);

    // 3. Fetch all extracted chunks
    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('content')
      .eq('document_id', documentId)
      .order('chunk_index');

    if (chunksError || !chunks || chunks.length === 0) {
      return NextResponse.json({ error: 'Document contents are still processing. Please try again shortly.' }, { status: 422 });
    }

    const sourceText = chunks.map(c => c.content).join('\n\n');
    const optimizedText = sourceText.length > 300000 ? sourceText.slice(0, 300000) + "\n\n[Content truncated for length optimization]" : sourceText;

    // 4. Construct customized prompt
    let modeInstructions = '';
    if (mode === 'beginner') {
      modeInstructions = `
        - Write in an exceptionally clear, highly accessible, and beginner-friendly tone.
        - Avoid advanced academic jargon. If a technical term is crucial, define it immediately using intuitive analogies or everyday examples.
      `;
    } else if (mode === 'concise') {
      modeInstructions = `
        - Write a compact, ultra-dense, and highly focused summary notes guide.
        - Keep sections brief, utilizing bullet items heavily for rapid reading.
      `;
    } else if (mode === 'detailed') {
      modeInstructions = `
        - Write a comprehensive, exhaustive study outline.
        - Maintain a section-by-section or chapter-by-chapter synthesis of the lecture/material.
      `;
    } else if (mode === 'exam-focused') {
      modeInstructions = `
        - Focus strictly on topics likely to appear on college-level exams or homework.
        - Prioritize core terminologies (with definitions), formulas, step-by-step procedures, and key theories.
        - Generate 3 typical sample examination questions at the very end of the summary with helpful hints.
      `;
    } else if (mode === 'bullet') {
      modeInstructions = `
        - Convert the entire document into a highly structured, hierarchical bulleted list.
        - Avoid long paragraphs entirely.
      `;
    } else if (mode === 'key-concepts') {
      modeInstructions = `
        - Extract only the absolute core concepts, theories, and definitions.
        - For each concept, provide the Name in bold, followed by a 1-2 sentence simple definition, and an example.
      `;
    }

    const prompt = `
      You are "Neuron Academic Summary Agent", a specialized study assistant.
      Your task is to analyze the following course material and write a top-tier, structured study guide.
      
      Active Summary Mode: ${mode.toUpperCase()}
      Instructions for this mode:
      ${modeInstructions}
      
      Core Requirements for the Output:
      1. Write the main summary in beautiful, clean Markdown. Use headings (###), bold text, and organized bullet lists for visual clarity.
      2. Extract 5 to 10 highly impactful "Key Takeaways" or "Key Points" from the text.
      
      To ensure absolute reliability during programmatic parsing, you MUST wrap your responses in the exact text markers below. Do not include chat commentary outside these bounds:
      
      ---SUM_START---
      [Your Markdown Summary here]
      ---SUM_END---
      
      ---POINTS_START---
      ["Point 1", "Point 2", "Point 3", ...]
      ---POINTS_END---
      
      Here is the course material text:
      ---------------------------------
      ${optimizedText}
      ---------------------------------
    `;

    logger.info(`[Summarize] Rerouting request to AI Router...`);
    const routerRes = await routeAIRequest({
      userId: user.id,
      taskType: 'summary',
      prompt,
      skipCache: true // database-level local caching checked above
    });

    if (!routerRes.success) {
      throw new Error(`AI Router summary generation failed: ${routerRes.content}`);
    }

    const responseText = routerRes.content;

    // 6. Programmatically parse the structured tokens
    const sumRegex = /---SUM_START---([\s\S]*?)---SUM_END---/;
    const pointsRegex = /---POINTS_START---([\s\S]*?)---POINTS_END---/;

    const sumMatch = responseText.match(sumRegex);
    const pointsMatch = responseText.match(pointsRegex);

    if (!sumMatch) {
      logger.error(`[Summarize] Failed to parse summary markers from response: ${responseText.slice(0, 500)}`);
      return NextResponse.json({ error: 'AI summary formatting failed. Please retry.' }, { status: 502 });
    }

    const mainSummary = sumMatch[1].trim();
    let keyPoints: string[] = [];

    if (pointsMatch) {
      try {
        keyPoints = JSON.parse(pointsMatch[1].trim());
      } catch {
        logger.warn('[Summarize] Key points JSON parsing failed. Falling back to line-based parsing.');
        keyPoints = pointsMatch[1]
          .split('\n')
          .map(line => line.replace(/^[-\s*"'\[\],]+|[\]"',]+$/g, '').trim())
          .filter(Boolean);
      }
    }

    // 7. Save result in Database
    if (forceRegenerate) {
      const { data: oldSummaries } = await supabase
        .from('ai_summaries')
        .select('id, summary_text')
        .eq('document_id', documentId);
      
      if (oldSummaries && oldSummaries.length > 0) {
        const matchingOld = oldSummaries.find(s => s.summary_text.startsWith(modeTag));
        if (matchingOld) {
          logger.info(`[Summarize] Deleting previous summary row [${matchingOld.id}] for regeneration...`);
          await supabase.from('ai_summaries').delete().eq('id', matchingOld.id);
        }
      }
    }

    const fullSummaryText = `${modeTag}\n\n${mainSummary}`;
    logger.info(`[Summarize] Generating vector embedding for summary...`);
    const summaryEmbedding = await getEmbedding(mainSummary);

    const { data: newSummary, error: insertError } = await supabase
      .from('ai_summaries')
      .insert({
        document_id: documentId,
        summary_text: fullSummaryText,
        key_points: keyPoints,
        embedding: summaryEmbedding
      })
      .select('created_at')
      .single();

    if (insertError) {
      logger.error(`[Summarize] Insert failed: ${insertError.message}`);
    } else {
      logger.info(`[Summarize] Successfully cached new summary and embedding in database.`);
    }

    return NextResponse.json({
      summary: mainSummary,
      keyPoints,
      createdAt: newSummary?.created_at || new Date().toISOString(),
      cached: false
    });

  } catch (error: unknown) {
    logger.error('[Summarize] Critical route handler failure:', error);
    return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
  }
}
