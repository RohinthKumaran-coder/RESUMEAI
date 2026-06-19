import PDFDocument from 'pdfkit';
import type { AnalysisResponse } from '../types/index.js';

/**
 * Generate a professional PDF report for an analysis.
 * Returns a Buffer containing the PDF.
 */
export function generatePDFReport(analysis: AnalysisResponse): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Colors ──────────────────────────────────────────────────────────────
      const PRIMARY = '#2563EB';
      const SECONDARY = '#14B8A6';
      const ACCENT = '#F59E0B';
      const DARK = '#1E293B';
      const MUTED = '#64748B';
      const SUCCESS = '#10B981';
      const DANGER = '#EF4444';

      // ── Header ───────────────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 80).fill(PRIMARY);
      doc.fill('#FFFFFF').fontSize(28).font('Helvetica-Bold').text('ResumeIQ', 50, 20);
      doc.fontSize(11).font('Helvetica').text('AI-Powered Career Preparation Report', 50, 52);

      doc.rect(0, 80, doc.page.width, 4).fill(ACCENT);

      // Date
      doc.fill(MUTED).fontSize(9).text(
        `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        doc.page.width - 200,
        90,
        { width: 150, align: 'right' }
      );

      doc.moveDown(2);

      // ── Candidate Profile ────────────────────────────────────────────────────
      sectionHeader(doc, '01  CANDIDATE PROFILE', PRIMARY);

      const info = [
        ['Name', analysis.candidateName || 'N/A'],
        ['Email', analysis.candidateEmail || 'N/A'],
        ['Phone', analysis.candidatePhone || 'N/A'],
        ['Target Role', analysis.targetRole],
      ];

      for (const [label, value] of info) {
        doc.fill(MUTED).fontSize(9).font('Helvetica-Bold').text(`${label}:`, 50, doc.y, { continued: true, width: 80 });
        doc.fill(DARK).font('Helvetica').text(` ${value}`);
      }

      if (analysis.candidateSummary) {
        doc.moveDown(0.5);
        doc.fill(MUTED).fontSize(9).font('Helvetica-Bold').text('Summary:');
        doc.fill(DARK).font('Helvetica').fontSize(10).text(analysis.candidateSummary, { width: 495 });
      }

      // Education
      if (analysis.education?.length > 0) {
        doc.moveDown(0.5);
        doc.fill(MUTED).fontSize(9).font('Helvetica-Bold').text('Education:');
        for (const edu of analysis.education) {
          doc.fill(DARK).font('Helvetica').fontSize(10)
            .text(`• ${edu.degree} in ${edu.field} — ${edu.institution} (${edu.startYear}–${edu.endYear})`);
        }
      }

      // Experience
      if (analysis.experience?.length > 0) {
        doc.moveDown(0.5);
        doc.fill(MUTED).fontSize(9).font('Helvetica-Bold').text('Experience:');
        for (const exp of analysis.experience) {
          doc.fill(DARK).font('Helvetica').fontSize(10)
            .text(`• ${exp.role} at ${exp.company} (${exp.startDate}–${exp.endDate})`);
        }
      }

      doc.moveDown(1);

      // ── Readiness Score ──────────────────────────────────────────────────────
      sectionHeader(doc, '02  READINESS SCORE', SECONDARY);

      const score = Math.round(analysis.readinessScore || 0);
      const scoreColor = score >= 70 ? SUCCESS : score >= 40 ? ACCENT : DANGER;
      const scoreLabel = score >= 70 ? 'STRONG' : score >= 40 ? 'MODERATE' : 'NEEDS WORK';

      doc.fill(scoreColor).fontSize(48).font('Helvetica-Bold').text(`${score}%`, 50, doc.y, { width: 100 });
      doc.fill(scoreColor).fontSize(14).font('Helvetica-Bold').text(scoreLabel, 150, doc.y - 38);
      doc.fill(MUTED).fontSize(10).font('Helvetica').text(
        `${analysis.matchedSkills.length} of ${analysis.matchedSkills.length + analysis.missingSkills.length} required skills matched`,
        150,
        doc.y - 14
      );

      doc.moveDown(2);

      // ── Skill Analysis ───────────────────────────────────────────────────────
      sectionHeader(doc, '03  SKILL ANALYSIS', PRIMARY);

      // Matched skills
      doc.fill(SUCCESS).fontSize(10).font('Helvetica-Bold').text('✓ Matched Skills:');
      doc.fill(DARK).font('Helvetica').fontSize(9)
        .text(analysis.matchedSkills.join('  •  ') || 'None', { width: 495 });

      doc.moveDown(0.5);

      // Missing skills
      doc.fill(DANGER).fontSize(10).font('Helvetica-Bold').text('✗ Missing Skills (Priority Learning):');
      doc.fill(DARK).font('Helvetica').fontSize(9)
        .text(analysis.missingSkills.join('  •  ') || 'None', { width: 495 });

      doc.moveDown(1);

      // ── Learning Recommendations ─────────────────────────────────────────────
      if (analysis.learningResources?.length > 0) {
        checkPageBreak(doc, 150);
        sectionHeader(doc, '04  LEARNING RECOMMENDATIONS', SECONDARY);

        const grouped = new Map<string, typeof analysis.learningResources>();
        for (const res of analysis.learningResources.slice(0, 12)) {
          if (!grouped.has(res.skill)) grouped.set(res.skill, []);
          grouped.get(res.skill)!.push(res);
        }

        for (const [skill, resources] of grouped) {
          checkPageBreak(doc, 80);
          doc.fill(PRIMARY).fontSize(10).font('Helvetica-Bold').text(`${skill}:`);
          for (const res of resources) {
            const typeLabel = res.type === 'free' ? '[FREE]' : res.type === 'paid' ? '[PAID]' : res.type === 'certification' ? '[CERT]' : '[PRACTICE]';
            doc.fill(DARK).font('Helvetica').fontSize(9)
              .text(`  ${typeLabel} ${res.name} — ${res.platform}`, { width: 450 });
            doc.fill(MUTED).fontSize(8).text(`  ${res.url}`, { width: 450 });
          }
          doc.moveDown(0.3);
        }
      }

      // ── Interview Questions ──────────────────────────────────────────────────
      if (analysis.interviewQuestions) {
        const iq = analysis.interviewQuestions;
        const categories: Array<{ label: string; color: string; items: typeof iq.technical }> = [
          { label: 'TECHNICAL QUESTIONS', color: PRIMARY, items: iq.technical },
          { label: 'PROJECT QUESTIONS', color: SECONDARY, items: iq.project },
          { label: 'SCENARIO QUESTIONS', color: ACCENT, items: iq.scenario },
          { label: 'HR / BEHAVIORAL QUESTIONS', color: MUTED, items: iq.hr },
        ];

        for (const cat of categories) {
          checkPageBreak(doc, 120);
          sectionHeader(doc, `05  ${cat.label}`, cat.color);
          cat.items.forEach((q, i) => {
            checkPageBreak(doc, 50);
            doc.fill(DARK).fontSize(9).font('Helvetica-Bold').text(`Q${i + 1}. ${q.question}`, { width: 495 });
            doc.fill(MUTED).font('Helvetica').fontSize(8).text(`Hint: ${q.hint}`, { width: 480 });
            doc.moveDown(0.3);
          });
        }
      }

      // ── Footer ───────────────────────────────────────────────────────────────
      const pageCount = (doc as unknown as { _pageBuffer: unknown[] })._pageBuffer?.length || 1;
      doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill(DARK);
      doc.fill('#FFFFFF').fontSize(8).font('Helvetica')
        .text(`ResumeIQ — AI Career Preparation | Page 1 of ${pageCount}`, 50, doc.page.height - 25, {
          width: doc.page.width - 100,
          align: 'center',
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function sectionHeader(doc: PDFKit.PDFDocument, title: string, color: string): void {
  doc.rect(50, doc.y, 495, 24).fill(color);
  doc.fill('#FFFFFF').fontSize(11).font('Helvetica-Bold').text(title, 58, doc.y - 18, { width: 480 });
  doc.moveDown(0.8);
}

function checkPageBreak(doc: PDFKit.PDFDocument, neededHeight: number): void {
  if (doc.y + neededHeight > doc.page.height - 60) {
    doc.addPage();
  }
}
