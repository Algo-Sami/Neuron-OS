const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const dotenv = require('dotenv');

// Load env
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function classifyAcademicDocument(
  fileName,
  textSnippet,
  fileType,
  existingSubjects = []
) {
  try {
    const model = ai.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.5-flash' });

    // Define response schema
    const responseSchema = {
      type: 'OBJECT',
      description: 'AI-driven academic subject classification and course tagging results.',
      properties: {
        subject: {
          type: 'STRING',
          description: 'A standard, clean name of the university/academic course subject (e.g. Operating Systems, DBMS, Data Structures, AI, Calculus, Physics, Psychology). Use Capitalized naming.'
        },
        topic: {
          type: 'STRING',
          description: 'The specific topic, chapter, or sub-domain within the subject (e.g. CPU Scheduling, Normalization, Binary Trees, Neural Networks, Integration, Kinematics). Keep it short (1-3 words).'
        },
        docType: {
          type: 'STRING',
          description: 'The category of the document (e.g. Lecture Notes, Syllabus, Exam Paper, Assignment Brief, Lab Manual, Other).'
        },
        confidence: {
          type: 'NUMBER',
          description: 'Confidence score of the classification (between 0.00 and 1.00). If the document content is vague, out-of-scope, or lacks clear academic markers, assign a confidence lower than 0.70.'
        },
        tags: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: '3 to 5 specific academic keywords or concept tags extracted from the text.'
        }
      },
      required: ['subject', 'topic', 'docType', 'confidence', 'tags']
    };

    const prompt = `
      You are "Neuron Academic Organizer", an advanced AI classifier.
      Your job is to analyze the metadata of an uploaded file and classify it into an academic subject and course folder.
      
      FILE DETAILS:
      - Filename: "${fileName}"
      - File Extension: "${fileType}"
      
      EXTRACTED TEXT SNIPPET (First pages):
      """
      ${textSnippet.substring(0, 10000)}
      """
      
      CRITICAL INSTRUCTIONS:
      1. Subject: Standard course names like "Data Structures", "DBMS", "Operating Systems", "Calculus", "AI", "Physics", etc.
         ${existingSubjects.length > 0 ? `\nVERY IMPORTANT: The user already has the following subjects created: [${existingSubjects.join(', ')}]. If the document belongs to one of these, you MUST output the exact existing subject name. Only invent a new subject if it clearly does not fit into any of the existing ones.` : ''}
      2. Topic: Specify the exact lecture topic or chapter (e.g. "Process Scheduling" instead of "Lecture 3").
      3. Confidence Score:
         - Assign a high score (0.80 to 1.00) if the document clearly belongs to a specific university course.
         - Assign a low score (0.00 to 0.79) if the document is generic, vague, or you are guessing.
      4. Output: Produce output strictly formatted to the JSON schema.
    `;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1,
      }
    });

    const responseText = result.response.text();
    console.log('Gemini raw response:', responseText);
    
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```/, '').replace(/```$/, '').trim();
    }
    
    return JSON.parse(cleanedText);

  } catch (error) {
    console.error('Failed to classify document using Gemini:', error);
    return {
      subject: 'General Study',
      topic: 'General Notes',
      docType: 'Other',
      confidence: 0.50,
      tags: ['General', 'Unclassified']
    };
  }
}

async function run() {
  const fileName = 'AI_Assignment_No_04.pdf';
  const textSnippet = ''; // EMPTY!
  const fileType = 'pdf';
  const existingSubjects = ['Operating Systems', 'Mathematics'];

  console.log('Running classifyAcademicDocument with AI_Assignment_No_04.pdf and EMPTY textSnippet...');
  const result = await classifyAcademicDocument(fileName, textSnippet, fileType, existingSubjects);
  console.log('Final Result:', result);
}

run();
