const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const apiKey = process.env.GEMINI_API_KEY;
console.log('Using API Key:', apiKey);

const ai = new GoogleGenerativeAI(apiKey);
const modelName = 'gemini-3.5-flash';
console.log('Using Model Name:', modelName);

async function run() {
  try {
    const model = ai.getGenerativeModel({ model: modelName });
    const result = await model.generateContent('Hello, are you working?');
    console.log('Response:', result.response.text());
  } catch (err) {
    console.error('Error calling Gemini:', err);
  }
}

run();
