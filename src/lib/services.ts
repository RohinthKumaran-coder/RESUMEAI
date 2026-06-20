import OpenAI from 'openai';
import { z } from 'zod';
// pdfkit standalone build embeds all font data in JS — no disk reads at runtime.
// This is required for Vercel/Next.js where bundling strips node_modules assets.
// @ts-ignore — standalone build types are declared in src/types/pdfkit-standalone.d.ts
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import mammoth from 'mammoth';
import { ROLE_SKILLS, SKILL_ALIASES, SUPPORTED_ROLES } from './role-skills';
import type { SupportedRole } from './role-skills';

// ─── Config ───────────────────────────────────────────────────────────────────

const GROQ_TEXT_MODEL = 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

// ─── Groq Key Pool + Failover ─────────────────────────────────────────────────
// 3 keys tried in order. Skips to next key on 429/401/403. Other errors abort.
// If all keys fail, throws GroqAllKeysExhaustedError — every caller has a fallback.

const GROQ_KEYS = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
].filter((k): k is string => typeof k === 'string' && k.trim().length > 0);

if (GROQ_KEYS.length === 0) {
  console.warn('[groq] No GROQ_API_KEY_1/2/3 configured — all AI calls will use local fallback.');
}

const _groqClients = new Map<string, OpenAI>();
function getGroqClient(key: string): OpenAI {
  let c = _groqClients.get(key);
  if (!c) {
    c = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' });
    _groqClients.set(key, c);
  }
  return c;
}

function isRateLimitError(err: unknown): boolean {
  const s = (err as any)?.status ?? (err as any)?.response?.status ?? (err as any)?.statusCode;
  return s === 429 || s === 401 || s === 403;
}

export class GroqAllKeysExhaustedError extends Error {
  constructor(public cause: unknown) {
    super('All Groq API keys are rate-limited or exhausted.');
    this.name = 'GroqAllKeysExhaustedError';
  }
}

async function withGroqFailover<T>(makeRequest: (client: OpenAI) => Promise<T>): Promise<T> {
  if (GROQ_KEYS.length === 0) throw new GroqAllKeysExhaustedError(new Error('No Groq keys configured'));
  let lastError: unknown = null;
  for (let i = 0; i < GROQ_KEYS.length; i++) {
    try {
      return await makeRequest(getGroqClient(GROQ_KEYS[i]));
    } catch (err) {
      lastError = err;
      if (isRateLimitError(err)) {
        console.warn(`[groq] key #${i + 1} exhausted/invalid, trying next key...`);
        continue;
      }
      throw err;
    }
  }
  throw new GroqAllKeysExhaustedError(lastError);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Education { institution: string; degree: string; field: string; startYear: string; endYear: string; gpa?: string; }
export interface Experience { company: string; role: string; startDate: string; endDate: string; description: string; technologies: string[]; }
export interface Project { name: string; description: string; technologies: string[]; url?: string; }
export interface Certification { name: string; issuer: string; year: string; }
export interface CandidateProfile { name: string; email: string; phone: string; skills: string[]; education: Education[]; experience: Experience[]; projects: Project[]; certifications: Certification[]; }
export interface InterviewQuestion { question: string; category: 'technical' | 'project' | 'scenario' | 'hr'; difficulty: 'Easy' | 'Medium' | 'Hard'; hint: string; }
export interface InterviewQuestions { technical: InterviewQuestion[]; project: InterviewQuestion[]; scenario: InterviewQuestion[]; hr: InterviewQuestion[]; }
export interface LearningResource { skill: string; name: string; url: string; platform: string; type: 'free' | 'paid' | 'certification' | 'practice'; description: string; estimatedHours: number; isCertification: boolean; }
export interface DailyTask { day: number; task: string; resource?: string; }
export interface WeekPlan { week: number; title: string; focus: string; tasks: DailyTask[]; skills: string[]; }
export interface PreparationRoadmap { totalWeeks: number; targetRole: string; weeks: WeekPlan[]; tips: string[]; }
export interface SkillGapResult { matchedSkills: string[]; missingSkills: string[]; recommendedSkills: string[]; readinessScore: number; totalRequired: number; }
export interface AnalysisResponse {
  id: string; userId: string; targetRole: string; resumeFileName: string;
  candidateName: string | null; candidateEmail: string | null; candidatePhone: string | null;
  education: Education[]; experience: Experience[]; projects: Project[]; certifications: Certification[];
  extractedSkills: string[]; matchedSkills: string[]; missingSkills: string[];
  readinessScore: number; candidateSummary: string | null;
  learningResources: LearningResource[]; interviewQuestions: InterviewQuestions | null;
  preparationRoadmap: PreparationRoadmap | null; createdAt: string; updatedAt: string;
}

export interface AnalysisTarget {
  roles: string[];
  customRole?: string;
  company?: string;
  jobDescription?: string;
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const flexStr = z.union([z.string(), z.number(), z.null()]).transform((v) => (v === null ? '' : String(v)));

const CandidateProfileSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  skills: z.array(z.string()),
  education: z.array(z.object({ institution: z.string(), degree: z.string(), field: z.string(), startYear: flexStr, endYear: flexStr, gpa: flexStr.optional() })),
  experience: z.array(z.object({ company: z.string(), role: z.string(), startDate: flexStr, endDate: flexStr, description: z.string(), technologies: z.array(z.string()) })),
  projects: z.array(z.object({ name: z.string(), description: z.string(), technologies: z.array(z.string()), url: z.string().optional() })),
  certifications: z.array(z.object({ name: z.string(), issuer: z.string(), year: flexStr })),
});

