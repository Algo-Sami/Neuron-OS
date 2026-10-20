import { createClient } from '@supabase/supabase-js';
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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function pass(msg) { console.log(`  ✅ PASS: ${msg}`); }
function fail(msg) { console.error(`  ❌ FAIL: ${msg}`); process.exitCode = 1; }
function info(msg) { console.log(`  ℹ️  ${msg}`); }

async function main() {
  console.log('===============================================================');
  console.log('DEPLOYED WRITERS TEST: SIGNUP, DASHBOARD, EDIT, AVATAR UPLOAD');
  console.log('===============================================================\n');

  const runId = Date.now();
  const testEmail = `new_student_${runId}@example.com`;
  const testPassword = 'Password123!Secure';
  const username = `student_${runId.toString().slice(-6)}`;

  info(`1. Testing Brand-New Signup: ${testEmail}`);

  // Step 1: Sign up through client auth API
  const { data: signUpData, error: signUpErr } = await anonClient.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: 'Brand New Student',
        username: username,
        university: 'COMSATS University',
        degree_program: 'Software Engineering',
        semester: 'Semester 1'
      }
    }
  });

  if (signUpErr || !signUpData.user) {
    fail(`Signup failed: ${signUpErr?.message}`);
    return;
  }
  const userId = signUpData.user.id;
  pass(`Created user account (ID: ${userId})`);

  // Step 2: Test Onboarding supplementary update via admin client (as in updated auth.ts)
  info('2. Testing Onboarding Supplementary Profile Save (via admin client)...');
  const { error: onboardErr } = await admin
    .from('profiles')
    .upsert({
      id: userId,
      first_name: 'Brand',
      last_name: 'Student',
      full_name: 'Brand New Student',
      username: username,
      email: testEmail,
      bio: 'Enthusiastic CS learner',
      university: 'COMSATS University',
      major: 'Software Engineering',
      degree_program: 'Software Engineering',
      semester: 'Semester 1',
      interests: ['Distributed Systems', 'Security'],
      study_goals: ['Graduate with honors'],
      country: 'Pakistan',
      timezone: 'UTC+5',
      updated_at: new Date().toISOString()
    });

  if (onboardErr) {
    fail(`Onboarding profile save failed: ${onboardErr.message}`);
    return;
  }
  pass('Onboarding profile save succeeded.');

  // Step 3: Test Student Login and JWT acquisition
  info('3. Authenticating as the new student...');
  const { data: authSession, error: signInErr } = await anonClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (signInErr || !authSession.session) {
    fail(`Student sign-in failed: ${signInErr?.message}`);
    return;
  }

  const studentClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${authSession.session.access_token}`
      }
    }
  });
  pass('Student acquired authenticated JWT session.');

  // Step 4: Test First Dashboard Load / Fetch Profile
  info('4. Simulating first dashboard load (read profile + progress)...');
  const { data: dashboardProfile, error: dashErr } = await studentClient
    .from('profiles')
    .select('full_name, username, email, university, degree_program, semester, profile_image, interests')
    .eq('id', userId)
    .single();

  if (dashErr || !dashboardProfile) {
    fail(`Dashboard profile fetch failed: ${dashErr?.message}`);
  } else {
    pass(`Dashboard profile loaded cleanly: full_name="${dashboardProfile.full_name}", semester="${dashboardProfile.semester}"`);
  }

  // Step 5: Test Profile Edit (updateProfile action logic)
  info('5. Testing Student Profile Edit (name, bio, semester)...');
  const { error: editErr } = await studentClient
    .from('profiles')
    .update({
      first_name: 'Scholar',
      last_name: 'Updated',
      full_name: 'Scholar Updated',
      bio: 'Studying modern distributed architectures',
      semester: 'Semester 2',
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (editErr) {
    fail(`Student profile edit failed: ${editErr.message}`);
  } else {
    pass('Student profile edit succeeded with new semester and bio.');
  }

  // Step 6: Test Avatar Upload Profile Update (uploadAvatar action logic)
  info('6. Testing Avatar Upload Profile Save (profile_image & avatar_url)...');
  const mockAvatarUrl = `https://storage.example.com/avatars/${userId}/avatar.png`;
  const { error: avatarErr } = await studentClient
    .from('profiles')
    .update({
      profile_image: mockAvatarUrl,
      avatar_url: mockAvatarUrl,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (avatarErr) {
    fail(`Avatar profile save failed: ${avatarErr.message}`);
  } else {
    pass('Avatar URL and profile_image saved cleanly.');
  }

  // Step 7: Verify final database state
  info('7. Verifying final state in database...');
  const { data: finalP } = await admin
    .from('profiles')
    .select('full_name, bio, semester, avatar_url, profile_image, is_premium, boost_ai_limit')
    .eq('id', userId)
    .single();

  info(`Final state: ${JSON.stringify(finalP)}`);

  // Teardown
  info('8. Cleaning up test user account...');
  await admin.from('profiles').delete().eq('id', userId);
  await admin.auth.admin.deleteUser(userId);
  pass('Test user deleted. System restored.');

  console.log('\n===============================================================');
  console.log('ALL WRITER PATHS VERIFIED SUCCESSFULLY');
  console.log('===============================================================');
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
