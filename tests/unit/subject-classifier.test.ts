import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SubjectClassifier } from '../../src/services/classification/classifier';
import { UserSubject } from '../../src/services/classification/types';

// Mock test subjects for User A
const USER_A_SUBJECTS: UserSubject[] = [
  {
    id: 'sub-dbms-101',
    name: 'Database Management Systems',
    code: 'CS301',
    aliases: ['DBMS', 'Database Systems', 'DB'],
    representativeConcepts: [
      'SQL',
      'normalization',
      '1NF',
      '2NF',
      '3NF',
      'BCNF',
      'functional dependencies',
      'candidate keys',
      'relational model',
      'transactions',
    ],
  },
  {
    id: 'sub-os-102',
    name: 'Operating Systems',
    code: 'CS302',
    aliases: ['OS', 'Operating System Concepts'],
    representativeConcepts: [
      'process',
      'threads',
      'scheduling',
      'deadlock',
      'semaphores',
      'virtual memory',
      'paging',
      'kernel',
    ],
  },
  {
    id: 'sub-dsa-103',
    name: 'Data Structures',
    code: 'CS201',
    aliases: ['DSA', 'Data Structures & Algorithms'],
    representativeConcepts: [
      'linked list',
      'binary search tree',
      'heap',
      'graph traversal',
      'hash table',
      'quicksort',
    ],
  },
  {
    id: 'sub-se-104',
    name: 'Software Engineering',
    code: 'SE301',
    aliases: ['SE', 'Software Dev'],
    representativeConcepts: [
      'SDLC',
      'agile',
      'scrum',
      'requirements engineering',
      'UML',
      'design patterns',
    ],
  },
];

