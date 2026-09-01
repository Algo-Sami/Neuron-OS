/**
 * Study Pack PDF Generator — React PDF Rendering Engine
 *
 * Replaces the previous PDFKit-based renderer with @react-pdf/renderer v4.
 * React PDF renders JSX components server-side to a PDF Buffer — no filesystem
 * font loading, no AFM files, fully compatible with Next.js / Turbopack.
 *
 * Public API is identical to the old file:
 *   generateSummaryPDF(summary, docTitle, subjectName) → Promise<Buffer>
 *
 * Future AI outputs (flashcards, quizzes, etc.) simply add new React components
 * and call renderToBuffer() — the rendering engine stays the same.
 */

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
  Font,
} from '@react-pdf/renderer';
import type { StudySummary } from '../ai/study-pack-generator';

// ── Register standard PDF fonts ────────────────────────────────────────────────
// @react-pdf/renderer ships its own font metrics — no .afm file loading required.
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
    { src: 'Helvetica-Oblique', fontStyle: 'italic' },
  ],
});

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  navy:      '#0f2447',
  blue:      '#1d4ed8',
  accent:    '#3b82f6',
  lightBlue: '#93c5fd',
  success:   '#059669',
  successBg: '#ecfdf5',
  warning:   '#d97706',
  warningBg: '#fffbeb',
  infoBg:    '#eff6ff',
  text:      '#111827',
  muted:     '#6b7280',
  white:     '#ffffff',
  light:     '#f8fafc',
  border:    '#e2e8f0',
};

// ── Heading level detector ─────────────────────────────────────────────────────
// Returns { level: 1-4, text } or null if not a heading line
function detectHeading(line: string): { level: number; text: string } | null {
  const m = line.match(/^(#{1,6})\s+(.+)$/);
  if (!m) return null;
  return { level: Math.min(m[1].length, 4), text: m[2].trim() };
}

// ── Strip emoji from heading titles for clean rendering ───────────────────────
function stripEmoji(text: string): string {
  // Remove common emoji unicode ranges and variation selectors
  return text
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/\uFE0F/gu, '')
    .trim();
}

// ── Inline Markdown span parser ────────────────────────────────────────────────
// Converts a string with **bold**, *italic*, ***bold-italic*** into
// an array of { text, bold, italic } tokens suitable for nested <Text> nodes.
interface InlineSpan {
  text: string;
  bold: boolean;
  italic: boolean;
}

function parseInlineSpans(raw: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  // Pattern: ***text***, **text**, *text*, __text__, _text_
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|___(.+?)___|__(.+?)__|_(.+?)_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    // Push any plain text before this match
    if (match.index > lastIndex) {
      spans.push({ text: raw.slice(lastIndex, match.index), bold: false, italic: false });
    }
    if (match[2] !== undefined) {
      // ***bold-italic***
      spans.push({ text: match[2], bold: true, italic: true });
    } else if (match[3] !== undefined) {
      // **bold**
      spans.push({ text: match[3], bold: true, italic: false });
    } else if (match[4] !== undefined) {
      // *italic*
      spans.push({ text: match[4], bold: false, italic: true });
    } else if (match[5] !== undefined) {
      // ___bold-italic___
      spans.push({ text: match[5], bold: true, italic: true });
    } else if (match[6] !== undefined) {
      // __bold__
      spans.push({ text: match[6], bold: true, italic: false });
    } else if (match[7] !== undefined) {
      // _italic_
      spans.push({ text: match[7], bold: false, italic: true });
    }
    lastIndex = regex.lastIndex;
  }

  // Push remaining plain text
  if (lastIndex < raw.length) {
    spans.push({ text: raw.slice(lastIndex), bold: false, italic: false });
  }

  return spans.filter(s => s.text.length > 0);
}

