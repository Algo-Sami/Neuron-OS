import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../.env.local'), 'utf8');
const keyMatch = envText.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)["']?/);
const apiKey = keyMatch ? keyMatch[1] : null;

async function checkKey() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Respond with exactly: OK" }] }]
    })
  });

  console.log(`HTTP Status: ${response.status} ${response.statusText}`);
  console.log("All Response Headers:");
  for (const [k, v] of response.headers.entries()) {
    console.log(`  ${k}: ${v}`);
  }
}

checkKey().catch(console.error);
