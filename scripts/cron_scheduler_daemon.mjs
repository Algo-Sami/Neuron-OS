import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../.env.local') });

const secret = process.env.CRON_SECRET;
const port = process.env.PORT || 3000;
const url = `http://localhost:${port}/api/cron/check-stalled-jobs`;

console.log(`[SchedulerDaemon] Starting automated unattended cron scheduler...`);
console.log(`[SchedulerDaemon] Target: ${url}`);
console.log(`[SchedulerDaemon] Interval: every 60 seconds`);

let executionCount = 0;

async function triggerCron() {
  executionCount++;
  const timestamp = new Date().toISOString();
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await res.json();
    console.log(`[${timestamp}] [Run #${executionCount}] HTTP ${res.status} — Success: ${data.success}, Stalled: ${data.totalStalled}, Message: "${data.message}"`);
  } catch (err) {
    console.error(`[${timestamp}] [Run #${executionCount}] Request error:`, err.message);
  }
}

// Fire once immediately on startup
await triggerCron();

// Then fire unprompted every 60 seconds
setInterval(triggerCron, 60000);