// ── Shared Styles ──────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: C.white,
    paddingBottom: 60,
  },

  // Header bar
  headerBar: {
    backgroundColor: C.navy,
    paddingHorizontal: 50,
    paddingTop: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerBrand: {
    color: C.white,
    fontSize: 13,
    fontWeight: 'bold',
  },
  headerType: {
    color: C.lightBlue,
    fontSize: 8,
    marginTop: 2,
  },
  headerDocTitle: {
    color: C.white,
    fontSize: 9,
    fontWeight: 'bold',
    maxWidth: 220,
    textAlign: 'right',
  },
  headerSubject: {
    color: C.lightBlue,
    fontSize: 8,
    marginTop: 2,
    textAlign: 'right',
  },

  // Info bar
  infoBar: {
    backgroundColor: C.light,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 50,
    paddingVertical: 6,
    flexDirection: 'row',
    gap: 20,
  },
  infoItem: {
    color: C.muted,
    fontSize: 8,
  },

  // Content area
  content: {
    paddingHorizontal: 50,
    paddingTop: 18,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: C.accent,
  },
  sectionAccentBar: {
    width: 4,
    height: 13,
    backgroundColor: C.accent,
    marginRight: 8,
    borderRadius: 2,
  },
  sectionTitle: {
    color: C.navy,
    fontSize: 11,
    fontWeight: 'bold',
  },

  // Objective row
  objectiveRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  objectiveNumber: {
    color: C.accent,
    fontSize: 10,
    fontWeight: 'bold',
    marginRight: 6,
    width: 16,
  },
  objectiveText: {
    color: C.text,
    fontSize: 10,
    lineHeight: 1.5,
    flex: 1,
  },

  // Paragraph
  paragraph: {
    color: C.text,
    fontSize: 10.5,
    lineHeight: 1.6,
    textAlign: 'justify',
    marginBottom: 10,
  },

  // Bullet row
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 5,
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.accent,
    marginTop: 4,
    marginRight: 10,
    flexShrink: 0,
  },
  bulletText: {
    color: C.text,
    fontSize: 10,
    lineHeight: 1.5,
    flex: 1,
  },

  // Takeaway card
  takeawayCard: {
    flexDirection: 'row',
    marginBottom: 5,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'flex-start',
  },
  takeawayIcon: {
    fontSize: 11,
    fontWeight: 'bold',
    marginRight: 7,
    marginTop: 1,
  },
  takeawayText: {
    fontSize: 10,
    lineHeight: 1.5,
    flex: 1,
  },

  // Callout card
  calloutCard: {
    borderRadius: 4,
    padding: 10,
    marginBottom: 7,
    borderLeftWidth: 3,
  },
  calloutText: {
    fontSize: 9.5,
    lineHeight: 1.55,
  },

  // ── Markdown heading hierarchy ────────────────────────────────────────────
  h1: {
    color: C.navy,
    fontSize: 17,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: C.accent,
  },
  h2: {
    color: C.navy,
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  h3: {
    color: C.blue,
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 5,
  },
  h4: {
    color: C.blue,
    fontSize: 10.5,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
  },

  // ── Inline span styles ───────────────────────────────────────────────────
  inlineBold: {
    fontWeight: 'bold',
  },
  inlineItalic: {
    fontStyle: 'italic',
  },
  inlineBoldItalic: {
    fontWeight: 'bold',
    fontStyle: 'italic',
  },

  // ── Horizontal rule ──────────────────────────────────────────────────────
  hrule: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginTop: 10,
    marginBottom: 10,
  },

  // ── Blockquote ───────────────────────────────────────────────────────────
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    backgroundColor: C.infoBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
    borderRadius: 2,
  },
  blockquoteText: {
    color: C.blue,
    fontSize: 10,
    lineHeight: 1.55,
    fontStyle: 'italic',
  },

  // ── Numbered list ────────────────────────────────────────────────────────
  numberRow: {
    flexDirection: 'row',
    marginBottom: 5,
    alignItems: 'flex-start',
  },
  numberLabel: {
    color: C.accent,
    fontSize: 10,
    fontWeight: 'bold',
    marginRight: 6,
    width: 18,
    flexShrink: 0,
  },

  // ── Nested bullet (indented sub-list) ────────────────────────────────────
  nestedBulletRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-start',
    marginLeft: 20,
  },
  nestedBulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.muted,
    marginTop: 5,
    marginRight: 8,
    flexShrink: 0,
  },

  // Cover page
  coverPage: {
    backgroundColor: C.navy,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  coverBrand: {
    color: C.lightBlue,
    fontSize: 12,
    letterSpacing: 3,
    marginBottom: 8,
  },
  coverTitle: {
    color: C.white,
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 1.3,
    maxWidth: 400,
  },
  coverDivider: {
    width: 60,
    height: 3,
    backgroundColor: C.accent,
    marginBottom: 22,
  },
  coverDocTitle: {
    color: C.white,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
    maxWidth: 380,
  },
  coverSubject: {
    color: C.lightBlue,
    fontSize: 11,
    textAlign: 'center',
  },
  coverDate: {
    color: C.lightBlue,
    fontSize: 9,
    textAlign: 'center',
    marginTop: 14,
    opacity: 0.7,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.navy,
    paddingHorizontal: 50,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    color: C.lightBlue,
    fontSize: 8,
  },
  footerRight: {
    color: C.lightBlue,
    fontSize: 8,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length > max ? text.substring(0, max - 3) + '…' : text;
}

// ── Shared Layout Components ──────────────────────────────────────────────────

function PageHeader({
  resourceType,
  docTitle,
  subjectName,
}: {
  resourceType: string;
  docTitle: string;
  subjectName: string;
}) {
  const cleanTitle = docTitle.replace(/\.[^/.]+$/, '');
  return (
    <View style={S.headerBar} fixed>
      <View>
        <Text style={S.headerBrand}>NEURON OS</Text>
        <Text style={S.headerType}>{resourceType}</Text>
      </View>
      <View>
        <Text style={S.headerDocTitle}>{truncate(cleanTitle, 38)}</Text>
        <Text style={S.headerSubject}>{truncate(subjectName, 38)}</Text>
      </View>
    </View>
  );
}

function InfoBar({ readingMinutes, wordCount }: { readingMinutes: number; wordCount?: number }) {
  const date = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  return (
    <View style={S.infoBar} fixed>
      <Text style={S.infoItem}>{date}</Text>
      {wordCount ? <Text style={S.infoItem}>{wordCount.toLocaleString()} words</Text> : null}
      <Text style={S.infoItem}>~{readingMinutes} min read</Text>
      <Text style={S.infoItem}>Generated by Neuron OS AI</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={S.sectionHeader}>
      <View style={S.sectionAccentBar} />
      <Text style={S.sectionTitle}>{title.toUpperCase()}</Text>
    </View>
  );
}

function PageFooter({ resourceType }: { resourceType: string }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerLeft}>Neuron OS · {resourceType}</Text>
      <Text
        style={S.footerRight}
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

// ── Cover Page ────────────────────────────────────────────────────────────────

function CoverPage({
  resourceType,
  docTitle,
  subjectName,
}: {
  resourceType: string;
  docTitle: string;
  subjectName: string;
}) {
  const date = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const cleanTitle = docTitle.replace(/\.[^/.]+$/, '');
  return (
    <Page size="A4" style={S.coverPage}>
      <Text style={S.coverBrand}>NEURON OS</Text>
      <Text style={S.coverTitle}>{resourceType}</Text>
      <View style={S.coverDivider} />
      <Text style={S.coverDocTitle}>{cleanTitle}</Text>
      <Text style={S.coverSubject}>{subjectName}</Text>
      <Text style={S.coverDate}>Generated on {date}</Text>
    </Page>
  );
}

// ── Content Components ─────────────────────────────────────────────────────────

function ObjectiveRow({ index, text }: { index: number; text: string }) {
  return (
    <View style={S.objectiveRow}>
      <Text style={S.objectiveNumber}>{index + 1}.</Text>
      <Text style={S.objectiveText}>{text}</Text>
    </View>
  );
}

function BulletRow({ text }: { text: string }) {
  return (
    <View style={S.bulletRow}>
      <View style={S.bulletDot} />
      <Text style={S.bulletText}>{text}</Text>
    </View>
  );
}

function TakeawayCard({ text, index }: { text: string; index: number }) {
  const bgColor = index % 2 === 0 ? '#eff6ff' : '#ecfdf5';
  const iconColor = index % 2 === 0 ? C.accent : C.success;
  return (
    <View style={[S.takeawayCard, { backgroundColor: bgColor }]}>
      <Text style={[S.takeawayIcon, { color: iconColor }]}>v</Text>
      <Text style={[S.takeawayText, { color: C.text }]}>{text}</Text>
    </View>
  );
}

// ── Structured Summary (when AI returns typed object) ─────────────────────────

function StructuredSummaryContent({ summary }: { summary: StudySummary }) {
  return (
    <View>
      <SectionHeader title="Learning Objectives" />
      {summary.learningObjectives.map((obj, i) => (
        <ObjectiveRow key={`obj-${i}`} index={i} text={obj} />
      ))}

      <SectionHeader title="Overview" />
      <Text style={S.paragraph}>{summary.overview}</Text>

      <SectionHeader title="Key Concepts" />
      {summary.keyConceptsList.map((concept, i) => (
        <BulletRow key={`kc-${i}`} text={concept} />
      ))}

      <SectionHeader title="Key Takeaways" />
      {summary.keyTakeaways.map((takeaway, i) => (
        <TakeawayCard key={`kt-${i}`} text={takeaway} index={i} />
      ))}
    </View>
  );
}

// ── Full Markdown Renderer (when AI returns string) ───────────────────────────
//
// Renders a Markdown string into properly styled @react-pdf/renderer elements.
// Supports: H1-H4 headings, **bold**, *italic*, ***bold-italic**, bullet lists,
// numbered lists, nested indented bullets, blockquotes, horizontal rules,
// and plain paragraphs. No raw Markdown characters appear in the PDF output.

// InlineText: renders a line of text with **bold** / *italic* / ***both*** support
function InlineText({ raw, baseStyle }: { raw: string; baseStyle: any }): React.ReactElement {
  const spans = parseInlineSpans(raw);

  // No inline markers found — render as plain text
  if (spans.length === 0) {
    return <Text style={baseStyle}>{raw}</Text>;
  }

  // Single plain span — no nesting needed
  if (spans.length === 1 && !spans[0].bold && !spans[0].italic) {
    return <Text style={baseStyle}>{spans[0].text}</Text>;
  }

  // Mixed spans — wrap in a parent Text and nest styled child Text nodes
  return (
    <Text style={baseStyle}>
      {spans.map((span, i) => {
        if (!span.bold && !span.italic) {
          return <Text key={i}>{span.text}</Text>;
        }
        const spanStyle: any = span.bold && span.italic
          ? S.inlineBoldItalic
          : span.bold
            ? S.inlineBold
            : S.inlineItalic;
        return (
          <Text key={i} style={spanStyle}>
            {span.text}
          </Text>
        );
      })}
    </Text>
  );
}

// MarkdownRenderer: converts a full Markdown string to PDF elements
function MarkdownRenderer({ markdown }: { markdown: string }): React.ReactElement {
  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];
  let keyIdx = 0;
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const joined = paragraphLines.join(' ').replace(/\s+/g, ' ').trim();
    paragraphLines = [];
    if (!joined) return;
    elements.push(
      <InlineText key={`p-${keyIdx++}`} raw={joined} baseStyle={S.paragraph} />
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Blank line: flush paragraph buffer ──────────────────────────────────
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    // ── Horizontal rule ──────────────────────────────────────────────────────
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushParagraph();
      elements.push(<View key={`hr-${keyIdx++}`} style={S.hrule} />);
      continue;
    }

    // ── Headings (H1–H4) ────────────────────────────────────────────────────
    const heading = detectHeading(line);
    if (heading) {
      flushParagraph();
      const cleanText = stripEmoji(heading.text);
      const headingStyle = heading.level === 1 ? S.h1
        : heading.level === 2 ? S.h2
        : heading.level === 3 ? S.h3
        : S.h4;
      elements.push(
        <InlineText key={`h-${keyIdx++}`} raw={cleanText} baseStyle={headingStyle} />
      );
      continue;
    }

    // ── Blockquote ───────────────────────────────────────────────────────────
    const bqMatch = trimmed.match(/^>\s*(.*)/);
    if (bqMatch) {
      flushParagraph();
      elements.push(
        <View key={`bq-${keyIdx++}`} style={S.blockquote}>
          <InlineText raw={bqMatch[1]} baseStyle={S.blockquoteText} />
        </View>
      );
      continue;
    }

    // ── Nested bullet (indented with spaces + - or *) ────────────────────────
    const nestedBulletMatch = line.match(/^(\s{2,})[-*•]\s+(.*)$/);
    if (nestedBulletMatch) {
      flushParagraph();
      elements.push(
        <View key={`nb-${keyIdx++}`} style={S.nestedBulletRow}>
          <View style={S.nestedBulletDot} />
          <InlineText raw={nestedBulletMatch[2]} baseStyle={S.bulletText} />
        </View>
      );
      continue;
    }

    // ── Top-level bullet list ────────────────────────────────────────────────
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      elements.push(
        <View key={`bl-${keyIdx++}`} style={S.bulletRow}>
          <View style={S.bulletDot} />
          <InlineText raw={bulletMatch[1]} baseStyle={S.bulletText} />
        </View>
      );
      continue;
    }

    // ── Numbered list ────────────────────────────────────────────────────────
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      flushParagraph();
      elements.push(
        <View key={`nl-${keyIdx++}`} style={S.numberRow}>
          <Text style={S.numberLabel}>{numberedMatch[1]}.</Text>
          <InlineText raw={numberedMatch[2]} baseStyle={S.bulletText} />
        </View>
      );
      continue;
    }

    // ── Plain paragraph text ─────────────────────────────────────────────────
    paragraphLines.push(trimmed);
  }

  // Flush any remaining paragraph
  flushParagraph();

  return <View>{elements}</View>;
}

