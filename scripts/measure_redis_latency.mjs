import Redis from 'ioredis';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../.env.local'), 'utf8');
const redisMatch = envText.match(/REDIS_URL=["']?([^"'\r\n]+)["']?/);
const redisUrl = redisMatch ? redisMatch[1] : null;

if (!redisUrl) {
  console.error("No REDIS_URL found in .env.local");
  process.exit(1);
}

console.log("Connecting to Redis:", redisUrl.replace(/:[^:@]+@/, ':***@'));

const client = new Redis(redisUrl, {
  connectTimeout: 5000,
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  lazyConnect: true
});

async function measure() {
  const startConnect = Date.now();
  await client.connect();
  const connectMs = Date.now() - startConnect;
  console.log(`Connected successfully in ${connectMs}ms`);

  const latencies = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await client.ping();
    const t1 = performance.now();
    latencies.push(t1 - t0);
  }

  console.log("Ping latencies (ms):", latencies.map(l => l.toFixed(2)));
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  console.log(`Average Redis round-trip latency: ${avg.toFixed(2)}ms`);

  // Test basic SET and GET
  const setStart = performance.now();
  await client.set('neuron:test:ping', 'ok', 'EX', 10);
  const val = await client.get('neuron:test:ping');
  const opMs = performance.now() - setStart;
  console.log(`SET + GET roundtrip: ${opMs.toFixed(2)}ms (value: ${val})`);

  await client.quit();
}

measure().catch(err => {
  console.error("Redis connection failed:", err.message);
  process.exit(1);
});
