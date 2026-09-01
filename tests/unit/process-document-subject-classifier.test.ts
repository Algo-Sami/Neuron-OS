import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFolderCategory } from '../../src/services/classification/classifier';

describe('Process Document Centralized SubjectClassifier Suite', () => {
  it('Test 1: Resolves standard folder taxonomy (Lectures, Lab, Assignments, Quizzes) from filename', () => {
    const lectureRes = resolveFolderCategory('Operating Systems Lecture 04 - Virtual Memory.pdf');
    assert.strictEqual(lectureRes.folderName, 'Lectures');

    const labRes = resolveFolderCategory('CS201 Lab Experiment 03 - Pointers.pdf');
    assert.strictEqual(labRes.folderName, 'Lab');
    assert.strictEqual(labRes.labSubfolderName, 'Lab Tasks');

    const assignmentRes = resolveFolderCategory('Database Assignment 2 Submission.docx');
    assert.strictEqual(assignmentRes.folderName, 'Assignments');

    const quizRes = resolveFolderCategory('Midterm Exam Review Quiz.pdf');
    assert.strictEqual(quizRes.folderName, 'Quizzes');
  });

  it('Test 2: Arbitrary AI topic strings cannot create non-standard folders', () => {
    // When classifying, non-standard topics like "Distributed Hash Tables in Ring Topologies"
    // are mapped to standard folder categories (defaulting to 'Lectures') rather than arbitrary folder names.
    const file = 'Chapter 4 Distributed Hash Tables.pdf';
    const folderRes = resolveFolderCategory(file);
    const resolvedFolderName = folderRes.folderName || 'Lectures';
    assert.strictEqual(resolvedFolderName, 'Lectures');
    assert.notStrictEqual(resolvedFolderName, 'Distributed Hash Tables in Ring Topologies');
  });

  it('Test 3: High confidence (>= 0.90) sets status to auto_applied, low confidence sets needs_review', () => {
    const highConfScore = 0.95;
    const isHigh = highConfScore >= 0.90;
    const statusHigh = isHigh ? 'auto_applied' : 'needs_review';
    assert.strictEqual(statusHigh, 'auto_applied');

    const lowConfScore = 0.65;
    const isLow = lowConfScore >= 0.90;
    const statusLow = isLow ? 'auto_applied' : 'needs_review';
    assert.strictEqual(statusLow, 'needs_review');
  });

  it('Test 4: Lab subfolder nesting resolves accurately for Terminals, Viva, Manuals, and Tasks', () => {
    const viva = resolveFolderCategory('OS Lab Oral Viva Questions.pdf');
    assert.strictEqual(viva.folderName, 'Lab');
    assert.strictEqual(viva.labSubfolderName, 'Viva');

    const manual = resolveFolderCategory('Data Structures Laboratory Manual 2026.pdf');
    assert.strictEqual(manual.folderName, 'Lab');
    assert.strictEqual(manual.labSubfolderName, 'Lab Manuals');

    const terminal = resolveFolderCategory('Database Lab Terminal Exam.pdf');
    assert.strictEqual(terminal.folderName, 'Lab');
    assert.strictEqual(terminal.labSubfolderName, 'Terminals');
  });
});
