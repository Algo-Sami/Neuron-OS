import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPointsPDF } from '../../src/services/pdf/study-pack-pdf';

describe('Neuron OS — Key Points PDF Generator Suite', () => {

  test('Test 1: generateKeyPointsPDF produces a valid non-empty PDF buffer from structured object', async () => {
    const data = {
      lectureTitle: 'Database Systems - Lecture 1',
      keyPoints: [
        'Relational databases organize data into structured tables with rows and columns.',
        'Primary keys uniquely identify each record in a table and ensure entity integrity.',
        'Foreign keys establish referential integrity between related tables.',
        'ACID properties (Atomicity, Consistency, Isolation, Durability) guarantee reliable transactions.',
        'SQL queries utilize declarative syntax to filter, join, and aggregate records.'
      ],
      importantFacts: [
        'E.F. Codd introduced the relational database model at IBM in 1970.',
        'B-Tree indexes provide logarithmic O(log N) search performance for high-throughput reads.',
        'Database normalization up to 3NF minimizes data redundancy and update anomalies.'
      ],
      quickRevisionTips: [
        'Review the difference between clustered and non-clustered indexes.',
        'Practice writing INNER JOIN vs LEFT OUTER JOIN queries.',
        'Memorize ACID principles and transaction isolation levels.'
      ]
    };

    const buffer = await generateKeyPointsPDF(data, 'DBMS_Lecture_1.pdf', 'Database Systems');

    assert.ok(buffer instanceof Buffer, 'Expected result to be a Node.js Buffer');
    assert.ok(buffer.length > 1000, `Expected PDF buffer to have substantial size (>1000 bytes), got ${buffer.length}`);
    
    // PDF Magic Number Check (%PDF-)
    const pdfHeader = buffer.subarray(0, 5).toString('ascii');
    assert.strictEqual(pdfHeader, '%PDF-', 'Buffer must begin with valid PDF header signature %PDF-');
  });

  test('Test 2: generateKeyPointsPDF gracefully handles empty/partial data without throwing', async () => {
    const emptyData = {};
    const buffer = await generateKeyPointsPDF(emptyData, 'Untitled.pdf', 'General Study');

    assert.ok(buffer instanceof Buffer, 'Expected result to be a Buffer');
    assert.ok(buffer.length > 500, 'Expected valid PDF structure even with minimal content');
    const pdfHeader = buffer.subarray(0, 5).toString('ascii');
    assert.strictEqual(pdfHeader, '%PDF-', 'Buffer must begin with valid PDF header signature %PDF-');
  });

  test('Test 3: generateKeyPointsPDF parses JSON string inputs correctly', async () => {
    const jsonStr = JSON.stringify({
      lectureTitle: 'Operating Systems - Processes & Threads',
      keyPoints: ['Process Control Block (PCB) stores execution state.', 'Context switching involves CPU register saves.'],
      importantFacts: ['Threads within the same process share virtual memory address space.'],
      quickRevisionTips: ['Remember PCB components and state transition diagram.']
    });

    const buffer = await generateKeyPointsPDF(jsonStr, 'OS_Lecture_3.pdf', 'Operating Systems');

    assert.ok(buffer instanceof Buffer);
    assert.ok(buffer.length > 1000);
    const pdfHeader = buffer.subarray(0, 5).toString('ascii');
    assert.strictEqual(pdfHeader, '%PDF-');
  });

  test('Test 4: generateKeyPointsPDF handles multi-page long content without error', async () => {
    const longKeyPoints = Array.from({ length: 30 }, (_, i) => 
      `Detailed Key Concept ${i + 1}: Modern computer architecture relies on memory hierarchies ranging from L1/L2/L3 caches down to NVMe SSD storage to balance speed and capacity.`
    );
    const longFacts = Array.from({ length: 15 }, (_, i) =>
      `Critical Fact ${i + 1}: Moore's Law and Dennard Scaling drove semiconductor density advancements for multiple decades.`
    );
    const longTips = Array.from({ length: 12 }, (_, i) =>
      `Revision Checklist ${i + 1}: Study pipeline hazards (structural, data, control) and branch prediction algorithms.`
    );

    const longData = {
      lectureTitle: 'Advanced Computer Architecture - Comprehensive Review',
      keyPoints: longKeyPoints,
      importantFacts: longFacts,
      quickRevisionTips: longTips
    };

    const buffer = await generateKeyPointsPDF(longData, 'CompArch_Final.pdf', 'Computer Architecture');

    assert.ok(buffer instanceof Buffer);
    assert.ok(buffer.length > 3000, `Multi-page PDF should be >3000 bytes, got ${buffer.length}`);
    const pdfHeader = buffer.subarray(0, 5).toString('ascii');
    assert.strictEqual(pdfHeader, '%PDF-');
  });

  test('Test 5: validateAssetContent passes for structured KeyPoints object with arrays', async () => {
    const { validateAssetContent } = await import('../../src/services/ai/pipeline/knowledge-asset-registry');
    
    const structuredData = {
      lectureTitle: 'Software Engineering - Design Patterns',
      keyPoints: [
        'Singleton pattern ensures a class has only one instance and provides global access.',
        'Factory Method defines an interface for creating objects but lets subclasses decide.',
        'Observer pattern establishes a one-to-many dependency between objects.'
      ],
      importantFacts: [
        'Gang of Four (GoF) published Design Patterns in 1994.',
        'Creational patterns abstract the instantiation process.'
      ],
      quickRevisionTips: [
        'Distinguish between structural and behavioral patterns.'
      ]
    };

    const result = validateAssetContent('key_points', structuredData);
    assert.strictEqual(result.passed, true, `Expected validation to pass, errors: ${result.errors.join(', ')}`);
    assert.strictEqual(result.errors.length, 0);
  });

  test('Test 6: validateAssetContent passes for string array format of key_points', async () => {
    const { validateAssetContent } = await import('../../src/services/ai/pipeline/knowledge-asset-registry');
    
    const arrayData = [
      'Encapsulation bundles data and methods operating on that data within a unit.',
      'Inheritance enables code reuse and hierarchical categorization.',
      'Polymorphism allows objects to be treated as instances of their parent class.'
    ];

    const result = validateAssetContent('key_points', arrayData);
    assert.strictEqual(result.passed, true, `Expected validation to pass, errors: ${result.errors.join(', ')}`);
    assert.strictEqual(result.errors.length, 0);
  });

  test('Test 7: validateAssetContent rejects empty or invalid key_points formats', async () => {
    const { validateAssetContent } = await import('../../src/services/ai/pipeline/knowledge-asset-registry');
    
    // Empty object
    const emptyObjRes = validateAssetContent('key_points', {});
    assert.strictEqual(emptyObjRes.passed, false, 'Empty object should fail validation');

    // Empty array
    const emptyArrRes = validateAssetContent('key_points', []);
    assert.strictEqual(emptyArrRes.passed, false, 'Empty array should fail validation');

    // Null
    const nullRes = validateAssetContent('key_points', null);
    assert.strictEqual(nullRes.passed, false, 'Null should fail validation');
  });

});