const InterviewQuestionSchema = z.object({ question: z.string(), category: z.enum(['technical', 'project', 'scenario', 'hr']), difficulty: z.enum(['Easy', 'Medium', 'Hard']), hint: z.string() });
const InterviewQuestionsSchema = z.object({ technical: z.array(InterviewQuestionSchema), project: z.array(InterviewQuestionSchema), scenario: z.array(InterviewQuestionSchema), hr: z.array(InterviewQuestionSchema) });
const LearningResourceSchema = z.object({ skill: z.string(), name: z.string(), url: z.string(), platform: z.string(), type: z.enum(['free', 'paid', 'certification', 'practice']), description: z.string(), estimatedHours: z.number(), isCertification: z.boolean() });
const PreparationRoadmapSchema = z.object({
  totalWeeks: z.number(), targetRole: z.string(),
  weeks: z.array(z.object({ week: z.number(), title: z.string(), focus: z.string(), tasks: z.array(z.object({ day: z.number(), task: z.string(), resource: z.string().optional() })), skills: z.array(z.string()) })),
  tips: z.array(z.string()),
});
const SkillListSchema = z.object({ skills: z.array(z.string()) });

// ─── Groq Text Helper ─────────────────────────────────────────────────────────

async function callGroq<T>(systemPrompt: string, userPrompt: string, schema: z.ZodType<T>, maxTokens = 1024): Promise<T> {
  const response = await withGroqFailover((client) =>
    client.chat.completions.create({
      model: GROQ_TEXT_MODEL,
      max_tokens: maxTokens,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })
  );
  const text = response.choices[0]?.message?.content ?? '';
  if (!text) throw new Error('Empty response from Groq');
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return schema.parse(JSON.parse(cleaned));
}

// ─── AI Services ──────────────────────────────────────────────────────────────

export async function extractResumeData(resumeText: string): Promise<CandidateProfile> {
  const truncated = resumeText.substring(0, 3500);
  console.log('[extractResumeData] text length:', resumeText.length, '| truncated to:', truncated.length);
  console.log('[extractResumeData] first 300 chars:\n', truncated.substring(0, 300));

  if (!isReadableText(truncated)) {
    console.error('[extractResumeData] ABORTED — text does not look like readable resume content.');
    throw new Error('The uploaded file did not contain readable resume text. Please try a different file or format.');
  }

  try {
    const result = await callGroq(
      `You are a resume parser. Read the resume and return a single JSON object with these keys:
- name: candidate full name (never empty if found)
- email: email or ""
- phone: phone or ""
- skills: array of ALL skills (technical, tools, frameworks, soft skills)
- education: array of {institution, degree, field, startYear, endYear, gpa?}
- experience: array of {company, role, startDate, endDate, description, technologies[]}
- projects: array of {name, description, technologies[], url?}
- certifications: array of {name, issuer, year}
Return ONLY the JSON object. No markdown, no explanation, no code fences. Use "" for missing strings, [] for missing arrays.`,
      `Resume:\n${truncated}`,
      CandidateProfileSchema,
      2048,
    );
    console.log('[extractResumeData] success — name:', result.name, '| skills:', result.skills.length);
    return result;
  } catch (err) {
    console.error('[extractResumeData] FAILED:', err);
    return { name: 'Unknown', email: '', phone: '', skills: [], education: [], experience: [], projects: [], certifications: [] };
  }
}

export async function generateCandidateSummary(profile: CandidateProfile, targetRole: string): Promise<string> {
  try {
    const result = await callGroq(
      `Write a 2-sentence professional summary. Return ONLY JSON: {"summary":"..."}`,
      `Name:${profile.name} Role:${targetRole} Skills:${profile.skills.slice(0, 8).join(', ')}`,
      z.object({ summary: z.string() }),
      256,
    );
    return typeof result.summary === 'string' ? result.summary : String(result.summary);
  } catch (err) {
    console.error('[generateCandidateSummary] FAILED:', err);
    return `${profile.name} is seeking a ${targetRole} role.`;
  }
}