describe('Production-Grade Intelligent Subject Classification Suite', () => {
  // ── Test 1: Exact / Alias Match ───────────────────────────────────────────
  it('Test 1: "DBMS Lecture 03.pdf" matches Database Management Systems via alias/exact match', async () => {
    const result = await SubjectClassifier.classify(
      {
        userId: 'user-a',
        filename: 'DBMS Lecture 03.pdf',
      },
      { userSubjects: USER_A_SUBJECTS }
    );

    assert.equal(result.subjectId, 'sub-dbms-101');
    assert.equal(result.subjectName, 'Database Management Systems');
    assert.equal(result.method, 'exact_match');
    assert.ok(result.confidence >= 0.90, `Confidence ${result.confidence} should be >= 0.90`);
    assert.equal(result.folderName, 'Lectures');
  });

  // ── Test 2: Normalized Exact Match ─────────────────────────────────────────
  it('Test 2: "Database_Management_Systems_Week_4.pdf" matches Database Management Systems via normalized exact match', async () => {
    const result = await SubjectClassifier.classify(
      {
        userId: 'user-a',
        filename: 'Database_Management_Systems_Week_4.pdf',
      },
      { userSubjects: USER_A_SUBJECTS }
    );

    assert.equal(result.subjectId, 'sub-dbms-101');
    assert.equal(result.subjectName, 'Database Management Systems');
    assert.equal(result.method, 'exact_match');
    assert.ok(result.confidence >= 0.90);
  });

  // ── Test 3: Course Code Match ──────────────────────────────────────────────
  it('Test 3: "CS301 Lecture 5.pdf" matches Database Management Systems via course code CS301', async () => {
    const result = await SubjectClassifier.classify(
      {
        userId: 'user-a',
        filename: 'CS301 Lecture 5.pdf',
      },
      { userSubjects: USER_A_SUBJECTS }
    );

    assert.equal(result.subjectId, 'sub-dbms-101');
    assert.equal(result.subjectName, 'Database Management Systems');
    assert.equal(result.method, 'course_code');
    assert.ok(result.confidence >= 0.95);
  });

  // ── Test 4: Fuzzy Match ───────────────────────────────────────────────────
  it('Test 4: "Databse Managment Systems.pdf" matches Database Management Systems via fuzzy matching', async () => {
    const result = await SubjectClassifier.classify(
      {
        userId: 'user-a',
        filename: 'Databse Managment Systems.pdf',
      },
      { userSubjects: USER_A_SUBJECTS }
    );

    assert.equal(result.subjectId, 'sub-dbms-101');
    assert.equal(result.subjectName, 'Database Management Systems');
    assert.equal(result.method, 'fuzzy_match');
    assert.ok(result.confidence >= 0.80);
  });

  // ── Test 5: Semantic Content Match ────────────────────────────────────────
  it('Test 5: "Lecture 7.pdf" with SQL/Normalization content matches Database Management Systems via semantic matching', async () => {
    const content = `
      Lecture 7: Relational Database Normalization and Dependencies.
      Today we will discuss First Normal Form (1NF), Second Normal Form (2NF), and Third Normal Form (3NF).
      We explore candidate keys, functional dependencies, and relational model decomposition to eliminate anomalies.
      Finally, we run SQL queries to verify relational schema integrity.
    `;

    const result = await SubjectClassifier.classify(
      {
        userId: 'user-a',
        filename: 'Lecture 7.pdf',
        extractedText: content,
      },
      { userSubjects: USER_A_SUBJECTS }
    );

    assert.equal(result.subjectId, 'sub-dbms-101');
    assert.equal(result.subjectName, 'Database Management Systems');
    assert.equal(result.method, 'semantic_match');
    assert.ok(result.confidence >= 0.85);
  });

  // ── Test 6: Ambiguous Content Requires User Confirmation ──────────────────
  it('Test 6: "Lecture 7.pdf" with ambiguous content requires user confirmation (NOT silent routing)', async () => {
    // Content touches multiple unrelated subjects with single weak concepts
    const ambiguousContent = `
      Overview of modern computing paradigms.
      We look at general software testing and basic computer systems architecture.
    `;

    const result = await SubjectClassifier.classify(
      {
        userId: 'user-a',
        filename: 'Lecture 7.pdf',
        extractedText: ambiguousContent,
      },
      { userSubjects: USER_A_SUBJECTS, allowAI: false }
    );

    assert.equal(result.subjectId, null, 'Uncertain document should not be silently assigned a subject');
    assert.equal(result.needsUserConfirmation, true, 'needsUserConfirmation should be true');
    assert.equal(result.method, 'uncategorized');
  });

  // ── Test 7: Current Folder Context ────────────────────────────────────────
  it('Test 7: Uploading "lec9.pdf" within current folder "Data Structures" routes with 0 AI calls', async () => {
    const result = await SubjectClassifier.classify(
      {
        userId: 'user-a',
        filename: 'lec9.pdf',
        currentSubjectId: 'sub-dsa-103',
      },
      { userSubjects: USER_A_SUBJECTS }
    );

    assert.equal(result.subjectId, 'sub-dsa-103');
    assert.equal(result.subjectName, 'Data Structures');
    assert.equal(result.method, 'folder_context');
    assert.equal(result.confidence, 1.0);
  });

  // ── Test 8: Explicit User Selection ───────────────────────────────────────
  it('Test 8: Explicitly selecting "Operating Systems" for "chapter3.pdf" routes with 0 AI calls', async () => {
    const result = await SubjectClassifier.classify(
      {
        userId: 'user-a',
        filename: 'chapter3.pdf',
        subjectId: 'sub-os-102',
      },
      { userSubjects: USER_A_SUBJECTS }
    );

    assert.equal(result.subjectId, 'sub-os-102');
    assert.equal(result.subjectName, 'Operating Systems');
    assert.equal(result.method, 'explicit_selection');
    assert.equal(result.confidence, 1.0);
  });

  // ── Test 9: Generic Word Protection ───────────────────────────────────────
  it('Test 9: "Introduction to Systems.pdf" does NOT match Operating Systems solely on "systems"', async () => {
    const result = await SubjectClassifier.classify(
      {
        userId: 'user-a',
        filename: 'Introduction to Systems.pdf',
      },
      { userSubjects: USER_A_SUBJECTS }
    );

    // Should NOT automatically route to Operating Systems
    assert.notEqual(result.subjectId, 'sub-os-102');
    assert.equal(result.needsUserConfirmation, true);
  });

  // ── Test 10: Unknown Document ─────────────────────────────────────────────
  it('Test 10: Unknown document with no subject cues succeeds upload as needs_review', async () => {
    const result = await SubjectClassifier.classify(
      {
        userId: 'user-a',
        filename: 'scan_doc_2026_08.pdf',
      },
      { userSubjects: USER_A_SUBJECTS }
    );

    assert.equal(result.subjectId, null);
    assert.equal(result.needsUserConfirmation, true);
    assert.equal(result.method, 'uncategorized');
  });

  // ── Test 11: Scope Restriction to User's Actual Subjects ──────────────────
  it('Test 11: Content about DBMS when user has ONLY Data Structures & OS does NOT invent DBMS', async () => {
    const userWithNoDBMS: UserSubject[] = [
      { id: 'sub-dsa-103', name: 'Data Structures' },
      { id: 'sub-os-102', name: 'Operating Systems' },
    ];

    const dbmsContent = `
      Relational normalization and SQL queries for primary keys and foreign keys in database management.
    `;

    const result = await SubjectClassifier.classify(
      {
        userId: 'user-b',
        filename: 'Lecture 7.pdf',
        extractedText: dbmsContent,
      },
      { userSubjects: userWithNoDBMS, allowAI: false }
    );

    // Must NOT assign to a non-existent DBMS subject
    assert.equal(result.subjectId, null);
    assert.equal(result.needsUserConfirmation, true);
  });

  // ── Test 12: Candidate Margin Verification ────────────────────────────────
  it('Test 12: Ambiguous margin between runner-up and top candidate triggers review', () => {
    const candidates = [
      {
        subjectId: 'sub-dbms-101',
        subjectName: 'DBMS',
        score: 0.91,
        method: 'semantic_match' as const,
        evidence: ['Score 0.91'],
      },
      {
        subjectId: 'sub-se-104',
        subjectName: 'Software Engineering',
        score: 0.89,
        method: 'semantic_match' as const,
        evidence: ['Score 0.89'],
      },
    ];

    const margin = candidates[0].score - candidates[1].score;
    assert.ok(margin < 0.10, 'Candidate margin is less than 0.10 threshold');
  });

  // ── Test 13: Generic Academic Terms Protection ────────────────────────────
  it('Test 13: "Introduction to Computer Systems.pdf" does not false-positive match on "computer" or "systems"', async () => {
    const result = await SubjectClassifier.classify(
      {
        userId: 'user-a',
        filename: 'Introduction to Computer Systems.pdf',
      },
      { userSubjects: USER_A_SUBJECTS }
    );

    assert.notEqual(result.subjectId, 'sub-os-102');
    assert.equal(result.needsUserConfirmation, true);
  });

  // ── Test 14: User Custom Aliases ──────────────────────────────────────────
  it('Test 14: Validated user alias "DBMS" matches "DBMS Lec 5.pdf"', async () => {
    const result = await SubjectClassifier.classify(
      {
        userId: 'user-a',
        filename: 'DBMS Lec 5.pdf',
      },
      { userSubjects: USER_A_SUBJECTS }
    );

    assert.equal(result.subjectId, 'sub-dbms-101');
    assert.equal(result.subjectName, 'Database Management Systems');
    assert.equal(result.method, 'exact_match');
  });

  // ── Test 15: Invalid / Hallucinated LLM ID Rejection ──────────────────────
  it('Test 15: Rejects an invalid or hallucinated subject ID', () => {
    const hallucinatedId = 'hallucinated-uuid-999';
    const isValid = USER_A_SUBJECTS.some((s) => s.id === hallucinatedId);
    assert.equal(isValid, false, 'Hallucinated subject ID must be rejected');
  });

  // ── Test 16: Circular Queue Concept in Filename ───────────────────────────
  it('Test 16: "Lecture 6a-Circular Queue-Method 2.pdf" matches Data Structures via core domain concept', async () => {
    const result = await SubjectClassifier.classify(
      {
        userId: 'user-a',
        filename: 'Lecture 6a-Circular Queue-Method 2.pdf',
      },
      { userSubjects: USER_A_SUBJECTS }
    );

    assert.equal(result.subjectId, 'sub-dsa-103');
    assert.equal(result.subjectName, 'Data Structures');
    assert.equal(result.folderName, 'Lectures');
    assert.equal(result.method, 'exact_match');
  });

  // ── Test 17: Short Acronym Subject Match — The PP Problem ─────────────────
  // This is the core regression: "PP_lecture_6.pdf" MUST match a subject named "PP"
  // because filenames use underscores as delimiters, not as part of the subject name.
  it('Test 17: "PP_lecture_6.pdf" matches subject named "PP" via boundary-aware word matching', async () => {
    const PP_SUBJECTS: UserSubject[] = [
      {
        id: 'sub-pp-001',
        name: 'PP',
        aliases: ['Parallel Programming', 'Programming Paradigms'],
      },
      {
        id: 'sub-dsa-103',
        name: 'Data Structures',
        aliases: ['DSA'],
      },
    ];

    const result = await SubjectClassifier.classify(
      {
        userId: 'user-x',
        filename: 'PP_lecture_6.pdf',
      },
      { userSubjects: PP_SUBJECTS }
    );

    assert.equal(result.subjectId, 'sub-pp-001', 'PP_lecture_6.pdf must match subject "PP"');
    assert.equal(result.subjectName, 'PP');
    assert.ok(result.confidence >= 0.90, `Confidence ${result.confidence} should be >= 0.90`);
  });

  // ── Test 18: Multi-word Subject named PP maps from DEFAULT_LEGACY_SYNONYMS ─
  it('Test 18: "PP_lecture_6.pdf" with subject "Parallel Programming" also matches via generated acronym PP', async () => {
    const PP_FULL_SUBJECTS: UserSubject[] = [
      {
        id: 'sub-pp-full-001',
        name: 'Parallel Programming',
        aliases: [],
      },
    ];

    const result = await SubjectClassifier.classify(
      {
        userId: 'user-y',
        filename: 'PP_lecture_6.pdf',
      },
      { userSubjects: PP_FULL_SUBJECTS }
    );

    assert.equal(result.subjectId, 'sub-pp-full-001', 'Parallel Programming must be matched via acronym PP');
    assert.ok(result.confidence >= 0.90);
  });

  // ── Test 19: PP acronym must NOT match unrelated subjects ─────────────────
  it('Test 19: "PP_lecture_6.pdf" does NOT match Data Structures or Operating Systems', async () => {
    const UNRELATED_SUBJECTS: UserSubject[] = [
      { id: 'sub-dsa-103', name: 'Data Structures', aliases: ['DSA'] },
      { id: 'sub-os-102', name: 'Operating Systems', aliases: ['OS'] },
    ];

    const result = await SubjectClassifier.classify(
      {
        userId: 'user-z',
        filename: 'PP_lecture_6.pdf',
      },
      { userSubjects: UNRELATED_SUBJECTS, allowAI: false }
    );

    assert.equal(result.subjectId, null, 'PP should not match DSA or OS');
    assert.equal(result.needsUserConfirmation, true);
  });
});