// ── Main Document ─────────────────────────────────────────────────────────────

function SummaryDocument({
  summary,
  docTitle,
  subjectName,
  readingMinutes,
  wordCount,
}: {
  summary: StudySummary | string;
  docTitle: string;
  subjectName: string;
  readingMinutes: number;
  wordCount: number;
}) {
  const resourceType = 'AI Generated Summary';
  const isStructured = typeof summary !== 'string';

  return (
    <Document
      title={`${truncate(docTitle.replace(/\.[^/.]+$/, ''), 80)} – ${resourceType}`}
      author="Neuron OS AI"
      creator="Neuron OS Study Pack Generator"
      subject={subjectName}
    >
      <CoverPage resourceType={resourceType} docTitle={docTitle} subjectName={subjectName} />

      <Page size="A4" style={S.page}>
        <PageHeader resourceType={resourceType} docTitle={docTitle} subjectName={subjectName} />
        <InfoBar readingMinutes={readingMinutes} wordCount={wordCount} />
        <View style={S.content}>
          {isStructured ? (
            <StructuredSummaryContent summary={summary as StudySummary} />
          ) : (
            <MarkdownRenderer markdown={summary as string} />
          )}
        </View>
        <PageFooter resourceType={resourceType} />
      </Page>
    </Document>
  );
}