export async function generateInterviewQuestions(
  profile: CandidateProfile,
  targetRole: string,
  matchedSkills: string[],
  missingSkills: string[],
): Promise<InterviewQuestions> {
  try {
    return await callGroq(
      `Generate exactly 16 interview questions for a ${targetRole} candidate. Return ONLY JSON:
{"technical":[6 items],"project":[4 items],"scenario":[3 items],"hr":[3 items]}
Each item: {"question":"...","category":"technical|project|scenario|hr","difficulty":"Easy|Medium|Hard","hint":"..."}`,
      `Has:${matchedSkills.slice(0, 5).join(',')} Needs:${missingSkills.slice(0, 3).join(',')}`,
      InterviewQuestionsSchema,
      1024,
    );
  } catch (err) {
    console.error('[generateInterviewQuestions] FAILED:', err);
    return getFallbackQuestions(targetRole);
  }
}

export async function generateLearningResources(missingSkills: string[], targetRole: string): Promise<LearningResource[]> {
  if (missingSkills.length === 0) return [];
  try {
    const result = await callGroq(
      `Generate learning resources for missing skills. Return ONLY JSON:
{"resources":[{"skill":"","name":"","url":"","platform":"","type":"free|paid|certification|practice","description":"","estimatedHours":0,"isCertification":false}]}`,
      `Role:${targetRole} Missing:${missingSkills.slice(0, 4).join(', ')}`,
      z.object({ resources: z.array(LearningResourceSchema) }),
      1024,
    );
    return result.resources;
  } catch (err) {
    console.error('[generateLearningResources] FAILED:', err);
    return [];
  }
}

export async function generatePreparationRoadmap(missingSkills: string[], matchedSkills: string[], targetRole: string): Promise<PreparationRoadmap> {
  try {
    return await callGroq(
      `Create a 3-week preparation roadmap. Return ONLY JSON:
{totalWeeks:3, targetRole:"", weeks:[3 items], tips:[3 strings]}
Each week: {week:number, title:string, focus:string, tasks:[{day:number,task:string,resource?:string}], skills:string[]}`,
      `Role:${targetRole} Missing:${missingSkills.slice(0, 4).join(',')} Has:${matchedSkills.slice(0, 3).join(',')}`,
      PreparationRoadmapSchema,
      1024,
    );
  } catch (err) {
    console.error('[generatePreparationRoadmap] FAILED:', err);
    return { totalWeeks: 3, targetRole, weeks: [], tips: ['Study 2hrs daily', 'Build projects', 'Practice mock interviews'] };
  }
}

function getFallbackQuestions(targetRole: string): InterviewQuestions {
  const mkQ = (q: string, cat: InterviewQuestion['category'], diff: InterviewQuestion['difficulty'], hint: string): InterviewQuestion => ({ question: q, category: cat, difficulty: diff, hint });
  return {
    technical: [
      mkQ(`What are core skills for a ${targetRole}?`, 'technical', 'Easy', 'Key technologies.'),
      mkQ('Explain SQL vs NoSQL.', 'technical', 'Medium', 'Use cases, scalability.'),
      mkQ('How do you debug production issues?', 'technical', 'Hard', 'Systematic approach.'),
      mkQ('How do you ensure code quality?', 'technical', 'Medium', 'Reviews, testing, CI/CD.'),
      mkQ('Explain REST API principles.', 'technical', 'Medium', 'Statelessness, HTTP verbs.'),
      mkQ('How do you handle async operations?', 'technical', 'Medium', 'Promises, async/await.'),
    ],
    project: [
      mkQ('Tell me about your most challenging project.', 'project', 'Hard', 'Problem, approach, solution.'),
      mkQ('Walk me through a project architecture.', 'project', 'Medium', 'Components, data flow.'),
      mkQ('What would you change rebuilding a project?', 'project', 'Medium', 'Lessons learned.'),
      mkQ('How did you handle collaboration?', 'project', 'Easy', 'Git workflow, PRs.'),
    ],
    scenario: [
      mkQ('Critical bug in production. What do you do?', 'scenario', 'Hard', 'Mitigation, root cause.'),
      mkQ('Conflicting deadlines. How do you prioritize?', 'scenario', 'Medium', 'Communication, breakdown.'),
      mkQ('New team with legacy code. Your approach?', 'scenario', 'Medium', 'Explore, ask, document.'),
    ],
    hr: [
      mkQ('Tell me about yourself.', 'hr', 'Easy', 'Background, achievements.'),
      mkQ('Greatest professional achievement?', 'hr', 'Easy', 'Specific example.'),
      mkQ('Why should we hire you?', 'hr', 'Medium', 'Unique value proposition.'),
    ],
  };
}

// ─── Text Quality Check ───────────────────────────────────────────────────────

function isReadableText(text: string): boolean {
  if (text.length < 20) return false;
  const letters = (text.match(/[a-zA-Z]/g) || []).length;
  if (letters / text.length < 0.4) return false;
  return (text.match(/[a-zA-Z]{3,}/g) || []).length >= 10;
}

