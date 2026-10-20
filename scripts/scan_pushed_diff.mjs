import { execSync } from 'child_process';

const diff = execSync('git diff 1340161..HEAD', { encoding: 'utf8' });

console.log('Total diff characters to scan:', diff.length);

const rules = [
  { name: 'Google API Keys', regex: /AIza[0-9A-Za-z_-]{35}/g },
  { name: 'Supabase JWTs', regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g },
  { name: 'Redis URIs with passwords', regex: /rediss?:\/\/(?:[^:\s]+)?:[^\s@]+@[^\s]+/g },
  { name: 'OpenAI / Anthropic Keys', regex: /sk-[A-Za-z0-9_-]{20,}/g },
  { name: 'Private Keys', regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g },
  { name: 'Secret variable assignments', regex: /(?:CRON_SECRET|SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY)\s*[:=]\s*['"][a-zA-Z0-9_\-]{8,}['"]/g }
];

let totalHits = 0;
for (const r of rules) {
  const matches = diff.match(r.regex) || [];
  console.log(`Rule [${r.name}]: ${matches.length} matches`);
  if (matches.length > 0) {
    totalHits += matches.length;
    console.error(`  FAIL! Matches found for ${r.name}:`, matches);
  }
}

if (totalHits === 0) {
  console.log('\n✅ PASS: Zero secrets found across entire commit range 1340161..HEAD!');
} else {
  console.error('\n❌ FAIL: Secrets detected in git diff!');
  process.exit(1);
}
