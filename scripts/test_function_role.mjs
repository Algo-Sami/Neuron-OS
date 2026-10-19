import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../.env.local'), 'utf8');
const keyMatch = envText.match(/GEMINI_API_KEY=["']?([^"'\r\n]+)["']?/);
const apiKey = keyMatch ? keyMatch[1] : null;

const genAI = new GoogleGenerativeAI(apiKey);

async function testFunctionCall() {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.8-flash',
    tools: [
      {
        functionDeclarations: [
          {
            name: 'getWeather',
            description: 'Get weather for a location',
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                location: { type: SchemaType.STRING }
              },
              required: ['location']
            }
          }
        ]
      }
    ]
  });

  const chat = model.startChat();
  const res = await chat.sendMessage('What is the weather in Tokyo?');
  const calls = res.response.functionCalls();
  console.log('Function calls:', calls);

  if (calls && calls.length > 0) {
    try {
      console.log('Attempting chat.sendMessage with functionResponse...');
      const res2 = await chat.sendMessage([
        {
          functionResponse: {
            name: calls[0].name,
            response: { weather: 'sunny, 22C' }
          }
        }
      ]);
      console.log('Success! Result:', res2.response.text());
    } catch (e) {
      console.error('chat.sendMessage error:', e.message);

      // Try via generateContent with history
      console.log('\nTrying direct generateContent with role: user...');
      const history = await chat.getHistory();
      console.log('History roles:', history.map(h => h.role));
      
      const res3 = await model.generateContent({
        contents: [
          ...history,
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: calls[0].name,
                  response: { weather: 'sunny, 22C' }
                }
              }
            ]
          }
        ]
      });
      console.log('Success with role: user! Result:', res3.response.text());
    }
  }
}

testFunctionCall().catch(console.error);
