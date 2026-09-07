import { Queue } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const redisUrl = process.env.REDIS_URL;
console.log('Testing Redis connection to:', redisUrl ? redisUrl.replace(/:[^:@]+@/, ':***@') : 'UNDEFINED');

if (!redisUrl) {
  console.error('No REDIS_URL found in .env.local');
  process.exit(1);
}

async function main() {
  const redis = new Redis(redisUrl, {
    connectTimeout: 10000,
    maxRetriesPerRequest: null,
  });

  try {
    const pingRes = await redis.ping();
    console.log('Redis PING response:', pingRes);

    const info = await redis.info('server');
    const clientsInfo = await redis.info('clients');
    console.log('\n--- Redis Server Info (extract) ---');
    console.log(info.split('\n').filter(l => l.startsWith('redis_version') || l.startsWith('os') || l.startsWith('uptime_in_days')).join('\n'));
    console.log('Connected clients info:\n' + clientsInfo.trim());

    // Check connected client list
    try {
      const clientList = await redis.client('LIST');
      console.log('\n--- Redis Connected Clients List ---');
      const lines = clientList.trim().split('\n');
      console.log(`Total connected client sockets: ${lines.length}`);
      for (const line of lines) {
        // extract addr, name, cmd, age, idle
        const match = line.match(/(addr=[^\s]+)|(name=[^\s]+)|(cmd=[^\s]+)|(age=[^\s]+)|(idle=[^\s]+)/g);
        console.log('  Client:', match ? match.join(' ') : line);
      }
    } catch (clientErr) {
      console.log('Could not fetch CLIENT LIST:', clientErr.message);
    }

    // Inspect BullMQ queue
    console.log('\n--- BullMQ Queue Status ("study-pack") ---');
    const queue = new Queue('study-pack', { connection: redis });
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
    console.log('Job counts:', counts);

    const workers = await queue.getWorkers();
    console.log(`Active BullMQ Workers registered on queue: ${workers.length}`);
    for (const w of workers) {
      console.log('  Worker:', w);
    }

    // Check waiting or active jobs details
    if (counts.waiting > 0 || counts.active > 0) {
      const waitingJobs = await queue.getJobs(['waiting', 'active'], 0, 10);
      console.log('\nWaiting/Active Jobs:');
      for (const j of waitingJobs) {
        console.log({
          id: j.id,
          name: j.name,
          data: j.data,
          opts: j.opts,
          timestamp: j.timestamp,
        });
      }
    }

    await queue.close();
    await redis.quit();
    console.log('\nDone.');
  } catch (err) {
    console.error('Redis inspection error:', err);
    await redis.quit();
    process.exit(1);
  }
}

main();
