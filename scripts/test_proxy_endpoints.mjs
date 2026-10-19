import fetch from 'node-fetch';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const BASE_URL = 'http://localhost:3000';
const CRON_SECRET = env.CRON_SECRET;

async function runTests() {
  console.log('=== TEST 1: Unauthenticated GET /dashboard ===');
  const dashRes = await fetch(`${BASE_URL}/dashboard`, {
    redirect: 'manual'
  });
  console.log(`HTTP Status: ${dashRes.status}`);
  console.log(`Location Header: ${dashRes.headers.get('location')}`);
  const isRedirect = (dashRes.status === 307 || dashRes.status === 308 || dashRes.status === 302 || dashRes.status === 303);
  const targetLocation = dashRes.headers.get('location') || '';
  if (isRedirect && targetLocation.includes('/login')) {
    console.log('✅ PASS: /dashboard redirects to /login');
  } else {
    console.error(`❌ FAIL: Expected redirect to /login, got ${dashRes.status} -> ${targetLocation}`);
  }

  console.log('\n=== TEST 2: Unauthenticated POST /api/assistant/chat ===');
  const chatRes = await fetch(`${BASE_URL}/api/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello' })
  });
  console.log(`HTTP Status: ${chatRes.status}`);
  const chatBody = await chatRes.json().catch(() => null);
  console.log(`Response Body:`, chatBody);
  if (chatRes.status === 401) {
    console.log('✅ PASS: /api/assistant/chat returns 401 Unauthorized');
  } else {
    console.error(`❌ FAIL: Expected 401, got ${chatRes.status}`);
  }

  console.log('\n=== TEST 3: /api/cron/check-stalled-jobs with CRON_SECRET ===');
  const cronRes = await fetch(`${BASE_URL}/api/cron/check-stalled-jobs`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CRON_SECRET}`
    }
  });
  console.log(`HTTP Status: ${cronRes.status}`);
  const cronBody = await cronRes.json().catch(() => null);
  console.log(`Response Body:`, cronBody);
  if (cronRes.status === 200 && cronBody?.success) {
    console.log('✅ PASS: /api/cron/check-stalled-jobs with bearer secret returns 200 OK');
  } else {
    console.error(`❌ FAIL: Expected 200 with success: true, got ${cronRes.status}`);
  }

  // Also test cron without secret to ensure unauthorized requests to cron return 401
  console.log('\n=== TEST 3b: /api/cron/check-stalled-jobs WITHOUT secret ===');
  const cronNoAuthRes = await fetch(`${BASE_URL}/api/cron/check-stalled-jobs`, {
    method: 'GET'
  });
  console.log(`HTTP Status: ${cronNoAuthRes.status}`);
  if (cronNoAuthRes.status === 401) {
    console.log('✅ PASS: /api/cron/check-stalled-jobs without secret correctly returns 401');
  } else {
    console.error(`❌ FAIL: Expected 401 without secret, got ${cronNoAuthRes.status}`);
  }
}

runTests().catch(console.error);