export interface KeyPointsData {
  lectureTitle?: string;
  keyPoints?: string[];
  importantFacts?: string[];
  quickRevisionTips?: string[];
}

function KeyPointsInfoBar({
  pointsCount,
  factsCount,
  tipsCount,
}: {
  pointsCount: number;
  factsCount: number;
  tipsCount: number;
}) {
  const date = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  return (
    <View style={S.infoBar} fixed>
      <Text style={S.infoItem}>{date}</Text>
      <Text style={S.infoItem}>{pointsCount} Key Points</Text>
      {factsCount > 0 ? <Text style={S.infoItem}>{factsCount} Facts</Text> : null}
      {tipsCount > 0 ? <Text style={S.infoItem}>{tipsCount} Revision Tips</Text> : null}
      <Text style={S.infoItem}>Generated by Neuron OS AI</Text>
    </View>
  );
}

function KeyPointsDocument({
  data,
  docTitle,
  subjectName,
}: {
  data: KeyPointsData;
  docTitle: string;
  subjectName: string;
}) {
  const resourceType = 'AI Generated Key Points';
  const displayTitle = data.lectureTitle || docTitle.replace(/\.[^/.]+$/, '');
  const keyPoints = Array.isArray(data.keyPoints) ? data.keyPoints : [];
  const importantFacts = Array.isArray(data.importantFacts) ? data.importantFacts : [];
  const quickRevisionTips = Array.isArray(data.quickRevisionTips) ? data.quickRevisionTips : [];

  return (
    <Document
      title={`${truncate(docTitle.replace(/\.[^/.]+$/, ''), 80)} – ${resourceType}`}
      author="Neuron OS AI"
      creator="Neuron OS Key Points Generator"
      subject={subjectName}
    >
      <CoverPage resourceType={resourceType} docTitle={displayTitle} subjectName={subjectName} />

      <Page size="A4" style={S.page}>
        <PageHeader resourceType={resourceType} docTitle={displayTitle} subjectName={subjectName} />
        <KeyPointsInfoBar
          pointsCount={keyPoints.length}
          factsCount={importantFacts.length}
          tipsCount={quickRevisionTips.length}
        />
        <View style={S.content}>
          {/* Section 1: Key Points */}
          {keyPoints.length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader title="Core Key Points" />
              {keyPoints.map((pt, i) => (
                <View key={`kp-${i}`} style={S.numberRow}>
                  <Text style={S.numberLabel}>{i + 1}.</Text>
                  <InlineText raw={pt} baseStyle={S.bulletText} />
                </View>
              ))}
            </View>
          )}

          {/* Section 2: Important Facts */}
          {importantFacts.length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader title="Important Facts & Concepts" />
              {importantFacts.map((fact, i) => {
                const isEven = i % 2 === 0;
                const cardBg = isEven ? '#f0fdf4' : '#eff6ff';
                const cardBorder = isEven ? C.success : C.accent;
                return (
                  <View
                    key={`fact-${i}`}
                    style={[
                      S.calloutCard,
                      { backgroundColor: cardBg, borderLeftColor: cardBorder, marginBottom: 6 },
                    ]}
                  >
                    <InlineText raw={fact} baseStyle={S.calloutText} />
                  </View>
                );
              })}
            </View>
          )}

          {/* Section 3: Quick Revision Tips */}
          {quickRevisionTips.length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader title="Quick Revision Checklist" />
              {quickRevisionTips.map((tip, i) => (
                <View key={`tip-${i}`} style={S.bulletRow}>
                  <Text style={[S.takeawayIcon, { color: C.accent, marginRight: 8 }]}>[ ]</Text>
                  <InlineText raw={tip} baseStyle={S.bulletText} />
                </View>
              ))}
            </View>
          )}
        </View>
        <PageFooter resourceType={resourceType} />
      </Page>
    </Document>
  );
}

