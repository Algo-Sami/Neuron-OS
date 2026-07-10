export const STORAGE_CONFIG = {
  bucket: 'documents',
  maxFileSizeMb: 50,
  allowedTypes: ['pdf', 'docx', 'pptx', 'txt', 'jpg', 'png'],
} as const;
