-- Setup Supabase Storage for Neuron Uploads

-- 1. Create a new bucket named 'documents'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false, -- Make it private to enforce RLS
  52428800, -- 50MB in bytes
  ARRAY[
    'application/pdf', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- DOCX
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', -- PPTX
    'text/plain', -- TXT
    'image/jpeg', 
    'image/png', 
    'image/webp'
  ]
) ON CONFLICT (id) DO UPDATE
SET 
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Setup Row Level Security (RLS) on storage.objects

-- Allow users to upload files to their own folder path (e.g. documents/user_id/filename)
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND 
  (auth.uid())::text = (storage.foldername(name))[1]
);

-- Allow users to read their own files
CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND 
  (auth.uid())::text = (storage.foldername(name))[1]
);

-- Allow users to update their own files
CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND 
  (auth.uid())::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND 
  (auth.uid())::text = (storage.foldername(name))[1]
);
