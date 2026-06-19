import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/store';
import type { AnalysisRecord } from '@/lib/store';
import { ROLE_SKILLS, SUPPORTED_ROLES } from '@/lib/role-skills';
import type { SupportedRole } from '@/lib/role-skills';
import {
  parseResumeFile, extractResumeData, analyzeSkillGapForTarget,
  generateCandidateSummary, generateLearningResources,
  generateInterviewQuestions, generatePreparationRoadmap,
  generatePDFReport, generateCSVReport,
} from '@/lib/services';
import type { AnalysisResponse, AnalysisTarget } from '@/lib/services';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = () => process.env.JWT_SECRET || 'resumeiq_fallback_secret';
const EXPIRES = () => process.env.JWT_EXPIRES_IN || '7d';

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'jpg', 'jpeg', 'png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function signToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, SECRET(), {
    expiresIn: EXPIRES() as jwt.SignOptions['expiresIn'],
  });
}

function verifyAuth(req: NextRequest): { userId: string; email: string } | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.split(' ')[1], SECRET()) as { userId: string; email: string };
  } catch { return null; }
}

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
const err = (message: string, status: number) =>
  json({ success: false, message, statusCode: status }, status);

function shapeAnalysis(r: AnalysisRecord): AnalysisResponse {
  return {
    id: r.id, userId: r.userId, targetRole: r.targetRole, resumeFileName: r.resumeFileName,
    candidateName: r.candidateName, candidateEmail: r.candidateEmail, candidatePhone: r.candidatePhone,
    education: (r.education as AnalysisResponse['education']) || [],
    experience: (r.experience as AnalysisResponse['experience']) || [],
    projects: (r.projects as AnalysisResponse['projects']) || [],
    certifications: (r.certifications as AnalysisResponse['certifications']) || [],
    extractedSkills: r.extractedSkills || [],
    matchedSkills: r.matchedSkills || [],
    missingSkills: r.missingSkills || [],
    readinessScore: r.readinessScore || 0,
    candidateSummary: r.candidateSummary,
    learningResources: (r.learningResources as AnalysisResponse['learningResources']) || [],
    interviewQuestions: (r.interviewQuestions as AnalysisResponse['interviewQuestions']) || null,
    preparationRoadmap: (r.preparationRoadmap as AnalysisResponse['preparationRoadmap']) || null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function handleRegister(req: NextRequest) {
  const { email, password, name } = await req.json();
  if (!email || !password) return err('Email and password are required.', 400);
  if (password.length < 6) return err('Password must be at least 6 characters.', 400);
  if (db.user.findByEmail(email)) return err('An account with this email already exists.', 409);
  const hashed = await bcrypt.hash(password, 10);
  const user = db.user.create({ email, password: hashed, name: name || null });
  const token = signToken(user.id, user.email);
  return json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, createdAt: user.createdAt } }, 201);
}

async function handleLogin(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) return err('Email and password are required.', 400);
  const user = db.user.findByEmail(email);
  if (!user) return err('Invalid email or password.', 401);
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return err('Invalid email or password.', 401);
  return json({ success: true, token: signToken(user.id, user.email), user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } });
}

function handleGetMe(req: NextRequest) {
  const auth = verifyAuth(req);
  if (!auth) return err('Not authenticated.', 401);
  const user = db.user.findById(auth.userId);
  if (!user) return err('User not found.', 404);
  return json({ success: true, data: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, createdAt: user.createdAt } });
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

