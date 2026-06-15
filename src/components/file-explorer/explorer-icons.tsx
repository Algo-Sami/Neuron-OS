"use client";

import React from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileAudio,
  FileVideo,
  FileImage,
  File,
  FileSpreadsheet,
  Presentation,
  BookOpen,
  Brain,
} from "lucide-react";

interface FileIconProps {
  type: string;
  className?: string;
  isOpen?: boolean;
}

export function FileIcon({ type, className = "h-4 w-4", isOpen = false }: FileIconProps) {
  const t = (type || "").toLowerCase().trim();

  // Folders
  if (t === "folder") {
    return isOpen ? (
      <FolderOpen className={`${className} text-blue-400`} />
    ) : (
      <Folder className={`${className} text-blue-400`} />
    );
  }

  // Subjects (Acts as special top-level folder, let's use a nice Indigo/Purple colored folder)
  if (t === "subject") {
    return isOpen ? (
      <FolderOpen className={`${className} text-indigo-400`} />
    ) : (
      <Folder className={`${className} text-indigo-400`} />
    );
  }

  // Documents
  if (t === "pdf") {
    return <FileText className={`${className} text-red-500`} />;
  }
  
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(t)) {
    return <FileImage className={`${className} text-emerald-400`} />;
  }

  if (["doc", "docx"].includes(t)) {
    return <FileText className={`${className} text-blue-500`} />;
  }

  if (["ppt", "pptx"].includes(t)) {
    return <Presentation className={`${className} text-orange-500`} />;
  }

  if (["xls", "xlsx", "csv"].includes(t)) {
    return <FileSpreadsheet className={`${className} text-green-500`} />;
  }

  if (["mp3", "wav", "m4a", "ogg"].includes(t)) {
    return <FileAudio className={`${className} text-amber-500`} />;
  }

  if (["mp4", "mkv", "avi", "mov", "webm"].includes(t)) {
    return <FileVideo className={`${className} text-violet-500`} />;
  }

  if (["js", "ts", "tsx", "html", "css", "py", "cpp", "json"].includes(t)) {
    return <FileCode className={`${className} text-cyan-400`} />;
  }

  // AI generated / Special categories
  if (t === "assignment") {
    return <BookOpen className={`${className} text-pink-400`} />;
  }

  if (t === "notes" || t === "note") {
    return <FileText className={`${className} text-yellow-400`} />;
  }

  if (t === "ai") {
    return <Brain className={`${className} text-purple-400`} />;
  }

  // Fallback default file icon
  return <File className={`${className} text-zinc-400`} />;
}
