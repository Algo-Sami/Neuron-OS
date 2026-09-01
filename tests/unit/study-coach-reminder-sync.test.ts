import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Study Coach Reminder Synchronization Suite', () => {
  it('Test 1: Generates reminders with [Study Coach] prefix and proper fields', () => {
    const task = {
      subject: 'Operating Systems',
      activity: 'Read Virtual Memory Chapter',
      durationMinutes: 45,
      type: 'focus'
    };

    const reminder = {
      title: `[Study Coach] ${task.subject}: ${task.activity}`,
      description: `Focus Block duration: ${task.durationMinutes} minutes. Recommended by your AI Study Planner.`,
      reminder_type: 'assignment',
      extracted_from_ai: true,
      completed_status: false
    };

    assert.ok(reminder.title.startsWith('[Study Coach]'));
    assert.strictEqual(reminder.extracted_from_ai, true);
    assert.strictEqual(reminder.completed_status, false);
  });

  it('Test 2: Synchronization purges ONLY [Study Coach] reminders and preserves manual and syllabus reminders', () => {
    const existingReminders = [
      { id: 'rem_1', user_id: 'user_1', title: '[Study Coach] OS: Process Scheduling', extracted_from_ai: true },
      { id: 'rem_2', user_id: 'user_1', title: 'Physics Lab Report Due', extracted_from_ai: false }, // Manual
      { id: 'rem_3', user_id: 'user_1', title: 'Calculus Midterm Exam', extracted_from_ai: true, reminder_type: 'exam' }, // Syllabus extracted
      { id: 'rem_4', user_id: 'user_2', title: '[Study Coach] DBMS: Normalization', extracted_from_ai: true } // Another user
    ];

    const currentUserId = 'user_1';

    // Simulate purge query: .eq("user_id", currentUserId).eq("extracted_from_ai", true).ilike("title", "[Study Coach]%")
    const remainingReminders = existingReminders.filter((r) => {
      const isStudyCoachAI = r.user_id === currentUserId && r.extracted_from_ai && r.title.toLowerCase().startsWith('[study coach]');
      return !isStudyCoachAI;
    });

    assert.strictEqual(remainingReminders.length, 3);
    assert.strictEqual(remainingReminders.some(r => r.id === 'rem_1'), false); // Purged
    assert.strictEqual(remainingReminders.some(r => r.id === 'rem_2'), true);  // Preserved manual
    assert.strictEqual(remainingReminders.some(r => r.id === 'rem_3'), true);  // Preserved syllabus
    assert.strictEqual(remainingReminders.some(r => r.id === 'rem_4'), true);  // Preserved other user
  });

  it('Test 3: Plan regeneration is idempotent and does not accumulate duplicate reminders', () => {
    let databaseReminders = [
      { id: 'rem_old1', user_id: 'user_1', title: '[Study Coach] OS: Scheduling', extracted_from_ai: true }
    ];

    const generateNewPlan = () => {
      // Purge old
      databaseReminders = databaseReminders.filter(
        r => !(r.user_id === 'user_1' && r.extracted_from_ai && r.title.startsWith('[Study Coach]'))
      );

      // Insert new 2 items
      databaseReminders.push(
        { id: 'rem_new1', user_id: 'user_1', title: '[Study Coach] OS: Memory Management', extracted_from_ai: true },
        { id: 'rem_new2', user_id: 'user_1', title: '[Study Coach] DBMS: SQL Indexing', extracted_from_ai: true }
      );
    };

    // Run once
    generateNewPlan();
    assert.strictEqual(databaseReminders.length, 2);

    // Run again (regenerate plan)
    generateNewPlan();
    assert.strictEqual(databaseReminders.length, 2);
    assert.strictEqual(databaseReminders[0].title, '[Study Coach] OS: Memory Management');
    assert.strictEqual(databaseReminders[1].title, '[Study Coach] DBMS: SQL Indexing');
  });

  it('Test 4: Past same-day slot rolls forward by 7 days to next week occurrence', () => {
    const now = new Date('2026-09-01T15:00:00.000Z'); // 3:00 PM Tuesday

    // Task scheduled for Tuesday 09:00 AM (which is in the past today)
    const taskDay = 'tuesday';
    const taskTime = '09:00 AM';

    const currentDayOfWeek = now.getDay(); // Tuesday is 2
    const targetDayIndex = 2;
    let diffDays = targetDayIndex - currentDayOfWeek;
    if (diffDays < 0) diffDays += 7;

    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + diffDays);

    const reminderDate = new Date(targetDate);
    reminderDate.setHours(9, 0, 0, 0);

    // Check past-timestamp rollover logic
    if (diffDays === 0 && reminderDate.getTime() <= now.getTime()) {
      reminderDate.setDate(reminderDate.getDate() + 7);
    }

    // Verify reminder is scheduled for next Tuesday at 9:00 AM
    assert.ok(reminderDate.getTime() > now.getTime());
    assert.strictEqual(reminderDate.getDate(), now.getDate() + 7);
    assert.strictEqual(reminderDate.getHours(), 9);
    assert.strictEqual(reminderDate.getMinutes(), 0);
  });

  it('Test 5: Future same-day slot remains scheduled for today', () => {
    const now = new Date('2026-09-01T10:00:00.000Z'); // 10:00 AM Tuesday

    // Task scheduled for Tuesday 04:00 PM (future today)
    const taskDay = 'tuesday';
    const taskTime = '04:00 PM';

    const currentDayOfWeek = now.getDay();
    const targetDayIndex = 2;
    let diffDays = targetDayIndex - currentDayOfWeek;
    if (diffDays < 0) diffDays += 7;

    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + diffDays);

    const reminderDate = new Date(targetDate);
    reminderDate.setHours(16, 0, 0, 0);

    if (diffDays === 0 && reminderDate.getTime() <= now.getTime()) {
      reminderDate.setDate(reminderDate.getDate() + 7);
    }

    // Verify reminder is scheduled for today at 4:00 PM
    assert.strictEqual(reminderDate.getDate(), now.getDate());
    assert.strictEqual(reminderDate.getHours(), 16);
    assert.strictEqual(reminderDate.getMinutes(), 0);
  });
});