// ─── PDF Parser ───────────────────────────────────────────────────────────────
// Fallback chain: pdf-parse → pdfreader → raw extraction → Groq vision OCR

export async function parseResumePDF(buffer: Buffer): Promise<string> {
  try {
    const text = await parsePDFWithPdfParse(buffer);
    if (isReadableText(text)) { console.log('[parseResumePDF] pdf-parse success, length:', text.length); return text; }
    console.log('[parseResumePDF] pdf-parse unreadable, trying pdfreader...');
  } catch (e) { console.log('[parseResumePDF] pdf-parse failed:', (e as Error).message); }

  try {
    const text = await parsePDFWithPdfReader(buffer);
    if (isReadableText(text)) { console.log('[parseResumePDF] pdfreader success, length:', text.length); return text; }
    console.log('[parseResumePDF] pdfreader unreadable, trying raw extraction...');
  } catch (e) { console.log('[parseResumePDF] pdfreader failed:', (e as Error).message); }

  try {
    const text = extractRawText(buffer);
    if (isReadableText(text)) { console.log('[parseResumePDF] raw extraction success, length:', text.length); return text; }
    console.log('[parseResumePDF] raw extraction unreadable, trying Groq vision OCR...');
  } catch (e) { console.log('[parseResumePDF] raw extraction failed:', (e as Error).message); }

  try {
    const text = await parsePDFWithGroqVision(buffer);
    if (isReadableText(text)) { console.log('[parseResumePDF] Groq vision OCR success, length:', text.length); return text; }
  } catch (e) { console.log('[parseResumePDF] Groq vision OCR failed:', (e as Error).message); }

  throw new Error(
    'Could not extract readable text from this PDF. ' +
    'It may use custom fonts, be scanned, or be image-only. ' +
    'Please try: (1) re-saving as standard PDF, (2) uploading as DOCX or TXT, or (3) uploading a PNG/JPG screenshot.',
  );
}

async function parsePDFWithPdfParse(buffer: Buffer): Promise<string> {
  const mod = await import('pdf-parse') as any;
  const pdfParse: ((buf: Buffer, opts?: object) => Promise<{ text: string }>) | null =
    typeof mod.default?.default === 'function' ? mod.default.default :
      typeof mod.default === 'function' ? mod.default :
        typeof mod === 'function' ? mod : null;
  if (!pdfParse) throw new Error('pdfParse is not a function');
  const result = await pdfParse(buffer, { max: 0 });
  const text = (result.text || '').replace(/\r\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 20) throw new Error('pdf-parse extracted empty text');
  return text;
}

async function parsePDFWithPdfReader(buffer: Buffer): Promise<string> {
  const { PdfReader } = await import('pdfreader');
  return new Promise((resolve, reject) => {
    const rows: Record<number, string[]> = {};
    new PdfReader().parseBuffer(buffer, (err: any, item: any) => {
      if (err) { reject(err); return; }
      if (!item) {
        const text = Object.keys(rows)
          .sort((a, b) => Number(a) - Number(b))
          .map((y) => rows[Number(y)].join(' '))
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim();
        resolve(text);
        return;
      }
      if (item.text) {
        const y = Math.round((item.y || 0) * 10);
        if (!rows[y]) rows[y] = [];
        rows[y].push(item.text);
      }
    });
  });
}

function extractRawText(buffer: Buffer): string {
  const content = buffer.toString('latin1');
  const matches = content.match(/\(([^\)]{2,})\)/g) || [];
  return matches
    .map(m => m.slice(1, -1))
    .filter(t => /[a-zA-Z]{2,}/.test(t))
    .join(' ')
    .replace(/\\n/g, '\n').replace(/\\t/g, ' ').replace(/\\/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function parsePDFWithGroqVision(buffer: Buffer): Promise<string> {
  let sharpLib: typeof import('sharp').default;
  try {
    sharpLib = (await import('sharp')).default;
  } catch {
    throw new Error('sharp is not installed. Run: npm install sharp');
  }

  let imageBuffer: Buffer;
  try {
    imageBuffer = await sharpLib(buffer, { density: 150 }).png().toBuffer();
    console.log('[parsePDFWithGroqVision] rasterized PDF to PNG, size:', imageBuffer.length);
  } catch (e) {
    console.log('[parsePDFWithGroqVision] PDF rasterization failed:', (e as Error).message, '— trying embedded image...');
    imageBuffer = await extractFirstEmbeddedImage(buffer, sharpLib);
  }

  const base64 = imageBuffer.toString('base64');
  const response = await withGroqFailover((client) =>
    client.chat.completions.create({
      model: GROQ_VISION_MODEL,
      max_tokens: 2048,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
          { type: 'text', text: 'This is a resume. Extract ALL text exactly as it appears — name, contact info, education, work experience, skills, projects, certifications. Preserve structure. Output ONLY the extracted text, no commentary.' },
        ],
      }],
    })
  );

  const text = (response.choices[0]?.message?.content ?? '').trim();
  if (text.length < 20) throw new Error('Groq vision OCR returned empty text');
  console.log('[parsePDFWithGroqVision] OCR success, length:', text.length);
  return text;
}

