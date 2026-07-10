export interface UploadMetadata {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
}

export interface DatabaseUpload {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
}
