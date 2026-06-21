import OpenAI from 'openai';
import { z } from 'zod';
// pdf-lib is pure JS — no font files read from disk, no native dependencies.
// Works on Vercel serverless with zero configuration, unlike pdfkit which requires
// Helvetica.afm font files that Vercel's bundler strips at build time.
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import mammoth from 'mammoth';
import { ROLE_SKILLS, SKILL_ALIASES, SUPPORTED_ROLES } from './role-skills';
import type { SupportedRole } from './role-skills';

// ─── Config ───────────────────────────────────────────────────────────────────

const GROQ_TEXT_MODEL = 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

// ─── Groq Key Pool + Failover ──────────────────────────────────────────────────
//
// 3 keys tried in order on every callGroq() invocation. A key is skipped to
// the next one on 429 (rate limit) / 401 / 403 (invalid/exhausted). Any other
// error (bad request, network) aborts immediately — retrying other keys won't
// help. If ALL 3 keys are exhausted, callGroq() throws GroqAllKeysExhaustedError,
// which every caller below already catches and falls back to its own offline
// fallback (hardcoded fallback questions, empty profile, local skill match, etc).

const GROQ_KEYS = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
].filter((k): k is string => typeof k === 'string' && k.trim().length > 0);

if (GROQ_KEYS.length === 0) {
  console.warn('[groq] No GROQ_API_KEY_1/2/3 configured — all AI calls will go straight to local fallback.');
}

const _groqClients = new Map<string, OpenAI>();
function getGroqClientForKey(key: string): OpenAI {
  let client = _groqClients.get(key);
  if (!client) {
    client = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' });
    _groqClients.set(key, client);
  }
  return client;
}

function isExhaustedKeyError(err: unknown): boolean {
  const status =
    (err as any)?.status ??
    (err as any)?.response?.status ??
    (err as any)?.statusCode;
  return status === 429 || status === 401 || status === 403;
}

export class GroqAllKeysExhaustedError extends Error {
  constructor(public cause: unknown) {
    super('All Groq API keys are rate-limited or exhausted.');
    this.name = 'GroqAllKeysExhaustedError';
  }
}

