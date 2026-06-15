"use client"

import * as React from "react"
import { Upload, File, X, CheckCircle2, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { saveUploadMetadata } from "@/actions/uploads"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export function UploadZone({ onUploadComplete }: { onUploadComplete?: (documentId: string, fileName: string) => void } = {}) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const [progress, setProgress] = React.useState(0)
  const [status, setStatus] = React.useState<"idle" | "uploading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = React.useState("")

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleFile = (selectedFile: File) => {
    // Validation: Max Size 50MB
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (selectedFile.size > maxSize) {
      setStatus("error")
      setErrorMsg("File exceeds 50MB limit.")
      return
    }

    const validExtensions = ['.pdf', '.docx', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.webp']
    const hasValidExtension = validExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext))

    if (!hasValidExtension) {
      setStatus("error")
      setErrorMsg("Invalid file type. Please upload PDF, DOCX, PPTX, TXT, or Images.")
      return
    }

    setFile(selectedFile)
    setStatus("idle")
    setErrorMsg("")
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setStatus("uploading")
    setProgress(10) // Initial progress state

    try {
      const supabase = createClient()
      const { data, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr;
      const user = data?.user;
      
      if (!user) {
        throw new Error("Please log in to upload files.")
      }

      // Clean filename for storage
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const filePath = `${user.id}/${Date.now()}_${cleanFileName}`

      setProgress(25)

      // Upload directly to Supabase Storage
      const { error } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        throw error
      }

      setProgress(75)

      // Get the public URL for the newly uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      // Determine extension metadata
      const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown'
      
      // Save metadata to the relational database securely via Server Action
      const result = await saveUploadMetadata({
        fileName: file.name,
        fileUrl: publicUrl,
        fileType: extension,
        fileSize: file.size
      })

      // Trigger the background extraction pipeline
      if (result.documentId) {
        fetch('/api/process-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: result.documentId,
            userId: user.id,
            fileUrl: publicUrl,
            fileType: extension
          })
        }).catch(err => console.error("Failed to queue document processing", err));
      }

      setProgress(100)
      setStatus("success")
      
      // Reset UI after completion
      setTimeout(() => {
        setFile(null)
        setStatus("idle")
        setProgress(0)
        
        // Notify parent component if callback provided
        if (result.documentId && onUploadComplete) {
          onUploadComplete(result.documentId, file.name);
        }
      }, 1500)

    } catch (err: unknown) {
      console.error("Upload failed", err)
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload file.")
    }
  }

  return (
    <div className="w-full">
      {!file ? (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "border-dashed border border-border/80 rounded-xl flex flex-col items-center justify-center py-10 px-4 text-center transition-all duration-300 cursor-pointer bg-card/35 backdrop-blur-xs shadow-2xs hover:border-primary/40 hover:bg-card/75",
            isDragging ? "border-primary/60 bg-secondary/80" : ""
          )}
          onClick={() => document.getElementById("file-upload")?.click()}
        >
          <input
            id="file-upload"
            type="file"
            className="hidden"
            accept=".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png,.webp"
            onChange={onFileInputChange}
          />
          <div className="h-10 w-10 rounded-lg bg-secondary/80 border border-border/40 flex items-center justify-center mb-3 text-muted-foreground group-hover:text-primary transition-colors">
            <Upload className="h-5 w-5" />
          </div>
          <h3 className="text-xs font-semibold text-foreground mb-0.5">Click to upload or drag and drop</h3>
          <p className="text-[10px] text-muted-foreground">PDF, DOCX, PPTX, TXT or Images (max. 50MB)</p>
        </div>
      ) : (
        <div className="border border-border/85 rounded-xl p-4 bg-card/45 backdrop-blur-xs shadow-2xs">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-secondary/80 border border-border/40 flex items-center justify-center shrink-0">
                <File className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold truncate text-foreground select-none" title={file.name}>{file.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            {status !== "uploading" && status !== "success" && (
              <button onClick={() => setFile(null)} className="p-1 hover:bg-secondary rounded-full transition-colors cursor-pointer text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {status === "error" && (
            <div className="flex items-center gap-2 text-destructive text-xs mt-2 bg-destructive/5 p-2 rounded-lg border border-destructive/15">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{errorMsg}</span>
            </div>
          )}

          {status === "success" && (
            <div className="flex items-center gap-2 text-emerald-400 text-xs mt-2 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/15">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Upload complete and metadata saved!</span>
            </div>
          )}

          {(status === "uploading" || status === "success") && (
            <div className="space-y-1.5 mt-3">
              <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                <span>{status === "success" ? "Finalizing" : "Uploading securely"}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1 bg-secondary text-primary" />
            </div>
          )}

          {status === "idle" && (
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border/20">
              <button 
                className="px-3 py-1.5 text-xs font-semibold hover:bg-secondary rounded-lg transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setFile(null)}
              >
                Cancel
              </button>
              <button 
                className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/95 transition-all shadow-xs cursor-pointer"
                onClick={handleUpload}
              >
                Upload File
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