async function handleCreateAnalysis(req: NextRequest) {
  const auth = verifyAuth(req);
  if (!auth) return err('Not authenticated.', 401);

  const formData = await req.formData();
  const file = formData.get('resume') as File | null;

  // Multi-role targeting fields (replaces the old single `targetRole` field)
  const targetRolesRaw = formData.get('targetRoles') as string | null;
  const customRole = (formData.get('customRole') as string | null)?.trim() || undefined;
  const targetCompany = (formData.get('targetCompany') as string | null)?.trim() || undefined;
  const jobDescription = (formData.get('jobDescription') as string | null)?.trim() || undefined;

  let roles: string[] = [];
  if (targetRolesRaw) {
    try {
      const parsed = JSON.parse(targetRolesRaw);
      if (Array.isArray(parsed)) roles = parsed.filter((r): r is string => typeof r === 'string');
    } catch {
      return err('Invalid targetRoles format.', 400);
    }
  }

  if (!file) return err('Please upload a resume file.', 400);
  if (roles.length === 0 && !customRole) return err('Please select a target role.', 400);

  const invalidRole = roles.find((r) => !SUPPORTED_ROLES.includes(r as SupportedRole));
  if (invalidRole) return err(`Unsupported role: ${invalidRole}`, 400);

  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return err('Unsupported file type. Please upload a PDF, DOCX, TXT, JPG, or PNG file.', 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return err('File too large. Max size is 10MB.', 400);
  }

  // Parse file → extract profile → skill gap (all non-Claude except image OCR, run first)
  const buffer = Buffer.from(await file.arrayBuffer());
  let resumeText: string;
  try {
    resumeText = await parseResumeFile(buffer, file.name, file.type);
  } catch (parseErr: any) {
    return err(parseErr.message || 'Could not extract text from this file.', 422);
  }

  const profile = await extractResumeData(resumeText);

  // Build AnalysisTarget and use the async, multi-source skill gap
  // (merges predefined role skills + JD-extracted skills + inferred custom-role skills)
  const target: AnalysisTarget = { roles, customRole, company: targetCompany, jobDescription };
  const skillGap = await analyzeSkillGapForTarget(profile.skills, target);
  const targetRoleLabel = skillGap.targetRoleLabel;

  // All 4 Claude calls run in parallel — saves ~3x time vs sequential
  const [summary, resources, questions, roadmap] = await Promise.allSettled([
    generateCandidateSummary(profile, targetRoleLabel),
    generateLearningResources(skillGap.missingSkills, targetRoleLabel),
    generateInterviewQuestions(profile, targetRoleLabel, skillGap.matchedSkills, skillGap.missingSkills),
    generatePreparationRoadmap(skillGap.missingSkills, skillGap.matchedSkills, targetRoleLabel),
  ]);

  const analysis = db.analysis.create({
    userId: auth.userId, targetRole: targetRoleLabel, resumeFileName: file.name, resumeText,
    candidateName: profile.name,
    candidateEmail: profile.email,
    candidatePhone: profile.phone,
    education: profile.education,
    experience: profile.experience,
    projects: profile.projects,
    certifications: profile.certifications,
    extractedSkills: profile.skills,
    matchedSkills: skillGap.matchedSkills,
    missingSkills: skillGap.missingSkills,
    readinessScore: skillGap.readinessScore,
    candidateSummary: summary.status === 'fulfilled' ? summary.value : null,
    learningResources: resources.status === 'fulfilled' ? resources.value : [],
    interviewQuestions: questions.status === 'fulfilled' ? questions.value : null,
    preparationRoadmap: roadmap.status === 'fulfilled' ? roadmap.value : null,
  });

  return json({ success: true, data: shapeAnalysis(analysis), message: 'Resume analyzed successfully!' }, 201);
}

function handleListAnalyses(req: NextRequest) {
  const auth = verifyAuth(req);
  if (!auth) return err('Not authenticated.', 401);
  return json({ success: true, data: db.analysis.findByUser(auth.userId).map(shapeAnalysis) });
}

function handleGetAnalysis(req: NextRequest, id: string) {
  const auth = verifyAuth(req);
  if (!auth) return err('Not authenticated.', 401);
  const analysis = db.analysis.findById(id);
  if (!analysis) return err('Analysis not found.', 404);
  if (analysis.userId !== auth.userId) return err('Not authorized.', 403);
  return json({ success: true, data: shapeAnalysis(analysis) });
}

function handleDeleteAnalysis(req: NextRequest, id: string) {
  const auth = verifyAuth(req);
  if (!auth) return err('Not authenticated.', 401);
  const analysis = db.analysis.findById(id);
  if (!analysis) return err('Analysis not found.', 404);
  if (analysis.userId !== auth.userId) return err('Not authorized.', 403);
  db.analysis.delete(id);
  return json({ success: true, message: 'Analysis deleted successfully.' });
}

async function handleGenerateQuestions(req: NextRequest, id: string) {
  const auth = verifyAuth(req);
  if (!auth) return err('Not authenticated.', 401);
  const analysis = db.analysis.findById(id);
  if (!analysis) return err('Analysis not found.', 404);
  if (analysis.userId !== auth.userId) return err('Not authorized.', 403);

  const profile = {
    name: analysis.candidateName || '', email: analysis.candidateEmail || '', phone: analysis.candidatePhone || '',
    skills: analysis.extractedSkills || [],
    education: (analysis.education as AnalysisResponse['education']) || [],
    experience: (analysis.experience as AnalysisResponse['experience']) || [],
    projects: (analysis.projects as AnalysisResponse['projects']) || [],
    certifications: (analysis.certifications as AnalysisResponse['certifications']) || [],
  };
  const questions = await generateInterviewQuestions(profile, analysis.targetRole, analysis.matchedSkills, analysis.missingSkills);
  const updated = db.analysis.update(id, { interviewQuestions: questions });
  return json({ success: true, data: shapeAnalysis(updated!) });
}

