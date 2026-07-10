export interface KeywordMapping {
  keywords: string[];
  folderName: string;
}

export const DEFAULT_KEYWORD_MAPPINGS: KeywordMapping[] = [
  // Presentations must be listed before Lectures so that presentation-related
  // keywords (ppt, pptx, slides, seminar) take priority over the Lectures entry
  // when both could match at the same position in a filename.
  { keywords: ["presentation", "ppt", "pptx", "slides", "seminar"], folderName: "Presentations" },
  { keywords: ["assignment", "homework", "task", "project-milestone"], folderName: "Assignments" },
  { keywords: ["lecture", "lec", "class"], folderName: "Lectures" },
  { keywords: ["quiz", "exam", "test", "assessment", "midterm", "final"], folderName: "Quizzes" },
  { keywords: ["project", "capstone", "implementation"], folderName: "Projects" },
];

export const SUBJECT_SYNONYMS: Record<string, string[]> = {
  "DBMS": ["database management systems", "dbms", "database management", "intro to dbms", "introduction to dbms", "database systems", "databases", "database"],
  "Operating Systems": ["operating systems", "os", "operating system", "introduction to operating systems", "intro to os", "introduction to os"],
  "Computer Networks": ["computer networks", "cn", "networks", "data communication and networks", "network"],
  "Software Engineering": ["software engineering", "se", "intro to software engineering", "introduction to software engineering"],
  "Artificial Intelligence": ["artificial intelligence", "ai", "intro to ai", "introduction to ai"],
  "Machine Learning": ["machine learning", "ml", "intro to ml", "introduction to ml"],
  "Data Structures": ["data structures", "dsa", "data structures and algorithms", "algorithms", "data structure"],
  "Digital Logic Design": ["digital logic design", "dld", "digital logic"],
};

// Descriptive words to strip from subject names
export const IGNORE_WORDS = [
  "theory",
  "practical",
  "lab",
  "laboratory",
  "manual",
  "notes",
  "note",
  "lecture",
  "assignment",
  "quiz",
  "mid",
  "midterm",
  "final",
  "chapter",
  "unit",
  "exercise",
  "introduction to",
  "intro to",
  "introduction",
  "intro",
];

export interface RoutingResult {
  subjectName: string;
  folderName: string | null;
  labSubfolderName: string | null;
  confidence: number;
}

/**
 * Capitalize a string to Title Case, keeping acronyms uppercase.
 */
function toTitleCase(text: string): string {
  return text
    .split(" ")
    .map((word) => {
      const upper = word.toUpperCase();
      // If it looks like an acronym (2-4 characters, e.g. DBMS, OS, AI), keep it uppercase
      if (/^[A-Z]{2,4}$/.test(upper)) {
        return upper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Fully normalize a subject name by removing common descriptive/academic words
 * and matching against synonym groups.
 */
export function normalizeSubjectName(name: string): string {
  let cleaned = name.toLowerCase();

  // Replace common separators with spaces
  cleaned = cleaned.replace(/[_\-\.:]/g, " ");

  // Remove common descriptive / junk words
  for (const word of IGNORE_WORDS) {
    // Match word boundaries to prevent partial word deletion (e.g., "final" in "finalization")
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    cleaned = cleaned.replace(regex, "");
  }

  // Trim and collapse multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Search in synonym mappings
  for (const [canonical, synonyms] of Object.entries(SUBJECT_SYNONYMS)) {
    if (cleaned === canonical.toLowerCase()) {
      return canonical;
    }
    for (const synonym of synonyms) {
      if (cleaned === synonym.toLowerCase()) {
        return canonical;
      }
    }
  }

  // Return formatted title-cased name
  return toTitleCase(cleaned);
}

/**
 * Check if the filename represents a Lab file.
 */
function isLabFile(fileName: string): boolean {
  return /\b(lab|laboratory|practicals|practical)\b/i.test(fileName);
}

/**
 * Determine the specific Lab subfolder name.
 */
function getLabSubfolder(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  // Check most specific categories first to avoid false-positive fallbacks
  if (/\b(terminal|terminals)\b/i.test(lowerName)) {
    return "Terminals";
  }
  if (/\b(viva|oral|oral[\s-]exam)\b/i.test(lowerName)) {
    return "Viva";
  }
  if (/\b(task|tasks|report|reports|sheet|sheets|session|sessions|experiment|experiments)\b/i.test(lowerName)) {
    return "Lab Tasks";
  }
  if (/\b(manual|manuals|guide|guides|instruction|instructions)\b/i.test(lowerName)) {
    return "Lab Manuals";
  }
  return "Other Lab Files";
}

/**
 * Analyze a filename to extract and normalize the subject name and destination folder.
 */
export function classifyFilename(
  fileName: string,
  mappings: KeywordMapping[] = DEFAULT_KEYWORD_MAPPINGS
): RoutingResult {
  // Remove file extension
  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf(".")) || fileName;
  
  let bestMatchIndex = -1;
  let matchedFolderName: string | null = null;
  let matchedKeywordLength = 0;

  // Search for the earliest matching folder keyword in the filename (excluding "lab" folder keywords for now)
  for (const mapping of mappings) {
    for (const keyword of mapping.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b|_${keyword}_|-${keyword}-|\\b${keyword}(?=\\d)|(?<=\\d)${keyword}\\b`, "i");
      const match = regex.exec(nameWithoutExt);
      
      if (match) {
        const index = match.index;
        if (bestMatchIndex === -1 || index < bestMatchIndex || (index === bestMatchIndex && match[0].length > matchedKeywordLength)) {
          bestMatchIndex = index;
          matchedFolderName = mapping.folderName;
          matchedKeywordLength = match[0].length;
        }
      }
    }
  }

  // Determine if it is a Lab file
  const isLab = isLabFile(nameWithoutExt);

  // If a folder or lab keyword index is found, extract subject prefix before the match
  let cutIndex = bestMatchIndex;
  
  // If it's a lab file, locate the earliest occurrence of the lab keyword
  if (isLab) {
    const labMatch = /\b(lab|laboratory|practicals|practical)\b/i.exec(nameWithoutExt);
    if (labMatch && (cutIndex === -1 || labMatch.index < cutIndex)) {
      cutIndex = labMatch.index;
      matchedFolderName = "Lab";
    }
  }

  if (cutIndex > 0) {
    const subjectPrefix = nameWithoutExt.substring(0, cutIndex);
    const normalizedSubject = normalizeSubjectName(subjectPrefix);

    if (normalizedSubject.length >= 2) {
      return {
        subjectName: normalizedSubject,
        folderName: matchedFolderName,
        labSubfolderName: matchedFolderName === "Lab" ? getLabSubfolder(nameWithoutExt) : null,
        confidence: 0.90,
      };
    }
  }

  // Fallback: If no keyword index can split the filename, normalize the whole filename (excluding extension)
  const normalizedSubject = normalizeSubjectName(nameWithoutExt);
  if (normalizedSubject.length >= 2 && !IGNORE_WORDS.includes(normalizedSubject.toLowerCase())) {
    return {
      subjectName: normalizedSubject,
      folderName: isLab ? "Lab" : null,
      labSubfolderName: isLab ? getLabSubfolder(nameWithoutExt) : null,
      confidence: 0.80, // Lower but confident
    };
  }

  return {
    subjectName: "General Study",
    folderName: null,
    labSubfolderName: null,
    confidence: 0.0,
  };
}