async function extractFirstEmbeddedImage(buffer: Buffer, sharpLib: typeof import('sharp').default): Promise<Buffer> {
  const bin = buffer.toString('binary');

  const jpegStart = bin.indexOf('\xFF\xD8\xFF');
  if (jpegStart !== -1) {
    const jpegEnd = bin.indexOf('\xFF\xD9', jpegStart);
    if (jpegEnd !== -1) {
      const jpegBytes = Buffer.from(bin.slice(jpegStart, jpegEnd + 2), 'binary');
      console.log('[extractFirstEmbeddedImage] found JPEG, size:', jpegBytes.length);
      return sharpLib(jpegBytes).png().toBuffer();
    }
  }

  const pngSig = '\x89PNG\r\n\x1a\n';
  const pngStart = bin.indexOf(pngSig);
  if (pngStart !== -1) {
    const iend = bin.indexOf('IEND', pngStart);
    if (iend !== -1) {
      const pngBytes = Buffer.from(bin.slice(pngStart, iend + 8), 'binary');
      console.log('[extractFirstEmbeddedImage] found PNG, size:', pngBytes.length);
      return sharpLib(pngBytes).png().toBuffer();
    }
  }

  throw new Error('sharp cannot rasterize this PDF and no embedded images were found. Please upload as PNG or JPG instead.');
}

// ─── DOCX / TXT / Image Parsers ───────────────────────────────────────────────

export type ResumeFileKind = 'pdf' | 'docx' | 'txt' | 'image';

const EXTENSION_MAP: Record<string, ResumeFileKind> = {
  pdf: 'pdf', docx: 'docx', txt: 'txt',
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image',
};
const MIME_MAP: Record<string, ResumeFileKind> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image',
};

export function detectResumeFileKind(filename: string, mimeType?: string): ResumeFileKind | null {
  if (mimeType && MIME_MAP[mimeType]) return MIME_MAP[mimeType];
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  return EXTENSION_MAP[ext] ?? null;
}

export async function parseResumeDocx(buffer: Buffer): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    const text = value.replace(/\r\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length < 20) throw new Error('Could not extract text from this Word document.');
    return text;
  } catch (err: any) {
    throw new Error('Failed to parse DOCX: ' + (err.message || 'unknown error'));
  }
}

export function parseResumeTxt(buffer: Buffer): string {
  let text = buffer.toString('utf-8').replace(/^\uFEFF/, '');
  const replacementCount = (text.match(/\uFFFD/g) || []).length;
  if (replacementCount > text.length * 0.05) text = buffer.toString('latin1');
  text = text.replace(/\r\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < 20) throw new Error('Could not extract text from this file.');
  return text;
}

