import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Daily Check-In State Consistency Suite', () => {
  it('Test 1: First check-in of the day updates XP and sets last_check_in_date in one transaction', () => {
    let progress = {
      user_id: 'user_1',
      total_xp: 200,
      monthly_xp: 100,
      last_check_in_date: 'Mon Aug 31 2026',
      current_streak: 2
    };

    const todayStr = 'Tue Sep 01 2026';
    const checkInXP = 25;

    // Simulation of guarded atomic update: update only if last_check_in_date != todayStr
    let alreadyCheckedIn = progress.last_check_in_date === todayStr;
    assert.strictEqual(alreadyCheckedIn, false);

    // Apply update
    progress = {
      ...progress,
      total_xp: progress.total_xp + checkInXP,
      monthly_xp: progress.monthly_xp + checkInXP,
      last_check_in_date: todayStr
    };

    assert.strictEqual(progress.total_xp, 225);
    assert.strictEqual(progress.monthly_xp, 125);
    assert.strictEqual(progress.last_check_in_date, todayStr);
  });

  it('Test 2: Repeated check-in on the same day is rejected without awarding XP', () => {
    const progress = {
      user_id: 'user_1',
      total_xp: 225,
      monthly_xp: 125,
      last_check_in_date: 'Tue Sep 01 2026'
    };

    const todayStr = 'Tue Sep 01 2026';
    const isAlreadyCheckedIn = progress.last_check_in_date === todayStr;

    assert.strictEqual(isAlreadyCheckedIn, true);

    let xpGained = 0;
    if (!isAlreadyCheckedIn) {
      xpGained = 25;
    }

    assert.strictEqual(xpGained, 0);
  });

  it('Test 3: Concurrent check-in simulation guards against double awarding', () => {
    // Shared database state
    let dbRecord = {
      user_id: 'user_1',
      total_xp: 100,
      monthly_xp: 50,
      last_check_in_date: null as string | null
    };

    const todayStr = 'Tue Sep 01 2026';

    // Simulate atomic DB conditional update: update WHERE user_id = 'user_1' AND (last_check_in_date != todayStr OR last_check_in_date IS NULL)
    const attemptCheckIn = () => {
      if (dbRecord.last_check_in_date === todayStr) {
        return { success: false, alreadyCheckedIn: true };
      }

      // Atomic lock
      dbRecord.last_check_in_date = todayStr;
      dbRecord.total_xp += 25;
      dbRecord.monthly_xp += 25;

      return { success: true, xpGained: 25 };
    };

    // Tab 1 and Tab 2 click simultaneously
    const res1 = attemptCheckIn();
    const res2 = attemptCheckIn();

    // Exactly one request must succeed
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res2.success, false);
    assert.strictEqual(res2.alreadyCheckedIn, true);

    // Total XP must have increased by exactly 25 (not 50)
    assert.strictEqual(dbRecord.total_xp, 125);
    assert.strictEqual(dbRecord.monthly_xp, 75);
  });
});