/** Runs `makeRequest` against each configured Groq key in order until one succeeds. */
async function withGroqFailover<T>(makeRequest: (client: OpenAI) => Promise<T>): Promise<T> {
  if (GROQ_KEYS.length === 0) {
    throw new GroqAllKeysExhaustedError(new Error('No Groq keys configured'));
  }

  let lastError: unknown = null;
  for (let i = 0; i < GROQ_KEYS.length; i++) {
    try {
      return await makeRequest(getGroqClientForKey(GROQ_KEYS[i]));
    } catch (err) {
      lastError = err;
      if (isExhaustedKeyError(err)) {
        console.warn(`[groq] key #${i + 1} exhausted/invalid, trying next key...`);
        continue;
      }
      throw err; // non-rate-limit error — no point trying other keys
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

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const flexibleString = z.union([z.string(), z.number(), z.null()]).transform((v) => (v === null ? '' : String(v)));

const CandidateProfileSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  skills: z.array(z.string()),
  education: z.array(z.object({ institution: z.string(), degree: z.string(), field: z.string(), startYear: flexibleString, endYear: flexibleString, gpa: flexibleString.optional() })),
  experience: z.array(z.object({ company: z.string(), role: z.string(), startDate: flexibleString, endDate: flexibleString, description: z.string(), technologies: z.array(z.string()) })),
  projects: z.array(z.object({ name: z.string(), description: z.string(), technologies: z.array(z.string()), url: z.string().optional() })),
  certifications: z.array(z.object({ name: z.string(), issuer: z.string(), year: flexibleString })),
});
const InterviewQuestionSchema = z.object({ question: z.string(), category: z.enum(['technical', 'project', 'scenario', 'hr']), difficulty: z.enum(['Easy', 'Medium', 'Hard']), hint: z.string() });
const InterviewQuestionsSchema = z.object({ technical: z.array(InterviewQuestionSchema), project: z.array(InterviewQuestionSchema), scenario: z.array(InterviewQuestionSchema), hr: z.array(InterviewQuestionSchema) });
const LearningResourceSchema = z.object({ skill: z.string(), name: z.string(), url: z.string(), platform: z.string(), type: z.enum(['free', 'paid', 'certification', 'practice']), description: z.string(), estimatedHours: z.number(), isCertification: z.boolean() });
const PreparationRoadmapSchema = z.object({
  totalWeeks: z.number(), targetRole: z.string(),
  weeks: z.array(z.object({ week: z.number(), title: z.string(), focus: z.string(), tasks: z.array(z.object({ day: z.number(), task: z.string(), resource: z.string().optional() })), skills: z.array(z.string()) })),
  tips: z.array(z.string()),
});

// ─── Groq Text Helper (now with 3-key failover) ────────────────────────────────

async function callGroq<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  maxTokens = 1024,
): Promise<T> {
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
// Every function below already has its own offline fallback for when Groq
// fails (including GroqAllKeysExhaustedError, which is just another Error).
// No changes were needed to these — they were already resilient by design.

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
    // Always return a plain string — never the object itself
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

export async function generatePreparationRoadmap(
  missingSkills: string[],
  matchedSkills: string[],
  targetRole: string,
): Promise<PreparationRoadmap> {
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
  const wordMatches = text.match(/[a-zA-Z]{3,}/g) || [];
  return wordMatches.length >= 10;
}

// ─── PDF Parser ───────────────────────────────────────────────────────────────
//
// Fallback chain (in order):
//   1. pdf-parse      — handles most standard PDFs including custom fonts
//   2. pdfreader      — positional text extraction (original approach)
//   3. raw extraction — brute-force PDF string scanning
//   4. Groq vision    — renders the PDF as image and OCRs it via Llama 4 Scout
//
// Each step is tried silently; only the last throws to the caller.

export async function parseResumePDF(buffer: Buffer): Promise<string> {
  // ── Step 1: pdf-parse (best general-purpose PDF text extractor) ──────────
  try {
    const text = await parsePDFWithPdfParse(buffer);
    if (isReadableText(text)) {
      console.log('[parseResumePDF] succeeded with pdf-parse, length:', text.length);
      return text;
    }
    console.log('[parseResumePDF] pdf-parse returned unreadable text, trying pdfreader...');
  } catch (e) {
    console.log('[parseResumePDF] pdf-parse failed:', (e as Error).message, '— trying pdfreader...');
  }

  // ── Step 2: pdfreader (positional row-based extraction) ──────────────────
  try {
    const text = await parsePDFWithPdfReader(buffer);
    if (isReadableText(text)) {
      console.log('[parseResumePDF] succeeded with pdfreader, length:', text.length);
      return text;
    }
    console.log('[parseResumePDF] pdfreader returned unreadable text, trying raw extraction...');
  } catch (e) {
    console.log('[parseResumePDF] pdfreader failed:', (e as Error).message, '— trying raw extraction...');
  }

  // ── Step 3: raw PDF string scanning ─────────────────────────────────────
  try {
    const text = extractRawText(buffer);
    if (isReadableText(text)) {
      console.log('[parseResumePDF] succeeded with raw extraction, length:', text.length);
      return text;
    }
    console.log('[parseResumePDF] raw extraction returned unreadable text, trying Groq vision OCR...');
  } catch (e) {
    console.log('[parseResumePDF] raw extraction failed:', (e as Error).message, '— trying Groq vision OCR...');
  }

  // ── Step 4: Groq vision OCR (renders PDF pages as images) ───────────────
  // Convert the first page of the PDF to a JPEG via sharp, then send to the
  // Groq vision model. Requires: npm install sharp
  // If sharp is not installed, this step is skipped gracefully.
  try {
    const text = await parsePDFWithGroqVision(buffer);
    if (isReadableText(text)) {
      console.log('[parseResumePDF] succeeded with Groq vision OCR, length:', text.length);
      return text;
    }
  } catch (e) {
    console.log('[parseResumePDF] Groq vision OCR failed:', (e as Error).message);
  }

  throw new Error(
    'Could not extract readable text from this PDF. ' +
    'It may use custom fonts, be scanned, or be image-only. ' +
    'Please try: (1) re-saving it as a standard PDF, (2) uploading as DOCX or TXT, or (3) uploading a PNG/JPG screenshot of your resume.',
  );
}

// ── pdf-parse: most compatible PDF text extractor ───────────────────────────
async function parsePDFWithPdfParse(buffer: Buffer): Promise<string> {
  // pdf-parse has a quirky export shape that breaks under Next.js/Turbopack's
  // module resolution. We try all three known export shapes in order.
  // Cast to `any` — pdf-parse ESM types don't expose `.default` but runtime does
  const mod = await import('pdf-parse') as any;
  const pdfParse: ((buf: Buffer, opts?: object) => Promise<{ text: string }>) | null =
    typeof mod.default?.default === 'function' ? mod.default.default :
      typeof mod.default === 'function' ? mod.default :
        typeof mod === 'function' ? mod :
          null;
  if (!pdfParse) throw new Error('pdfParse is not a function');
  const result = await pdfParse(buffer, { max: 0 });
  const text = (result.text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length < 20) throw new Error('pdf-parse extracted empty text');
  return text;
}

// ── pdfreader: positional row-based extraction ───────────────────────────────
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

// ── Raw text: brute-force PDF string scanning ────────────────────────────────
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

// ── Groq vision OCR: last-resort for scanned / image-only PDFs ──────────────
// Requires: npm install sharp
// sharp rasterizes PDF page 1 → PNG → Groq Llama 4 Scout OCR
async function parsePDFWithGroqVision(buffer: Buffer): Promise<string> {
  // sharp is required — raw PDF bytes are NOT valid image data for vision APIs
  let sharpLib: typeof import('sharp').default;
  try {
    sharpLib = (await import('sharp')).default;
  } catch {
    throw new Error('sharp is not installed. Run: npm install sharp');
  }

  let imageBuffer: Buffer;
  try {
    // density=150 gives ~1240x1754px for A4 — enough for OCR without being huge
    imageBuffer = await sharpLib(buffer, { density: 150 }).png().toBuffer();
    console.log('[parsePDFWithGroqVision] rasterized PDF page 1 to PNG, size:', imageBuffer.length, 'bytes');
  } catch (e) {
    // sharp installed but PDF rasterization unsupported (libvips without poppler)
    // Fall back to extracting the first embedded JPEG/PNG image from the PDF binary
    console.log('[parsePDFWithGroqVision] PDF rasterization failed:', (e as Error).message);
    console.log('[parsePDFWithGroqVision] trying embedded image extraction...');
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

// Extract the first JPEG/PNG image stream embedded in a PDF binary.
// Used as a fallback when sharp cannot rasterize the PDF directly.
async function extractFirstEmbeddedImage(
  buffer: Buffer,
  sharpLib: typeof import('sharp').default,
): Promise<Buffer> {
  const bin = buffer.toString('binary');

  // Try JPEG (most common in scanned PDFs)
  const jpegStart = bin.indexOf('\xFF\xD8\xFF');
  if (jpegStart !== -1) {
    const jpegEnd = bin.indexOf('\xFF\xD9', jpegStart);
    if (jpegEnd !== -1) {
      const jpegBytes = Buffer.from(bin.slice(jpegStart, jpegEnd + 2), 'binary');
      console.log('[extractFirstEmbeddedImage] found JPEG, size:', jpegBytes.length);
      return sharpLib(jpegBytes).png().toBuffer();
    }
  }

  // Try PNG
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

  throw new Error(
    'sharp cannot rasterize this PDF and no embedded images were found. ' +
    'Please upload the resume as a PNG or JPG screenshot instead.',
  );
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

  console.log('[parseResumeImage] using model:', GROQ_VISION_MODEL, '| size:', buffer.length, 'bytes');

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
// Pure offline logic — no AI call involved, so it is unaffected by Groq
// outages and serves as the natural "local fallback" for skill matching.

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

// ─── Multi-Role / Custom Role / Job-Description-aware Target ─────────────────
//
// Lets the analyze screen support: multiple predefined roles selected at once,
// a free-typed "other" role, a target company, and a pasted job description.
// If a job description is supplied, its required skills are extracted via Groq
// and merged into the comparison set — this is far more precise than matching
// against the static ROLE_SKILLS list alone. If only a custom role is given
// (no predefined roles, no JD), Groq is asked to infer typical required skills
// for that role title.

export interface AnalysisTarget {
  roles: string[];          // predefined role ids the user toggled on (can be empty)
  customRole?: string;      // free-typed role title, used if not in predefined list
  company?: string;
  jobDescription?: string;
}

export function buildTargetRoleLabel(target: AnalysisTarget): string {
  const names = [...target.roles];
  if (target.customRole?.trim()) names.push(target.customRole.trim());
  return names.join(' / ') || 'Unspecified Role';
}

const SkillListSchema = z.object({ skills: z.array(z.string()) });

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
  const requiredMap = new Map<string, string>();   // normalized -> original casing
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

  // Only fall back to AI-inferred skills for the custom role if nothing else supplied any requirements
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

// ─── PDF Report Generator (pdf-lib — pure JS, Vercel-safe) ───────────────────

export async function generatePDFReport(analysis: AnalysisResponse): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const C = {
    primary: rgb(0.145, 0.388, 0.922),
    secondary: rgb(0.082, 0.722, 0.651),
    accent: rgb(0.961, 0.620, 0.043),
    dark: rgb(0.118, 0.176, 0.235),
    muted: rgb(0.392, 0.455, 0.545),
    success: rgb(0.063, 0.725, 0.506),
    danger: rgb(0.937, 0.267, 0.267),
    white: rgb(1, 1, 1),
    lightgray: rgb(0.8, 0.8, 0.8),
  };

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 50;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const LINE_H = 14;  // standard line height
  const FOOTER_H = 50; // reserved at bottom of every page

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  // y is the TOP of the next available line (pdf-lib draws from bottom-left,
  // so we convert: drawY = y - fontSize when calling drawText)
  let curY = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    curY = PAGE_H - MARGIN;
  };

  // Ensure there's room for `needed` pts before drawing
  const need = (needed: number) => { if (curY - needed < FOOTER_H + 10) newPage(); };

  // Word-wrap a string into lines that fit within maxWidth
  const wrapText = (str: string, font: typeof fontReg, size: number, maxWidth: number): string[] => {
    const words = String(str).split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };

  // Draw a single line at curY and advance curY downward
  const drawLine = (
    str: string,
    opts: { x?: number; size?: number; font?: typeof fontBold; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const { x = MARGIN, size = 10, font = fontReg, color = C.dark } = opts;
    page.drawText(String(str), { x, y: curY - size, size, font, color });
    curY -= LINE_H;
  };

  // Draw wrapped text block, advancing curY for each line
  const drawWrapped = (
    str: string,
    opts: { x?: number; size?: number; font?: typeof fontBold; color?: ReturnType<typeof rgb>; maxWidth?: number } = {},
  ) => {
    const { x = MARGIN, size = 9, font = fontReg, color = C.dark, maxWidth = CONTENT_W } = opts;
    const lines = wrapText(String(str), font, size, maxWidth);
    for (const l of lines) {
      need(LINE_H + 4);
      page.drawText(l, { x, y: curY - size, size, font, color });
      curY -= LINE_H;
    }
  };

  // Draw "Label:  Value" on the SAME line, value wraps if needed
  const drawLabelValue = (label: string, value: string, labelColor = C.muted, valueColor = C.dark) => {
    need(LINE_H + 4);
    const labelStr = `${label}:`;
    const labelW = fontBold.widthOfTextAtSize(labelStr, 9) + 6;
    const valueX = MARGIN + labelW;
    const valueMaxW = CONTENT_W - labelW;

    // Draw label at current line
    page.drawText(labelStr, { x: MARGIN, y: curY - 9, size: 9, font: fontBold, color: labelColor });

    // Wrap value within remaining width
    const lines = wrapText(value, fontReg, 9, valueMaxW);
    for (let i = 0; i < lines.length; i++) {
      need(LINE_H + 2);
      page.drawText(lines[i], {
        x: i === 0 ? valueX : MARGIN + 8, // indent continuation lines slightly
        y: curY - 9,
        size: 9, font: fontReg, color: valueColor,
      });
      curY -= LINE_H;
    }
  };

  const gap = (h = 8) => { curY -= h; };

  const fillRect = (rx: number, ry: number, rw: number, rh: number, color: ReturnType<typeof rgb>) => {
    page.drawRectangle({ x: rx, y: ry, width: rw, height: rh, color });
  };

  // Section header: coloured bar with white title, advances curY past bar
  const sectionHeader = (title: string, color: ReturnType<typeof rgb>) => {
    need(32);
    fillRect(MARGIN, curY - 22, CONTENT_W, 22, color);
    page.drawText(title, { x: MARGIN + 8, y: curY - 16, size: 11, font: fontBold, color: C.white });
    curY -= 28; // move past bar + small gap
  };

  // ── Page 1 Header ─────────────────────────────────────────────────────────
  fillRect(0, PAGE_H - 80, PAGE_W, 80, C.primary);
  page.drawText('ResumeIQ', { x: MARGIN, y: PAGE_H - 42, size: 26, font: fontBold, color: C.white });
  page.drawText('AI-Powered Career Preparation Report', { x: MARGIN, y: PAGE_H - 62, size: 11, font: fontReg, color: C.white });
  fillRect(0, PAGE_H - 84, PAGE_W, 4, C.accent);
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  page.drawText(`Generated: ${dateStr}`, { x: PAGE_W - 190, y: PAGE_H - 100, size: 8, font: fontReg, color: C.muted });
  curY = PAGE_H - 104;
  gap(12);

  // Safely coerce candidateSummary
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

  // ── 01 Candidate Profile ──────────────────────────────────────────────────
  sectionHeader('01  CANDIDATE PROFILE', C.primary);
  gap(4);
  drawLabelValue('Name', analysis.candidateName || 'N/A');
  gap(2);
  drawLabelValue('Email', analysis.candidateEmail || 'N/A');
  gap(2);
  drawLabelValue('Phone', analysis.candidatePhone || 'N/A');
  gap(2);
  drawLabelValue('Target Role', analysis.targetRole);
  if (summaryText) {
    gap(6);
    drawLine('Summary:', { size: 9, font: fontBold, color: C.muted });
    drawWrapped(summaryText, { size: 9, color: C.dark });
  }
  gap(14);

  // ── 02 Readiness Score ────────────────────────────────────────────────────
  sectionHeader('02  READINESS SCORE', C.secondary);
  gap(8);
  need(56);
  const score = Math.round(analysis.readinessScore || 0);
  const scoreColor = score >= 70 ? C.success : score >= 40 ? C.accent : C.danger;
  // Draw large score number
  page.drawText(`${score}%`, { x: MARGIN, y: curY - 38, size: 38, font: fontBold, color: scoreColor });
  // Draw description to the right of the score
  const scoreDesc = `${analysis.matchedSkills.length} of ${analysis.matchedSkills.length + analysis.missingSkills.length} required skills matched`;
  page.drawText(scoreDesc, { x: MARGIN + 110, y: curY - 22, size: 10, font: fontReg, color: C.muted });
  curY -= 52;
  gap(14);

  // ── 03 Skill Analysis ─────────────────────────────────────────────────────
  sectionHeader('03  SKILL ANALYSIS', C.primary);
  gap(6);
  drawLine('Matched Skills:', { size: 9, font: fontBold, color: C.success });
  drawWrapped(analysis.matchedSkills.join('  •  ') || 'None', { size: 9, color: C.dark });
  gap(8);
  drawLine('Missing Skills:', { size: 9, font: fontBold, color: C.danger });
  drawWrapped(analysis.missingSkills.join('  •  ') || 'None', { size: 9, color: C.dark });
  gap(14);

  // ── 04 Learning Recommendations ───────────────────────────────────────────
  if (analysis.learningResources?.length > 0) {
    sectionHeader('04  LEARNING RECOMMENDATIONS', C.secondary);
    gap(6);
    for (const res of analysis.learningResources.slice(0, 12)) {
      need(LINE_H + 4);
      const badge = res.type === 'free' ? '[FREE]' : res.type === 'paid' ? '[PAID]' : '[CERT]';
      drawWrapped(`${badge} ${res.name} — ${res.platform} (${res.skill})`, { size: 9, color: C.dark });
      gap(2);
    }
    gap(10);
  }

  // ── 05 Education ──────────────────────────────────────────────────────────
  if (analysis.education?.length > 0) {
    sectionHeader('05  EDUCATION', C.primary);
    gap(6);
    for (const edu of analysis.education) {
      need(36);
      drawWrapped(`${edu.degree} in ${edu.field}`, { size: 10, font: fontBold, color: C.dark });
      drawWrapped(`${edu.institution}  |  ${edu.startYear} – ${edu.endYear}${edu.gpa ? `  |  GPA: ${edu.gpa}` : ''}`, { size: 9, color: C.muted });
      gap(8);
    }
    gap(6);
  }

  // ── 06 Work Experience ────────────────────────────────────────────────────
  if (analysis.experience?.length > 0) {
    sectionHeader('06  WORK EXPERIENCE', C.secondary);
    gap(6);
    for (const exp of analysis.experience) {
      need(50);
      drawWrapped(`${exp.role} @ ${exp.company}`, { size: 10, font: fontBold, color: C.dark });
      drawLine(`${exp.startDate} – ${exp.endDate}`, { size: 9, color: C.muted });
      drawWrapped(exp.description, { size: 9, color: C.dark });
      if (exp.technologies?.length > 0) drawWrapped(`Tech: ${exp.technologies.join(', ')}`, { size: 8, color: C.muted });
      gap(8);
    }
    gap(6);
  }

  // ── 07 Projects ───────────────────────────────────────────────────────────
  if (analysis.projects?.length > 0) {
    sectionHeader('07  PROJECTS', C.primary);
    gap(6);
    for (const proj of analysis.projects) {
      need(40);
      drawLine(proj.name, { size: 10, font: fontBold, color: C.dark });
      drawWrapped(proj.description, { size: 9, color: C.dark });
      if (proj.technologies?.length > 0) drawWrapped(`Tech: ${proj.technologies.join(', ')}`, { size: 8, color: C.muted });
      if (proj.url) drawLine(proj.url, { size: 8, color: C.primary });
      gap(8);
    }
  }

  // ── Footer: Page X of N on every page ────────────────────────────────────
  const allPages = pdfDoc.getPages();
  const total = allPages.length;
  for (let i = 0; i < total; i++) {
    const pg = allPages[i];
    pg.drawLine({ start: { x: MARGIN, y: 40 }, end: { x: PAGE_W - MARGIN, y: 40 }, thickness: 0.5, color: C.lightgray });
    const label = `Page ${i + 1} of ${total}`;
    const lw = fontReg.widthOfTextAtSize(label, 9);
    pg.drawText(label, { x: (PAGE_W - lw) / 2, y: 26, size: 9, font: fontReg, color: C.muted });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// ─── CSV Report Generator ─────────────────────────────────────────────────────

export function generateCSVReport(analysis: AnalysisResponse): string {
  const escCSV = (v: string) => (v.includes(',') || v.includes('"') || v.includes('\n')) ? `"${v.replace(/"/g, '""')}"` : v;
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
  return rows.map((row) => row.map(escCSV).join(',')).join('\n');
}