export async function parseResumeImage(buffer: Buffer, filename: string, mimeType?: string): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const mediaType = (mimeType === 'image/png' || ext === 'png') ? 'image/png'
    : (mimeType === 'image/webp' || ext === 'webp') ? 'image/webp'
      : 'image/jpeg';

  console.log('[parseResumeImage] model:', GROQ_VISION_MODEL, '| size:', buffer.length, 'bytes');

  const response = await withGroqFailover((client) =>
    client.chat.completions.create({
      model: GROQ_VISION_MODEL,
      max_tokens: 2048,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${buffer.toString('base64')}` } },
          { type: 'text', text: 'Extract all readable text from this resume image, preserving structure as plain text. Output ONLY the extracted text — no commentary, no markdown.' },
        ],
      }],
    })
  );

  const text = (response.choices[0]?.message?.content ?? '').trim();
  if (text.length < 20) throw new Error('Could not extract text from this image. Try a clearer photo.');
  console.log('[parseResumeImage] success — extracted length:', text.length);
  return text;
}

export async function parseResumeFile(buffer: Buffer, filename: string, mimeType?: string): Promise<string> {
  const kind = detectResumeFileKind(filename, mimeType);
  console.log('[parseResumeFile] filename:', filename, '| mimeType:', mimeType, '| kind:', kind);
  switch (kind) {
    case 'pdf': return parseResumePDF(buffer);
    case 'docx': return parseResumeDocx(buffer);
    case 'txt': return parseResumeTxt(buffer);
    case 'image': return parseResumeImage(buffer, filename, mimeType);
    default: throw new Error('Unsupported file type. Please upload PDF, DOCX, TXT, JPG, or PNG.');
  }
}

// ─── Skill Gap Analyzer ───────────────────────────────────────────────────────

function normalizeSkill(s: string): string { return s.toLowerCase().trim().replace(/[.\-_]/g, ' '); }

const ALIAS_MAP = (() => {
  const map = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    map.set(normalizeSkill(canonical), canonical);
    for (const alias of aliases) map.set(normalizeSkill(alias), canonical);
  }
  return map;
})();

function resolveSkill(skill: string): string {
  return ALIAS_MAP.get(normalizeSkill(skill)) || skill;
}

export function analyzeSkillGap(extractedSkills: string[], targetRole: string): SkillGapResult {
  const role = targetRole as SupportedRole;
  if (!SUPPORTED_ROLES.includes(role)) throw new Error(`Unsupported role: ${targetRole}`);
  const roleData = ROLE_SKILLS[role];
  const candidateNormalized = extractedSkills.map(resolveSkill).map(normalizeSkill);
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const req of roleData.requiredSkills) {
    const reqNorm = normalizeSkill(req);
    const reqResolved = normalizeSkill(resolveSkill(req));
    const isMatched = candidateNormalized.some((cs) =>
      cs === reqNorm || cs === reqResolved || cs.includes(reqNorm) || reqNorm.includes(cs) || normalizeSkill(resolveSkill(cs)) === reqResolved
    );
    (isMatched ? matchedSkills : missingSkills).push(req);
  }
  const recommendedMissing = roleData.recommendedSkills.filter((rec) => {
    const rn = normalizeSkill(rec);
    return !candidateNormalized.some((cs) => cs === rn || cs.includes(rn));
  });
  const readinessScore = roleData.requiredSkills.length > 0
    ? Math.round((matchedSkills.length / roleData.requiredSkills.length) * 100)
    : 0;
  return { matchedSkills, missingSkills, recommendedSkills: recommendedMissing.slice(0, 5), readinessScore, totalRequired: roleData.requiredSkills.length };
}

// ─── Multi-Role / Custom Role / JD-aware Target ───────────────────────────────

export function buildTargetRoleLabel(target: AnalysisTarget): string {
  const names = [...target.roles];
  if (target.customRole?.trim()) names.push(target.customRole.trim());
  return names.join(' / ') || 'Unspecified Role';
}

export async function extractSkillsFromJobDescription(jobDescription: string): Promise<string[]> {
  if (!jobDescription || jobDescription.trim().length < 30) return [];
  try {
    const result = await callGroq(
      `Extract the required technical and soft skills from this job description. Return ONLY JSON: {"skills":["skill1","skill2",...]}. Be specific (e.g. "React" not "frontend frameworks"). 10-25 skills, deduplicated.`,
      jobDescription.substring(0, 4000),
      SkillListSchema,
      512,
    );
    return result.skills;
  } catch (err) {
    console.error('[extractSkillsFromJobDescription] FAILED:', err);
    return [];
  }
}

export async function inferSkillsForCustomRole(roleName: string): Promise<string[]> {
  try {
    const result = await callGroq(
      `List the most important required skills for the job title "${roleName}". Return ONLY JSON: {"skills":[...]} with 10-15 specific skills.`,
      roleName,
      SkillListSchema,
      256,
    );
    return result.skills;
  } catch (err) {
    console.error('[inferSkillsForCustomRole] FAILED:', err);
    return [];
  }
}

export async function analyzeSkillGapForTarget(
  extractedSkills: string[],
  target: AnalysisTarget,
): Promise<SkillGapResult & { targetRoleLabel: string }> {
  const requiredMap = new Map<string, string>();
  const recommendedMap = new Map<string, string>();

  for (const roleId of target.roles) {
    const role = roleId as SupportedRole;
    if (!SUPPORTED_ROLES.includes(role)) continue;
    const roleData = ROLE_SKILLS[role];
    for (const s of roleData.requiredSkills) requiredMap.set(normalizeSkill(s), s);
    for (const s of roleData.recommendedSkills) recommendedMap.set(normalizeSkill(s), s);
  }

  if (target.jobDescription?.trim()) {
    const jdSkills = await extractSkillsFromJobDescription(target.jobDescription);
    for (const s of jdSkills) requiredMap.set(normalizeSkill(s), s);
  }

  if (target.customRole?.trim() && requiredMap.size === 0) {
    const inferred = await inferSkillsForCustomRole(target.customRole.trim());
    for (const s of inferred) requiredMap.set(normalizeSkill(s), s);
  }

  const requiredSkills = Array.from(requiredMap.values());
  const candidateNormalized = extractedSkills.map(resolveSkill).map(normalizeSkill);

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const req of requiredSkills) {
    const reqNorm = normalizeSkill(req);
    const reqResolved = normalizeSkill(resolveSkill(req));
    const isMatched = candidateNormalized.some((cs) =>
      cs === reqNorm || cs === reqResolved || cs.includes(reqNorm) || reqNorm.includes(cs) || normalizeSkill(resolveSkill(cs)) === reqResolved
    );
    (isMatched ? matchedSkills : missingSkills).push(req);
  }

  const recommendedSkills = Array.from(recommendedMap.values())
    .filter((rec) => {
      const rn = normalizeSkill(rec);
      return !candidateNormalized.some((cs) => cs === rn || cs.includes(rn));
    })
    .slice(0, 5);

  const readinessScore = requiredSkills.length > 0
    ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
    : 0;

  return {
    matchedSkills, missingSkills, recommendedSkills,
    readinessScore, totalRequired: requiredSkills.length,
    targetRoleLabel: buildTargetRoleLabel(target),
  };
}

// ─── PDF Report Generator ─────────────────────────────────────────────────────

export function generatePDFReport(analysis: AnalysisResponse): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PRIMARY = '#2563EB', SECONDARY = '#14B8A6', ACCENT = '#F59E0B',
        DARK = '#1E293B', MUTED = '#64748B', SUCCESS = '#10B981', DANGER = '#EF4444';

      // ── Header ──────────────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 80).fill(PRIMARY);
      doc.fill('#FFFFFF').fontSize(28).font('Helvetica-Bold').text('ResumeIQ', 50, 20);
      doc.fontSize(11).font('Helvetica').text('AI-Powered Career Preparation Report', 50, 52);
      doc.rect(0, 80, doc.page.width, 4).fill(ACCENT);
      doc.fill(MUTED).fontSize(9).text(
        `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        doc.page.width - 200, 90, { width: 150, align: 'right' },
      );
      doc.moveDown(2);

      const sectionHeader = (title: string, color: string) => {
        doc.rect(50, doc.y, 495, 24).fill(color);
        doc.fill('#FFFFFF').fontSize(11).font('Helvetica-Bold').text(title, 58, doc.y - 18, { width: 480 });
        doc.moveDown(0.8);
      };
      const checkPage = (h: number) => { if (doc.y + h > doc.page.height - 60) doc.addPage(); };

      // Safely coerce candidateSummary in case it's still an object in old records
      const summaryText: string | null = (() => {
        const raw = analysis.candidateSummary as unknown;
        if (!raw) return null;
        if (typeof raw === 'string') return raw;
        if (typeof raw === 'object') {
          const obj = raw as Record<string, unknown>;
          for (const key of ['summary', 'text', 'content']) {
            if (typeof obj[key] === 'string') return obj[key] as string;
          }
        }
        return String(raw);
      })();

      // ── Section 01: Candidate Profile ────────────────────────────────────
      sectionHeader('01  CANDIDATE PROFILE', PRIMARY);
      for (const [label, value] of [
        ['Name', analysis.candidateName || 'N/A'],
        ['Email', analysis.candidateEmail || 'N/A'],
        ['Phone', analysis.candidatePhone || 'N/A'],
        ['Target Role', analysis.targetRole],
      ]) {
        doc.fill(MUTED).fontSize(9).font('Helvetica-Bold').text(`${label}:`, 50, doc.y, { continued: true, width: 80 });
        doc.fill(DARK).font('Helvetica').text(` ${value}`);
      }
      if (summaryText) {
        doc.moveDown(0.5);
        doc.fill(MUTED).fontSize(9).font('Helvetica-Bold').text('Summary:');
        doc.fill(DARK).font('Helvetica').fontSize(10).text(summaryText, { width: 495 });
      }
      doc.moveDown(1);

      // ── Section 02: Readiness Score ───────────────────────────────────────
      checkPage(80);
      sectionHeader('02  READINESS SCORE', SECONDARY);
      const score = Math.round(analysis.readinessScore || 0);
      const scoreColor = score >= 70 ? SUCCESS : score >= 40 ? ACCENT : DANGER;
      doc.fill(scoreColor).fontSize(48).font('Helvetica-Bold').text(`${score}%`, 50, doc.y, { width: 100 });
      doc.fill(MUTED).fontSize(10).font('Helvetica').text(
        `${analysis.matchedSkills.length} of ${analysis.matchedSkills.length + analysis.missingSkills.length} required skills matched`,
        160, doc.y - 14,
      );
      doc.moveDown(2);

      // ── Section 03: Skill Analysis ────────────────────────────────────────
      checkPage(80);
      sectionHeader('03  SKILL ANALYSIS', PRIMARY);
      doc.fill(SUCCESS).fontSize(10).font('Helvetica-Bold').text('✓ Matched Skills:');
      doc.fill(DARK).font('Helvetica').fontSize(9).text(analysis.matchedSkills.join('  •  ') || 'None', { width: 495 });
      doc.moveDown(0.5);
      doc.fill(DANGER).fontSize(10).font('Helvetica-Bold').text('✗ Missing Skills:');
      doc.fill(DARK).font('Helvetica').fontSize(9).text(analysis.missingSkills.join('  •  ') || 'None', { width: 495 });
      doc.moveDown(1);

      // ── Section 04: Learning Recommendations ─────────────────────────────
      if (analysis.learningResources?.length > 0) {
        checkPage(60);
        sectionHeader('04  LEARNING RECOMMENDATIONS', SECONDARY);
        for (const res of analysis.learningResources.slice(0, 12)) {
          checkPage(40);
          const typeLabel = res.type === 'free' ? '[FREE]' : res.type === 'paid' ? '[PAID]' : '[CERT]';
          doc.fill(DARK).font('Helvetica').fontSize(9).text(
            `  ${typeLabel} ${res.name} — ${res.platform} (${res.skill})`, { width: 450 },
          );
        }
        doc.moveDown(1);
      }

      // ── Section 05: Education ─────────────────────────────────────────────
      if (analysis.education?.length > 0) {
        checkPage(60);
        sectionHeader('05  EDUCATION', PRIMARY);
        for (const edu of analysis.education) {
          checkPage(40);
          doc.fill(DARK).font('Helvetica-Bold').fontSize(10).text(`${edu.degree} in ${edu.field}`, { width: 495 });
          doc.fill(MUTED).font('Helvetica').fontSize(9).text(`${edu.institution}  |  ${edu.startYear} – ${edu.endYear}${edu.gpa ? `  |  GPA: ${edu.gpa}` : ''}`);
          doc.moveDown(0.5);
        }
        doc.moveDown(0.5);
      }

      // ── Section 06: Experience ────────────────────────────────────────────
      if (analysis.experience?.length > 0) {
        checkPage(60);
        sectionHeader('06  WORK EXPERIENCE', SECONDARY);
        for (const exp of analysis.experience) {
          checkPage(60);
          doc.fill(DARK).font('Helvetica-Bold').fontSize(10).text(`${exp.role} @ ${exp.company}`, { width: 495 });
          doc.fill(MUTED).font('Helvetica').fontSize(9).text(`${exp.startDate} – ${exp.endDate}`);
          doc.fill(DARK).font('Helvetica').fontSize(9).text(exp.description, { width: 495 });
          if (exp.technologies?.length > 0) {
            doc.fill(MUTED).fontSize(8).text(`Tech: ${exp.technologies.join(', ')}`, { width: 495 });
          }
          doc.moveDown(0.5);
        }
        doc.moveDown(0.5);
      }

      // ── Section 07: Projects ──────────────────────────────────────────────
      if (analysis.projects?.length > 0) {
        checkPage(60);
        sectionHeader('07  PROJECTS', PRIMARY);
        for (const proj of analysis.projects) {
          checkPage(50);
          doc.fill(DARK).font('Helvetica-Bold').fontSize(10).text(proj.name, { width: 495 });
          doc.fill(DARK).font('Helvetica').fontSize(9).text(proj.description, { width: 495 });
          if (proj.technologies?.length > 0) {
            doc.fill(MUTED).fontSize(8).text(`Tech: ${proj.technologies.join(', ')}`, { width: 495 });
          }
          if (proj.url) doc.fill(PRIMARY).fontSize(8).text(proj.url, { width: 495 });
          doc.moveDown(0.5);
        }
        doc.moveDown(0.5);
      }

      // ── Footer: Page X of N on every page ────────────────────────────────
      const { start, count } = doc.bufferedPageRange();
      for (let i = 0; i < count; i++) {
        doc.switchToPage(start + i);
        const footerY = doc.page.height - 40;
        doc.moveTo(50, footerY - 4).lineTo(doc.page.width - 50, footerY - 4).lineWidth(0.5).strokeColor('#cccccc').stroke();
        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(
          `Page ${i + 1} of ${count}`,
          50, footerY,
          { width: doc.page.width - 100, align: 'center' },
        );
      }
      doc.flushPages();
      doc.end();

    } catch (error) { reject(error); }
  });
}

// ─── CSV Report Generator ─────────────────────────────────────────────────────

export function generateCSVReport(analysis: AnalysisResponse): string {
  const esc = (v: string) => (v.includes(',') || v.includes('"') || v.includes('\n')) ? `"${v.replace(/"/g, '""')}"` : v;
  const rows: string[][] = [
    ['ResumeIQ — Skills Analysis Report'], [],
    ['Candidate', analysis.candidateName || 'N/A'],
    ['Target Role', analysis.targetRole],
    ['Readiness Score', `${Math.round(analysis.readinessScore || 0)}%`],
    ['Report Date', new Date().toISOString().split('T')[0]], [],
    ['Skill', 'Status', 'Priority'],
  ];
  for (const s of analysis.matchedSkills) rows.push([s, 'Matched', 'N/A']);
  for (const s of analysis.missingSkills) rows.push([s, 'Missing', 'High']);
  rows.push([], ['Learning Resources'], ['Skill', 'Resource', 'Platform', 'Type', 'URL', 'Hours']);
  for (const r of analysis.learningResources || []) rows.push([r.skill, r.name, r.platform, r.type, r.url, String(r.estimatedHours)]);
  return rows.map((row) => row.map(esc).join(',')).join('\n');
}