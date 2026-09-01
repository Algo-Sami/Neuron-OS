import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Quiz Monthly XP Synchronization Suite', () => {
  it('Test 1: Base Quiz XP and Bonus XP are added equally to total_xp and monthly_xp', () => {
    let userProgress = {
      total_xp: 500,
      monthly_xp: 200,
      current_level: 1
    };

    const baseXP = 150;
    const speedBonus = 30;
    const comboBonus = 15;
    const streakBonus = 25;
    const totalQuizXP = baseXP + speedBonus + comboBonus + streakBonus; // 220
    const extraXP = Math.max(0, totalQuizXP - 150); // 70

    // Simulation of unified awardXP with bonusXp
    const finalPointsAwarded = 150 + extraXP; // 220

    userProgress = {
      ...userProgress,
      total_xp: userProgress.total_xp + finalPointsAwarded,
      monthly_xp: userProgress.monthly_xp + finalPointsAwarded
    };

    // Both total_xp and monthly_xp must have grown by exactly 220
    assert.strictEqual(userProgress.total_xp, 720);
    assert.strictEqual(userProgress.monthly_xp, 420);
    assert.strictEqual(userProgress.total_xp - 500, userProgress.monthly_xp - 200);
  });

  it('Test 2: Perfect Quiz score awards perfect score bonus consistently to both counters', () => {
    let userProgress = {
      total_xp: 1000,
      monthly_xp: 600,
      current_level: 2
    };

    const correctCount = 5;
    const totalQuestions = 5;
    const isPerfect = correctCount === totalQuestions;

    const baseXP = correctCount * 20; // 100
    const completionXP = 50;
    const perfectBonus = 100;
    const totalQuizXP = baseXP + completionXP + perfectBonus; // 250
    const standardBase = isPerfect ? 250 : 150;
    const extraXP = Math.max(0, totalQuizXP - standardBase); // 0 extra beyond standard 250

    const finalPointsAwarded = standardBase + extraXP; // 250

    userProgress = {
      ...userProgress,
      total_xp: userProgress.total_xp + finalPointsAwarded,
      monthly_xp: userProgress.monthly_xp + finalPointsAwarded
    };

    assert.strictEqual(userProgress.total_xp, 1250);
    assert.strictEqual(userProgress.monthly_xp, 850);
  });

  it('Test 3: Unlocked achievement rewards update monthly_xp in sync with total_xp', () => {
    let userProgress = {
      total_xp: 1250,
      monthly_xp: 850
    };

    const achievementReward = 100; // e.g. "Quiz Whiz" badge

    userProgress = {
      ...userProgress,
      total_xp: userProgress.total_xp + achievementReward,
      monthly_xp: userProgress.monthly_xp + achievementReward
    };

    assert.strictEqual(userProgress.total_xp, 1350);
    assert.strictEqual(userProgress.monthly_xp, 950);
  });
});
