import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../.env.local'), 'utf8');
const keyMatch = envText.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)["']?/);
const apiKey = keyMatch ? keyMatch[1] : null;

if (!apiKey) {
  console.error("No GEMINI_API_KEY found in .env.local");
  process.exit(1);
}

console.log("Testing GEMINI_API_KEY against Google Generative Language API...");

async function checkKey() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "ping" }] }]
    })
  });

  console.log(`HTTP Status: ${response.status} ${response.statusText}`);
  console.log("Headers:");
  for (const [k, v] of response.headers.entries()) {
    if (k.includes('ratelimit') || k.includes('quota') || k.includes('billing') || k.includes('tier') || k.includes('google')) {
      console.log(`  ${k}: ${v}`);
    }
  }

  const data = await response.json();
  if (response.ok) {
    console.log("✅ API Key is ACTIVE and successfully generated content.");
    console.log("Model response snippet:", JSON.stringify(data).slice(0, 150));
  } else {
    console.error("❌ API Call failed:", data);
  }
}

checkKey().catch(console.error);