async function handleGenerateRoadmap(req: NextRequest, id: string) {
  const auth = verifyAuth(req);
  if (!auth) return err('Not authenticated.', 401);
  const analysis = db.analysis.findById(id);
  if (!analysis) return err('Analysis not found.', 404);
  if (analysis.userId !== auth.userId) return err('Not authorized.', 403);
  const roadmap = await generatePreparationRoadmap(analysis.missingSkills, analysis.matchedSkills, analysis.targetRole);
  const updated = db.analysis.update(id, { preparationRoadmap: roadmap });
  return json({ success: true, data: shapeAnalysis(updated!) });
}

async function handleExportPDF(req: NextRequest, id: string) {
  const auth = verifyAuth(req);
  if (!auth) return err('Not authenticated.', 401);
  const analysis = db.analysis.findById(id);
  if (!analysis) return err('Analysis not found.', 404);
  if (analysis.userId !== auth.userId) return err('Not authorized.', 403);
  const pdfBuffer = await generatePDFReport(shapeAnalysis(analysis));
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="resumeiq-report-${id.slice(0, 8)}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    },
  });
}

function handleExportCSV(req: NextRequest, id: string) {
  const auth = verifyAuth(req);
  if (!auth) return err('Not authenticated.', 401);
  const analysis = db.analysis.findById(id);
  if (!analysis) return err('Analysis not found.', 404);
  if (analysis.userId !== auth.userId) return err('Not authorized.', 403);
  const csv = generateCSVReport(shapeAnalysis(analysis));
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="resumeiq-skills-${id.slice(0, 8)}.csv"`,
    },
  });
}

function handleGetRoles() {
  const roles = SUPPORTED_ROLES.map((role) => ({
    id: role, name: role,
    description: ROLE_SKILLS[role as SupportedRole].description,
    requiredSkillsCount: ROLE_SKILLS[role as SupportedRole].requiredSkills.length,
    skills: ROLE_SKILLS[role as SupportedRole].requiredSkills,
  }));
  return json({ success: true, data: roles });
}

// ─── Router ───────────────────────────────────────────────────────────────────

function getPath(params: { route?: string[] }): string {
  return '/' + (params.route?.join('/') || '');
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ route?: string[] }> }) {
  const p = getPath(await params);
  if (p === '/health') return json({ success: true, message: 'ResumeIQ API is running', version: '2.0.0' });
  if (p === '/auth/me') return handleGetMe(req);
  if (p === '/roles') return handleGetRoles();
  if (p === '/analysis') return handleListAnalyses(req);

  const analysisMatch = p.match(/^\/analysis\/([^/]+)$/);
  if (analysisMatch) return handleGetAnalysis(req, analysisMatch[1]);

  const pdfMatch = p.match(/^\/analysis\/([^/]+)\/export\/pdf$/);
  if (pdfMatch) return handleExportPDF(req, pdfMatch[1]);

  const csvMatch = p.match(/^\/analysis\/([^/]+)\/export\/csv$/);
  if (csvMatch) return handleExportCSV(req, csvMatch[1]);

  return err('Route not found.', 404);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ route?: string[] }> }) {
  const p = getPath(await params);
  if (p === '/auth/register') return handleRegister(req);
  if (p === '/auth/login') return handleLogin(req);
  if (p === '/analysis') return handleCreateAnalysis(req);

  const questionsMatch = p.match(/^\/analysis\/([^/]+)\/generate-questions$/);
  if (questionsMatch) return handleGenerateQuestions(req, questionsMatch[1]);

  const roadmapMatch = p.match(/^\/analysis\/([^/]+)\/generate-roadmap$/);
  if (roadmapMatch) return handleGenerateRoadmap(req, roadmapMatch[1]);

  return err('Route not found.', 404);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ route?: string[] }> }) {
  const p = getPath(await params);
  const match = p.match(/^\/analysis\/([^/]+)$/);
  if (match) return handleDeleteAnalysis(req, match[1]);
  return err('Route not found.', 404);
}