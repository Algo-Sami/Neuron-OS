const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const dotenv = require('dotenv');
const https = require('https');

// Load env
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  try {
    // 1. Get a PDF document from DB
    const { data: docs, error: dbErr } = await supabase
      .from('documents')
      .select('id, title, file_url, file_type')
      .eq('file_type', 'pdf')
      .limit(5);

    if (dbErr) throw dbErr;
    if (!docs || docs.length === 0) {
      console.log('No PDF documents found in database to test.');
      return;
    }

    console.log('Found PDF documents in database:', docs);

    for (const doc of docs) {
      console.log(`\n--- Testing PDF Document: ${doc.title} (${doc.file_url}) ---`);
      
      let buffer;
      try {
        buffer = await downloadFile(doc.file_url);
        console.log(`Downloaded ${buffer.length} bytes.`);
      } catch (dlErr) {
        console.error(`Failed to download ${doc.title}:`, dlErr.message);
        continue;
      }

      // Test pdf-parse
      let text = '';
      try {
        const data = await pdfParse(buffer);
        text = data.text || '';
        console.log(`pdf-parse extracted length: ${text.trim().length} chars.`);
      } catch (parseErr) {
        console.log('pdf-parse failed:', parseErr.message);
      }

      // Test Gemini OCR fallback
      console.log('Testing Gemini PDF OCR...');
      try {
        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = ai.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.5-flash' });
        
        const prompt = `
          You are an expert OCR and document text extraction tool.
          Your task is to extract all readable text from this PDF document as accurately as possible.
          Maintain the original layout, structure, headings, page numbers, and tables if possible.
          Do not summarize, do not comment, and do not add any conversational text.
          Just output the extracted text content.
        `;
        
        const result = await model.generateContent([
          {
            inlineData: {
              data: buffer.toString('base64'),
              mimeType: 'application/pdf'
            }
          },
          prompt
        ]);
        
        const geminiText = result.response.text();
        console.log(`Gemini OCR extracted length: ${geminiText.trim().length} chars.`);
        if (geminiText.trim().length > 0) {
          console.log('Gemini OCR snippet:', geminiText.trim().substring(0, 300));
        }
      } catch (geminiError) {
        console.error('Gemini PDF OCR failed with error:', geminiError);
      }
    }
  } catch (err) {
    console.error('Fatal error in debug script:', err);
  }
}

run();