// ── Public API ────────────────────────────────────────────────────────────────
// Signatures are identical to the old PDFKit version — scheduler requires no changes.

export async function generateSummaryPDF(
  summary: StudySummary | string,
  docTitle: string,
  subjectName: string,
): Promise<Buffer> {
  let wordCount = 0;
  let readingMinutes = 8;

  if (typeof summary === 'string') {
    wordCount = summary.trim().split(/\s+/).filter(Boolean).length;
    readingMinutes = Math.max(1, Math.ceil(wordCount / 200));
  } else {
    const s = summary as StudySummary;
    const textToCount = [
      s.overview || '',
      ...(s.learningObjectives || []),
      ...(s.keyConceptsList || []),
      ...(s.keyTakeaways || []),
    ].join(' ');
    wordCount = textToCount.trim().split(/\s+/).filter(Boolean).length;
    readingMinutes = Math.max(1, Math.ceil(wordCount / 200));
  }

  const uint8 = await renderToBuffer(
    <SummaryDocument
      summary={summary}
      docTitle={docTitle}
      subjectName={subjectName}
      readingMinutes={readingMinutes}
      wordCount={wordCount}
    /> as any
  );

  return Buffer.from(uint8);
}

export async function generateKeyPointsPDF(
  keyPointsData: KeyPointsData | string,
  docTitle: string,
  subjectName: string
): Promise<Buffer> {
  let parsed: KeyPointsData;
  if (typeof keyPointsData === 'string') {
    try {
      parsed = JSON.parse(keyPointsData);
    } catch {
      parsed = {
        lectureTitle: docTitle,
        keyPoints: keyPointsData.split('\n').filter(l => l.trim().length > 0),
        importantFacts: [],
        quickRevisionTips: []
      };
    }
  } else {
    parsed = keyPointsData || {};
  }

  const uint8 = await renderToBuffer(
    <KeyPointsDocument
      data={parsed}
      docTitle={docTitle}
      subjectName={subjectName}
    /> as any
  );

  return Buffer.from(uint8);
}

// ── Stub exports for pdf-generator-service.ts compatibility ──────────────────
// Not called by the active pipeline. Return empty buffers until these are migrated.

export async function generateKeyConceptsPDF(_c: unknown, _t: string, _s: string): Promise<Buffer> {
  return Buffer.alloc(0);
}
export async function generateDefinitionsPDF(_c: unknown, _t: string, _s: string): Promise<Buffer> {
  return Buffer.alloc(0);
}
export async function generateFlashcardsPDF(_c: unknown, _t: string, _s: string): Promise<Buffer> {
  return Buffer.alloc(0);
}
export async function generateMCQsPDF(_c: unknown, _t: string, _s: string): Promise<Buffer> {
  return Buffer.alloc(0);
}
export async function generatePracticeQuestionsPDF(_c: unknown, _t: string, _s: string): Promise<Buffer> {
  return Buffer.alloc(0);
}
export async function generateStudyGuidePDF(_c: unknown, _t: string, _s: string): Promise<Buffer> {
  return Buffer.alloc(0);
}
