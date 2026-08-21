/**
 * Test Matrix for Study Pack Dispatch Logic
 *
 * Tests all 8 lifecycle states required by Phase 2B-1:
 * - Test 1: Fresh Pending Task -> status becomes Queued, scheduler dispatches
 * - Test 2: No Existing Task -> task created with Queued, scheduler dispatches
 * - Test 3: Already Queued -> existing task reused, no duplicate scheduler dispatch
 * - Test 4: Already Processing -> existing task reused, no scheduler dispatch
 * - Test 5: Completed -> existing task reused, no new scheduler (unless force)
 * - Test 6: Failed -> existing failed state preserved, no automatic retry (unless force)
 * - Test 7: Cancelled -> existing cancelled state preserved, no automatic dispatch
 * - Test 8: Repeated API Calls -> exactly one dispatch on pending/creation, subsequent no-op
 */

const PENDING_STATUS = 'pending';
const QUEUED_STATUS = 'Queued';

function evaluateDispatchDecision(existing, force = false) {
  let taskId;
  let shouldDispatch = false;
  let response;

  if (!existing) {
    // Case A: No existing task
    taskId = 'new-task-uuid';
    shouldDispatch = true;
    response = { success: true, message: 'Study pack queued', taskId, status: QUEUED_STATUS };
  } else {
    taskId = existing.id;
    const rawStatus = existing.status || '';
    const normalizedStatus = rawStatus.toLowerCase().trim();

    if (force) {
      shouldDispatch = true;
      response = { success: true, message: 'Study pack queued', taskId, status: QUEUED_STATUS, action: 'force_requeue_and_dispatch' };
    } else if (normalizedStatus === PENDING_STATUS) {
      // Case B: Existing task is 'pending'
      shouldDispatch = true;
      response = { success: true, message: 'Study pack queued', taskId, status: QUEUED_STATUS, action: 'transition_to_queued_and_dispatch' };
    } else if (normalizedStatus === 'queued') {
      // Case C: Existing task is already 'Queued'
      shouldDispatch = false;
      response = { success: true, message: 'Already queued', taskId, status: rawStatus };
    } else if (normalizedStatus === 'completed') {
      // Case E: Existing task is 'Completed'
      shouldDispatch = false;
      response = { success: true, message: 'Already completed', taskId, status: rawStatus };
    } else if (normalizedStatus === 'failed') {
      // Case F: Existing task is 'Failed'
      shouldDispatch = false;
      response = { success: false, message: 'Task failed previously', taskId, status: rawStatus };
    } else if (normalizedStatus === 'cancelled') {
      // Case G: Existing task is 'Cancelled'
      shouldDispatch = false;
      response = { success: false, message: 'Task cancelled', taskId, status: rawStatus };
    } else {
      // Case D: Existing task is actively processing
      shouldDispatch = false;
      response = { success: true, message: 'Already processing', taskId, status: rawStatus };
    }
  }

  return { shouldDispatch, response };
}

// Run Test Matrix
const results = [];

// Test 1: Fresh Pending Task
{
  const { shouldDispatch, response } = evaluateDispatchDecision({ id: 'task-1', status: 'pending' }, false);
  const passed = shouldDispatch === true && response.status === 'Queued' && response.message === 'Study pack queued';
  results.push({ name: 'Test 1 — Fresh Pending Task', passed, shouldDispatch, message: response.message });
}

// Test 2: No Existing Task
{
  const { shouldDispatch, response } = evaluateDispatchDecision(null, false);
  const passed = shouldDispatch === true && response.status === 'Queued' && response.message === 'Study pack queued';
  results.push({ name: 'Test 2 — No Existing Task', passed, shouldDispatch, message: response.message });
}

// Test 3: Already Queued
{
  const { shouldDispatch, response } = evaluateDispatchDecision({ id: 'task-3', status: 'Queued' }, false);
  const passed = shouldDispatch === false && response.message === 'Already queued';
  results.push({ name: 'Test 3 — Already Queued', passed, shouldDispatch, message: response.message });
}

// Test 4: Already Processing (e.g. Generating Summary)
{
  const { shouldDispatch, response } = evaluateDispatchDecision({ id: 'task-4', status: 'Generating Summary' }, false);
  const passed = shouldDispatch === false && response.message === 'Already processing';
  results.push({ name: 'Test 4 — Already Processing', passed, shouldDispatch, message: response.message });
}

// Test 5: Completed (without force)
{
  const { shouldDispatch, response } = evaluateDispatchDecision({ id: 'task-5', status: 'Completed' }, false);
  const passed = shouldDispatch === false && response.message === 'Already completed';
  results.push({ name: 'Test 5 — Completed', passed, shouldDispatch, message: response.message });
}

// Test 6: Failed (without force)
{
  const { shouldDispatch, response } = evaluateDispatchDecision({ id: 'task-6', status: 'Failed' }, false);
  const passed = shouldDispatch === false && response.success === false && response.message === 'Task failed previously';
  results.push({ name: 'Test 6 — Failed (No Auto Retry)', passed, shouldDispatch, message: response.message });
}

// Test 7: Cancelled (without force)
{
  const { shouldDispatch, response } = evaluateDispatchDecision({ id: 'task-7', status: 'Cancelled' }, false);
  const passed = shouldDispatch === false && response.success === false && response.message === 'Task cancelled';
  results.push({ name: 'Test 7 — Cancelled', passed, shouldDispatch, message: response.message });
}

// Test 8: Force Re-run on Failed or Completed Task
{
  const { shouldDispatch, response } = evaluateDispatchDecision({ id: 'task-8', status: 'Failed' }, true);
  const passed = shouldDispatch === true && response.status === 'Queued' && response.action === 'force_requeue_and_dispatch';
  results.push({ name: 'Test 8 — Force Run on Failed Task', passed, shouldDispatch, message: response.message });
}

// Test 9: Repeated API calls (First pending -> dispatched, Second queued -> no-op)
{
  const first = evaluateDispatchDecision({ id: 'task-9', status: 'pending' }, false);
  // Simulating state after first call: task is now 'Queued'
  const second = evaluateDispatchDecision({ id: 'task-9', status: 'Queued' }, false);
  const passed = first.shouldDispatch === true && second.shouldDispatch === false && second.response.message === 'Already queued';
  results.push({ name: 'Test 9 — Repeated API Calls', passed, firstDispatch: first.shouldDispatch, secondDispatch: second.shouldDispatch });
}

console.log(JSON.stringify(results, null, 2));
const allPassed = results.every(r => r.passed);
console.log(`\nOVERALL RESULT: ${allPassed ? 'ALL TESTS PASSED' : 'TESTS FAILED'}`);
process.exit(allPassed ? 0 : 1);
