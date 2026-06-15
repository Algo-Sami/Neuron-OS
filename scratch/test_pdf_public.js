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
    // Download a sample PDF file
    const url = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
    console.log('Downloading sample PDF...');
    const buffer = await downloadFile(url);
    console.log(`Downloaded ${buffer.length} bytes.`);

    // Test pdf-parse
    console.log('Testing pdf-parse...');
    let text = '';
    try {
      const data = await pdfParse(buffer);
      text = data.text || '';
      console.log(`pdf-parse extracted length: ${text.trim().length} chars.`);
      console.log('pdf-parse text snippet:', text.trim().substring(0, 200));
    } catch (parseErr) {
      console.error('pdf-parse failed:', parseErr);
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
      console.log('Gemini OCR snippet:', geminiText.trim().substring(0, 300));
    } catch (geminiError) {
      console.error('Gemini PDF OCR failed with error:', geminiError);
    }
  } catch (err) {
    console.error('Fatal error in debug script:', err);
  }
}

run();
