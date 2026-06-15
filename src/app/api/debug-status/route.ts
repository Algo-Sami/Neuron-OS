import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { data: docs, error: docError } = await supabase
      .from('documents')
      .select('id, title, summary_status, quiz_status, created_at, tags, classification_status')
      .order('created_at', { ascending: false });

    const { data: chunks, error: chunkError } = await supabase
      .from('document_chunks')
      .select('document_id, count:document_id')
      .select();

    // Group chunks count by doc
    const chunkCounts: Record<string, number> = {};
    if (chunks) {
      chunks.forEach(c => {
        chunkCounts[c.document_id] = (chunkCounts[c.document_id] || 0) + 1;
      });
    }
      
    return NextResponse.json({ 
      user: user.email, 
      documents: docs?.map(d => ({
        ...d,
        chunksCount: chunkCounts[d.id] || 0
      })),
      errors: { docError, chunkError }
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message });
  }
}
