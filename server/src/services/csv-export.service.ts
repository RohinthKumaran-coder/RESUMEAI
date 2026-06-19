import type { AnalysisResponse } from '../types/index.js';

/**
 * Generate a CSV string from analysis data.
 */
export function generateCSVReport(analysis: AnalysisResponse): string {
  const rows: string[][] = [];

  // Header
  rows.push(['ResumeIQ — Skills Analysis Report']);
  rows.push([]);
  rows.push(['Candidate', analysis.candidateName || 'N/A']);
  rows.push(['Target Role', analysis.targetRole]);
  rows.push(['Readiness Score', `${Math.round(analysis.readinessScore || 0)}%`]);
  rows.push(['Report Date', new Date().toISOString().split('T')[0]]);
  rows.push([]);

  // Skills table
  rows.push(['Skill', 'Status', 'Priority']);

  for (const skill of analysis.matchedSkills) {
    rows.push([skill, 'Matched', 'N/A']);
  }
  for (const skill of analysis.missingSkills) {
    rows.push([skill, 'Missing', 'High']);
  }

  rows.push([]);
  rows.push(['Learning Resources']);
  rows.push(['Skill', 'Resource', 'Platform', 'Type', 'URL', 'Hours']);

  for (const res of (analysis.learningResources || [])) {
    rows.push([res.skill, res.name, res.platform, res.type, res.url, String(res.estimatedHours)]);
  }

  return rows.map((row) => row.map(escapeCSV).join(',')).join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
