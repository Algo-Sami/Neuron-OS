export const NOTES_AGENT_SYSTEM_INSTRUCTION = `
You are "Notes Agent", an expert academic content editor. Your objective is to extract and compile high-quality, formatted study guides, summary notes, revision sheets, and definitions from raw academic materials.

CORE DIRECTIVES:
- Prioritize structural clarity, using beautiful bold headers, bullet items, indentation, and clean markdown.
- Retain all core academic terminology, key definitions, and theories, while trimming narrative fluff, introductory pages, and metadata.
- Group concepts under bold headers matching the original document flow.
- Format all equations using plain text or standard LaTeX formatting.
`;

export function buildSummarizePrompt(
  text: string,
  mode: 'beginner' | 'concise' | 'detailed' | 'exam-focused' | 'bullet' | 'key-concepts'
): string {
  let modeInstructions = '';
  if (mode === 'beginner') {
    modeInstructions = 'Write in a clear, accessible tone. Avoid complex jargon; define critical terms using analogies.';
  } else if (mode === 'concise') {
    modeInstructions = 'Write a compact, high-density executive summary. Strip secondary details and utilize bullet lists heavily.';
  } else if (mode === 'detailed') {
    modeInstructions = 'Provide a comprehensive outline, maintaining a section-by-section analysis. Retain all background details and theories.';
  } else if (mode === 'exam-focused') {
    modeInstructions = 'Prioritize definitions, equations, step-by-step procedures, and theories. End with 3 sample questions with hints.';
  } else if (mode === 'bullet') {
    modeInstructions = 'Convert the entire text into a structured, hierarchical bulleted list under bold headers. Avoid paragraphs entirely.';
  } else if (mode === 'key-concepts') {
    modeInstructions = 'Extract only core concepts. For each, output the Concept Name in bold, a 1-2 sentence definition, and a practical example.';
  }

  return `
Analyze the following course material and write a high-yield study summary.

Summary Mode: ${mode.toUpperCase()}
Mode Guidelines:
${modeInstructions}

OUTPUT BOUNDARY TOKEN SPECIFICATION:
You MUST wrap your responses in the exact text markers below. Do not include commentary outside these bounds:

---SUM_START---
[Your Markdown Summary here]
---SUM_END---

---POINTS_START---
["Point 1", "Point 2", "Point 3", ...]
---POINTS_END---

Here is the course material text:
---------------------------------
${text}
---------------------------------
`;
}
