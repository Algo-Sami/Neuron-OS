const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenerativeAI(apiKey);
const modelName = 'gemini-3.5-flash';

async function run() {
  try {
    const model = ai.getGenerativeModel({ model: modelName });
    
    // Create a dummy PDF buffer (minimum valid PDF header is %PDF-1.4)
    const dummyPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    
    console.log('Sending inlineData PDF...');
    const result = await model.generateContent([
      {
        inlineData: {
          data: dummyPdfBuffer.toString('base64'),
          mimeType: 'application/pdf'
        }
      },
      'Extract text from this PDF.'
    ]);
    
    console.log('Response:', result.response.text());
  } catch (err) {
    console.error('Error calling Gemini with PDF inlineData:', err);
  }
}

run();
