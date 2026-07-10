"use client";

import React from "react";
import {
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

function WindowsFolderIcon({ className, isOpen }: { className?: string; isOpen?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M19.5 21H4.5C3.12 21 2 19.88 2 18.5V7.5C2 6.12 3.12 5 4.5 5H9.38C9.9 5 10.4 5.21 10.77 5.58L12.92 7.73C13.01 7.82 13.14 7.87 13.27 7.87H19.5C20.88 7.87 22 8.99 22 10.37V18.5C22 19.88 20.88 21 19.5 21Z"
        fill="url(#folderBackGrad)"
      />
      {isOpen ? (
        <path
          d="M21.5 21H2.5C2.1 21 1.8 20.6 1.9 20.2L3.9 11.2C4.1 10.5 4.7 10 5.5 10H20.5C21.3 10 21.9 10.5 22.1 11.2L24.1 20.2C24.2 20.6 23.9 21 23.5 21H21.5Z"
          fill="url(#folderFrontGradOpen)"
        />
      ) : (
        <path
          d="M19.5 21H4.5C3.12 21 2 19.88 2 18.5V10C2 8.62 3.12 7.5 4.5 7.5H19.5C20.88 7.5 22 8.62 22 10V18.5C22 19.88 20.88 21 19.5 21Z"
          fill="url(#folderFrontGradClosed)"
        />
      )}
      <defs>
        <linearGradient id="folderBackGrad" x1="12" y1="5" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffca28" />
          <stop offset="1" stopColor="#ffb300" />
        </linearGradient>
        <linearGradient id="folderFrontGradClosed" x1="12" y1="7.5" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe082" />
          <stop offset="1" stopColor="#ffa000" />
        </linearGradient>
        <linearGradient id="folderFrontGradOpen" x1="13" y1="10" x2="13" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe082" />
          <stop offset="1" stopColor="#ff8f00" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function WindowsSubjectIcon({ className, isOpen, color }: { className?: string; isOpen?: boolean; color?: string | null }) {
  const c = color || "#F4C542";

  if (c.toLowerCase() === "#f4c542") {
    return (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path
          d="M19.5 21H4.5C3.12 21 2 19.88 2 18.5V7.5C2 6.12 3.12 5 4.5 5H9.38C9.9 5 10.4 5.21 10.77 5.58L12.92 7.73C13.01 7.82 13.14 7.87 13.27 7.87H19.5C20.88 7.87 22 8.99 22 10.37V18.5C22 19.88 20.88 21 19.5 21Z"
          fill="url(#subjBackGrad)"
        />
        {isOpen ? (
          <path
            d="M21.5 21H2.5C2.1 21 1.8 20.6 1.9 20.2L3.9 11.2C4.1 10.5 4.7 10 5.5 10H20.5C21.3 10 21.9 10.5 22.1 11.2L24.1 20.2C24.2 20.6 23.9 21 23.5 21H21.5Z"
            fill="url(#subjFrontGradOpen)"
          />
        ) : (
          <path
            d="M19.5 21H4.5C3.12 21 2 19.88 2 18.5V10C2 8.62 3.12 7.5 4.5 7.5H19.5C20.88 7.5 22 8.62 22 10V18.5C22 19.88 20.88 21 19.5 21Z"
            fill="url(#subjFrontGradClosed)"
          />
        )}
        <defs>
          <linearGradient id="subjBackGrad" x1="12" y1="5" x2="12" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFD76A" />
            <stop offset="1" stopColor="#D9A92F" />
          </linearGradient>
          <linearGradient id="subjFrontGradClosed" x1="12" y1="7.5" x2="12" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFD76A" />
            <stop offset="0.3" stopColor="#F4C542" />
            <stop offset="1" stopColor="#D9A92F" />
          </linearGradient>
          <linearGradient id="subjFrontGradOpen" x1="13" y1="10" x2="13" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFD76A" />
            <stop offset="0.3" stopColor="#F4C542" />
            <stop offset="1" stopColor="#D9A92F" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M19.5 21H4.5C3.12 21 2 19.88 2 18.5V7.5C2 6.12 3.12 5 4.5 5H9.38C9.9 5 10.4 5.21 10.77 5.58L12.92 7.73C13.01 7.82 13.14 7.87 13.27 7.87H19.5C20.88 7.87 22 8.99 22 10.37V18.5C22 19.88 20.88 21 19.5 21Z"
        fill={c}
        opacity="0.75"
      />
      {isOpen ? (
        <path
          d="M21.5 21H2.5C2.1 21 1.8 20.6 1.9 20.2L3.9 11.2C4.1 10.5 4.7 10 5.5 10H20.5C21.3 10 21.9 10.5 22.1 11.2L24.1 20.2C24.2 20.6 23.9 21 23.5 21H21.5Z"
          fill={c}
        />
      ) : (
        <path
          d="M19.5 21H4.5C3.12 21 2 19.88 2 18.5V10C2 8.62 3.12 7.5 4.5 7.5H19.5C20.88 7.5 22 8.62 22 10V18.5C22 19.88 20.88 21 19.5 21Z"
          fill={c}
        />
      )}
    </svg>
  );
}

interface FileIconProps {
  type: string;
  className?: string;
  isOpen?: boolean;
  color?: string | null;
}

export function FileIcon({ type, className = "h-4 w-4", isOpen = false, color = null }: FileIconProps) {
  const t = (type || "").toLowerCase().trim();

  // Folders
  if (t === "folder") {
    return <WindowsFolderIcon className={className} isOpen={isOpen} />;
  }

  // Subjects (Acts as special top-level folder, let's use a nice custom colored folder)
  if (t === "subject") {
    return <WindowsSubjectIcon className={className} isOpen={isOpen} color={color} />;
  }

  // Documents
  if (t === "pdf") {
    return <FileText className={`${className} text-red-500`} />;
  }
  
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(t)) {
    return <FileImage className={`${className} text-emerald-400`} />;
  }

  if (t === "txt") {
    return <FileText className={`${className} text-zinc-400`} />;
  }

  if (t === "md") {
    return <FileCode className={`${className} text-indigo-400`} />;
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
