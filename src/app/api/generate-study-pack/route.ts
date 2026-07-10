import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAnonClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { AIJobScheduler } from '@/services/ai/pipeline/scheduler';
import { UserPreferences } from '@/lib/preferences';
import { logger } from '@/lib/logger';
import { classifyFilename } from '@/services/upload-routing';
import * as crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { documentId, fileUrl, fileType, force } = await request.json();

    if (!documentId || !fileUrl || !fileType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const serverSupabase = await createClient();
    const { data: { user }, error: userError } = await serverSupabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // getSession() used only to retrieve tokens for the background scheduler's setSession() call,
    // NOT for identity verification (handled securely by getUser() above).
    const { data: { session } } = await serverSupabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = user.id;

    // Load User Preferences from Cookie
    const cookieStore = await cookies();
    const cookieName = `neuron_pref_${userId}`;
    const cookieVal = cookieStore.get(cookieName)?.value;
    let preferences: UserPreferences | undefined;
    if (cookieVal) {
      try {
        preferences = JSON.parse(decodeURIComponent(cookieVal)) as UserPreferences;
      } catch (err) {
        logger.warn('[generate-study-pack] Failed to parse preferences cookie:', err);
      }
    }

    // Fetch document details to determine subject and category for folder creation
    const { data: doc, error: docErr } = await serverSupabase
      .from('documents')
      .select('id, title, subject_id, subjects(name)')
      .eq('id', documentId)
      .single();

    if (docErr || !doc) {
      logger.error('[generate-study-pack] Failed to fetch document: ' + (docErr?.message || 'Not found'));
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const docTitle = doc.title || 'Lecture Document';
    const subjectId = doc.subject_id;
    const subjectsNode = Array.isArray(doc.subjects) ? doc.subjects[0] : doc.subjects;
    const subjectName = (subjectsNode as { name?: string })?.name || 'General Study';

    if (!subjectId) {
      logger.error('[generate-study-pack] Document lacks a subject_id.');
      return NextResponse.json({ error: 'Document lacks a subject' }, { status: 400 });
    }

    // Determine document type / category
    const classification = classifyFilename(docTitle);
    const categoryName = classification.folderName ?? 'Others';

    // Synchronous Folder Scaffolding
    // 1. Root "AI Generated" folder
    const { data: rootFolder, error: rootErr } = await serverSupabase
      .from('folders')
      .select('id')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .ilike('name', 'AI Generated')
      .is('parent_folder_id', null)
      .maybeSingle();

    let rootFolderId: string;
    if (rootFolder) {
      rootFolderId = rootFolder.id;
    } else {
      const { data: newRoot, error: newRootErr } = await serverSupabase
        .from('folders')
        .insert({
          user_id: userId,
          subject_id: subjectId,
          parent_folder_id: null,
          name: 'AI Generated'
        })
        .select('id')
        .single();
      if (newRootErr || !newRoot) {
        logger.error('[generate-study-pack] Root folder creation failed: ' + (newRootErr?.message || 'Empty'));
        return NextResponse.json({ error: 'Root folder creation failed' }, { status: 500 });
      }
      rootFolderId = newRoot.id;
    }

    // 2. Category folder under "AI Generated"
    const { data: categoryFolder, error: catErr } = await serverSupabase
      .from('folders')
      .select('id')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .eq('parent_folder_id', rootFolderId)
      .ilike('name', categoryName)
      .maybeSingle();

    let categoryFolderId: string;
    if (categoryFolder) {
      categoryFolderId = categoryFolder.id;
    } else {
      const { data: newCat, error: newCatErr } = await serverSupabase
        .from('folders')
        .insert({
          user_id: userId,
          subject_id: subjectId,
          parent_folder_id: rootFolderId,
          name: categoryName
        })
        .select('id')
        .single();
      if (newCatErr || !newCat) {
        logger.error('[generate-study-pack] Category folder creation failed: ' + (newCatErr?.message || 'Empty'));
        return NextResponse.json({ error: 'Category folder creation failed' }, { status: 500 });
      }
      categoryFolderId = newCat.id;
    }

    // 3. Document subfolder under Category
    const cleanDocTitle = docTitle.replace(/\.[^/.]+$/, '');
    const { data: docFolder, error: docFolderErr } = await serverSupabase
      .from('folders')
      .select('id')
      .eq('user_id', userId)
      .eq('subject_id', subjectId)
      .eq('parent_folder_id', categoryFolderId)
      .ilike('name', cleanDocTitle)
      .maybeSingle();

    let docFolderId: string;
    if (docFolder) {
      docFolderId = docFolder.id;
    } else {
      const { data: newDocFolder, error: newDocFolderErr } = await serverSupabase
        .from('folders')
        .insert({
          user_id: userId,
          subject_id: subjectId,
          parent_folder_id: categoryFolderId,
          name: cleanDocTitle
        })
        .select('id')
        .single();
      if (newDocFolderErr || !newDocFolder) {
        logger.error('[generate-study-pack] Document folder creation failed: ' + (newDocFolderErr?.message || 'Empty'));
        return NextResponse.json({ error: 'Document folder creation failed' }, { status: 500 });
      }
      docFolderId = newDocFolder.id;
    }

    // Idempotency check
    const { data: existing } = await serverSupabase
      .from('background_tasks')
      .select('id, status')
      .eq('user_id',    userId)
      .eq('document_id', documentId)
      .eq('task_type',  'study_pack')
      .maybeSingle();

    const isCompleted = existing?.status === 'Completed' || existing?.status === 'completed';
    const isFailed = existing?.status === 'Failed' || existing?.status === 'failed';
    const isProcessing = existing && !isCompleted && !isFailed;

    if (!force && isCompleted) {
      return NextResponse.json({ success: true, message: 'Already completed', taskId: existing.id }, { status: 200 });
    }

    if (!force && isProcessing) {
      return NextResponse.json({ success: true, message: 'Already processing', taskId: existing.id }, { status: 200 });
    }

    // Create or reuse task record
    let taskId: string;

    if (existing) {
      await serverSupabase.from('background_tasks')
        .update({ status: 'Queued', updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      taskId = existing.id;
    } else {
      taskId = crypto.randomUUID();
      const { error: insertErr } = await serverSupabase.from('background_tasks').insert({
        id:          taskId,
        user_id:     userId,
        document_id: documentId,
        task_type:   'study_pack',
        status:      'Queued',
      });

      if (insertErr) {
        logger.error('[generate-study-pack] background_tasks insert failed: ' + insertErr.message);
        return NextResponse.json({ error: 'Task creation failed', detail: insertErr.message }, { status: 500 });
      }
    }

    // Fire-and-forget scheduler in background using setSession anon supabase client for task updates
    const runScheduler = async () => {
      const anonSupabase = createAnonClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      await anonSupabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });

      const scheduler = new AIJobScheduler(anonSupabase, documentId, userId, taskId, {
        forceRun: !!force,
        preferences,
        destinationFolderId: docFolderId
      });

      await scheduler.run(fileUrl, fileType);
    };

    runScheduler().catch((err) => {
      logger.error('[generate-study-pack] Unhandled scheduler orchestrator error:', err);
    });

    return NextResponse.json({ success: true, message: 'Study pack queued', taskId }, { status: 200 });

  } catch (err: unknown) {
    logger.error('[generate-study-pack] Route handler crashed:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
