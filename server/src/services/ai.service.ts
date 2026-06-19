import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { config } from '../config/index.js';
import type {
  CandidateProfile,
  InterviewQuestions,
  LearningResource,
  PreparationRoadmap,
} from '../types/index.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string(),
  field: z.string(),
  startYear: z.string(),
  endYear: z.string(),
  gpa: z.string().optional(),
});

const ExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  description: z.string(),
  technologies: z.array(z.string()),
});

const ProjectSchema = z.object({
  name: z.string(),
  description: z.string(),
  technologies: z.array(z.string()),
  url: z.string().optional(),
});

const CertificationSchema = z.object({
  name: z.string(),
  issuer: z.string(),
  year: z.string(),
});

const CandidateProfileSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  skills: z.array(z.string()),
  education: z.array(EducationSchema),
  experience: z.array(ExperienceSchema),
  projects: z.array(ProjectSchema),
  certifications: z.array(CertificationSchema),
});

const InterviewQuestionSchema = z.object({
  question: z.string(),
  category: z.enum(['technical', 'project', 'scenario', 'hr']),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  hint: z.string(),
});

const InterviewQuestionsSchema = z.object({
  technical: z.array(InterviewQuestionSchema),
  project: z.array(InterviewQuestionSchema),
  scenario: z.array(InterviewQuestionSchema),
  hr: z.array(InterviewQuestionSchema),
});

const LearningResourceSchema = z.object({
  skill: z.string(),
  name: z.string(),
  url: z.string(),
  platform: z.string(),
  type: z.enum(['free', 'paid', 'certification', 'practice']),
  description: z.string(),
  estimatedHours: z.number(),
  isCertification: z.boolean(),
});

const PreparationRoadmapSchema = z.object({
  totalWeeks: z.number(),
  targetRole: z.string(),
  weeks: z.array(
    z.object({
      week: z.number(),
      title: z.string(),
      focus: z.string(),
      tasks: z.array(
        z.object({
          day: z.number(),
          task: z.string(),
          resource: z.string().optional(),
        })
      ),
      skills: z.array(z.string()),
    })
  ),
  tips: z.array(z.string()),
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function callClaude<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  retries = 2
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      });

      const block = response.content[0];
      if (!block || block.type !== 'text') throw new Error('Empty or unexpected response from Claude');

      const content = block.text;

      // Strip markdown code fences if present (Claude may wrap JSON in ```json ... ```)
      const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

      const parsed = JSON.parse(cleaned);
      return schema.parse(parsed);
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error('Failed after retries');
}

// ─── AI Service ───────────────────────────────────────────────────────────────

export class AIService {
  /**
   * Extract structured profile data from raw resume text using Claude.
   */
  async extractResumeData(resumeText: string): Promise<CandidateProfile> {
    const systemPrompt = `You are an expert resume parser. Extract structured information from the resume text provided.
Return a JSON object with EXACTLY this structure (no markdown, no code fences, raw JSON only):
{
  "name": "full name",
  "email": "email address",
  "phone": "phone number",
  "skills": ["skill1", "skill2", ...],
  "education": [{"institution": "", "degree": "", "field": "", "startYear": "", "endYear": "", "gpa": ""}],
  "experience": [{"company": "", "role": "", "startDate": "", "endDate": "", "description": "", "technologies": []}],
  "projects": [{"name": "", "description": "", "technologies": [], "url": ""}],
  "certifications": [{"name": "", "issuer": "", "year": ""}]
}

IMPORTANT:
- Extract ALL skills mentioned anywhere in the resume (technical, tools, frameworks, languages)
- If information is missing, use empty string "" or empty array []
- For dates, use format like "2020", "Jan 2020", or "2020-2022"
- Be thorough with skills — extract from every section
- Return ONLY raw JSON, no explanation, no markdown`;

    const userPrompt = `Extract all information from this resume:\n\n${resumeText.substring(0, 6000)}`;

    try {
      return await callClaude(systemPrompt, userPrompt, CandidateProfileSchema);
    } catch {
      return {
        name: 'Unknown Candidate',
        email: '',
        phone: '',
        skills: [],
        education: [],
        experience: [],
        projects: [],
        certifications: [],
      };
    }
  }

  /**
   * Generate a professional candidate summary tailored to the target role.
   */
  async generateCandidateSummary(
    profile: CandidateProfile,
    targetRole: string
  ): Promise<string> {
    const systemPrompt = `You are a professional career counselor. Write a concise 3-4 sentence professional summary for a candidate applying for the target role. Highlight their strongest relevant skills and experience.
Return ONLY raw JSON, no markdown: { "summary": "the professional summary here" }`;

    const userPrompt = `Candidate: ${profile.name}
Target Role: ${targetRole}
Skills: ${profile.skills.join(', ')}
Experience: ${profile.experience.map((e) => `${e.role} at ${e.company}`).join('; ')}
Education: ${profile.education.map((e) => `${e.degree} in ${e.field} from ${e.institution}`).join('; ')}

Return JSON: { "summary": "the professional summary here" }`;

    try {
      const result = await callClaude(
        systemPrompt,
        userPrompt,
        z.object({ summary: z.string() })
      );
      return result.summary;
    } catch {
      return `${profile.name} is a skilled professional with experience in ${profile.skills.slice(0, 3).join(', ')}. They are seeking a ${targetRole} role where they can apply their expertise and continue growing professionally.`;
    }
  }

  /**
   * Generate categorized interview questions based on candidate profile and role.
   */
  async generateInterviewQuestions(
    profile: CandidateProfile,
    targetRole: string,
    matchedSkills: string[],
    missingSkills: string[]
  ): Promise<InterviewQuestions> {
    const systemPrompt = `You are an expert technical interviewer. Generate exactly 25 interview questions in 4 categories for a ${targetRole} candidate.

Return EXACTLY this JSON structure (raw JSON only, no markdown):
{
  "technical": [10 questions],
  "project": [5 questions],
  "scenario": [5 questions],
  "hr": [5 questions]
}

RULES:
- Technical: Based on the candidate's existing skills (${matchedSkills.slice(0, 5).join(', ')})
- Project: Based on actual resume projects (ask about architecture, challenges, decisions)
- Scenario: Real-world situational questions specific to ${targetRole} role
- HR: Pure behavioral questions (tell me about yourself, conflict resolution, strengths/weaknesses)
- HR questions MUST be different from Scenario questions
- Each question must have a helpful hint

For each question use format:
{ "question": "...", "category": "technical|project|scenario|hr", "difficulty": "Easy|Medium|Hard", "hint": "key points to cover in answer" }`;

    const projectNames = profile.projects.map((p) => p.name).join(', ') || 'your main projects';
    const userPrompt = `Candidate Profile:
- Target Role: ${targetRole}
- Skills: ${matchedSkills.join(', ')}
- Missing Skills: ${missingSkills.slice(0, 5).join(', ')}
- Projects: ${projectNames}
- Experience: ${profile.experience.map((e) => `${e.role} at ${e.company}`).join('; ')}

Generate exactly 25 questions across 4 categories.`;

    try {
      return await callClaude(systemPrompt, userPrompt, InterviewQuestionsSchema);
    } catch {
      return this.getFallbackQuestions(targetRole);
    }
  }

  /**
   * Generate learning resources for missing skills.
   */
  async generateLearningResources(
    missingSkills: string[],
    targetRole: string
  ): Promise<LearningResource[]> {
    if (missingSkills.length === 0) return [];

    const systemPrompt = `You are a learning and development expert. Generate specific, real learning resources for each missing skill.

Return JSON (raw JSON only, no markdown): { "resources": [ array of resource objects ] }

Each resource:
{
  "skill": "skill name",
  "name": "course/resource title",
  "url": "real URL (use actual URLs like coursera.org, udemy.com, youtube.com, etc.)",
  "platform": "platform name",
  "type": "free|paid|certification|practice",
  "description": "brief description",
  "estimatedHours": number,
  "isCertification": boolean
}

Provide 3-4 resources per skill. Mix free and paid options. Include at least one YouTube resource per skill.`;

    const userPrompt = `Target Role: ${targetRole}
Missing Skills: ${missingSkills.slice(0, 8).join(', ')}

Generate 3-4 learning resources for each missing skill.`;

    try {
      const result = await callClaude(
        systemPrompt,
        userPrompt,
        z.object({ resources: z.array(LearningResourceSchema) })
      );
      return result.resources;
    } catch {
      return this.getFallbackResources(missingSkills);
    }
  }

  /**
   * Generate a personalized 30-day preparation roadmap.
   */
  async generatePreparationRoadmap(
    missingSkills: string[],
    matchedSkills: string[],
    targetRole: string
  ): Promise<PreparationRoadmap> {
    const systemPrompt = `You are a career coach. Create a detailed 30-day preparation roadmap for a ${targetRole} candidate.

Return EXACTLY this JSON structure (raw JSON only, no markdown):
{
  "totalWeeks": 4,
  "targetRole": "${targetRole}",
  "weeks": [
    {
      "week": 1,
      "title": "Week title",
      "focus": "What to focus on",
      "tasks": [
        { "day": 1, "task": "specific task", "resource": "resource to use" },
        ... (5-7 tasks per week)
      ],
      "skills": ["skills covered this week"]
    }
  ],
  "tips": ["5 actionable tips for success"]
}

Week structure:
- Week 1: Focus on most critical missing skill
- Week 2: Focus on second missing skill OR strengthen weak areas
- Week 3: Build projects and portfolio
- Week 4: Interview preparation and mock interviews`;

    const userPrompt = `Target Role: ${targetRole}
Missing Skills (prioritized): ${missingSkills.slice(0, 6).join(', ')}
Current Skills: ${matchedSkills.slice(0, 8).join(', ')}

Create a focused 30-day preparation plan.`;

    try {
      return await callClaude(systemPrompt, userPrompt, PreparationRoadmapSchema);
    } catch {
      return this.getFallbackRoadmap(targetRole, missingSkills);
    }
  }

  // ─── Fallback Data ─────────────────────────────────────────────────────────

  private getFallbackQuestions(targetRole: string): InterviewQuestions {
    return {
      technical: [
        { question: `What are the core technical skills required for a ${targetRole}?`, category: 'technical', difficulty: 'Easy', hint: 'Discuss the key technologies and tools.' },
        { question: 'Explain the difference between SQL and NoSQL databases.', category: 'technical', difficulty: 'Medium', hint: 'Focus on use cases, scalability, and data structure.' },
        { question: 'What is your approach to debugging a complex issue in production?', category: 'technical', difficulty: 'Hard', hint: 'Describe systematic debugging, logging, and monitoring.' },
        { question: 'How do you ensure code quality in your projects?', category: 'technical', difficulty: 'Medium', hint: 'Mention code reviews, testing, linting, and CI/CD.' },
        { question: 'Explain RESTful API design principles.', category: 'technical', difficulty: 'Medium', hint: 'Statelessness, resource naming, HTTP verbs, status codes.' },
        { question: 'What is version control and why is it important?', category: 'technical', difficulty: 'Easy', hint: 'Git workflow, branching, collaboration benefits.' },
        { question: 'How do you handle asynchronous operations?', category: 'technical', difficulty: 'Medium', hint: 'Promises, async/await, event loops.' },
        { question: 'What is your understanding of system design?', category: 'technical', difficulty: 'Hard', hint: 'Scalability, load balancing, caching, databases.' },
        { question: 'Explain the concept of containerization.', category: 'technical', difficulty: 'Medium', hint: 'Docker, isolation, portability, orchestration.' },
        { question: 'How do you stay updated with the latest technologies?', category: 'technical', difficulty: 'Easy', hint: 'Blogs, courses, conferences, open source.' },
      ],
      project: [
        { question: 'Tell me about your most challenging project and how you overcame the difficulties.', category: 'project', difficulty: 'Hard', hint: 'Problem, approach, solution, learnings.' },
        { question: 'Walk me through the architecture of a recent project.', category: 'project', difficulty: 'Medium', hint: 'Components, data flow, technology choices.' },
        { question: 'What would you do differently if you rebuilt one of your projects from scratch?', category: 'project', difficulty: 'Medium', hint: 'Lessons learned, better practices, scalability.' },
        { question: 'How did you measure the success of your project?', category: 'project', difficulty: 'Easy', hint: 'Metrics, user feedback, performance benchmarks.' },
        { question: 'How did you handle version control and collaboration in your projects?', category: 'project', difficulty: 'Easy', hint: 'Git workflow, PR process, team coordination.' },
      ],
      scenario: [
        { question: 'You discover a critical bug in production affecting all users. What do you do?', category: 'scenario', difficulty: 'Hard', hint: 'Immediate mitigation, root cause analysis, communication, fix.' },
        { question: 'You have conflicting deadlines on two equally important tasks. How do you prioritize?', category: 'scenario', difficulty: 'Medium', hint: 'Stakeholder communication, task breakdown, time management.' },
        { question: 'A client requests a feature that you believe will harm the product. How do you handle this?', category: 'scenario', difficulty: 'Medium', hint: 'Data-driven argument, alternative solutions, communication.' },
        { question: 'You join a new team with legacy code and poor documentation. What is your approach?', category: 'scenario', difficulty: 'Medium', hint: 'Code exploration, asking questions, gradual documentation.' },
        { question: "How would you handle a situation where you disagree with your team lead's technical decision?", category: 'scenario', difficulty: 'Hard', hint: 'Professional communication, data backing, respect hierarchy.' },
      ],
      hr: [
        { question: 'Tell me about yourself and your career journey.', category: 'hr', difficulty: 'Easy', hint: 'Concise background, key achievements, why this role.' },
        { question: 'What is your greatest professional achievement?', category: 'hr', difficulty: 'Easy', hint: 'Specific example with measurable impact.' },
        { question: 'Where do you see yourself in 5 years?', category: 'hr', difficulty: 'Easy', hint: 'Align with company growth and role progression.' },
        { question: 'Tell me about a time you failed. What did you learn?', category: 'hr', difficulty: 'Medium', hint: 'Honest failure, ownership, lessons, improvement.' },
        { question: 'Why should we hire you over other candidates?', category: 'hr', difficulty: 'Medium', hint: 'Unique value proposition, skills match, enthusiasm.' },
      ],
    };
  }

  private getFallbackResources(skills: string[]): LearningResource[] {
    const resources: LearningResource[] = [];
    const fallbacks: Record<string, LearningResource[]> = {
      'SQL': [
        { skill: 'SQL', name: 'SQL for Data Analysis', url: 'https://www.coursera.org/learn/sql-for-data-science', platform: 'Coursera', type: 'free', description: 'Comprehensive SQL course for beginners', estimatedHours: 20, isCertification: false },
        { skill: 'SQL', name: 'HackerRank SQL Track', url: 'https://www.hackerrank.com/domains/sql', platform: 'HackerRank', type: 'practice', description: 'Practice SQL with real challenges', estimatedHours: 15, isCertification: false },
      ],
      'Python': [
        { skill: 'Python', name: 'Python for Everybody', url: 'https://www.coursera.org/specializations/python', platform: 'Coursera', type: 'free', description: 'Complete Python programming specialization', estimatedHours: 40, isCertification: true },
      ],
      'default': [
        { skill: skills[0] || 'General', name: 'Coursera — Online Learning', url: 'https://www.coursera.org', platform: 'Coursera', type: 'free', description: 'Find courses for any skill', estimatedHours: 20, isCertification: false },
      ],
    };

    for (const skill of skills.slice(0, 6)) {
      const skillResources = fallbacks[skill] || fallbacks['default'].map((r) => ({ ...r, skill }));
      resources.push(...skillResources);
    }
    return resources;
  }

  private getFallbackRoadmap(targetRole: string, missingSkills: string[]): PreparationRoadmap {
    return {
      totalWeeks: 4,
      targetRole,
      weeks: [
        {
          week: 1,
          title: 'Foundation Building',
          focus: missingSkills[0] || 'Core Skills',
          tasks: [
            { day: 1, task: `Research ${missingSkills[0] || 'core skill'} fundamentals`, resource: 'Coursera or YouTube' },
            { day: 2, task: 'Complete beginner tutorial', resource: 'Official documentation' },
            { day: 3, task: 'Build a small practice project' },
            { day: 4, task: 'Practice exercises on HackerRank or LeetCode' },
            { day: 5, task: 'Review and consolidate learning' },
          ],
          skills: missingSkills.slice(0, 2),
        },
        {
          week: 2,
          title: 'Skill Expansion',
          focus: missingSkills[1] || 'Advanced Skills',
          tasks: [
            { day: 8, task: `Deep dive into ${missingSkills[1] || 'advanced topics'}` },
            { day: 9, task: 'Complete an intermediate course' },
            { day: 10, task: 'Work on a guided project' },
            { day: 11, task: 'Connect skills together in a mini project' },
            { day: 12, task: 'Seek feedback and iterate' },
          ],
          skills: missingSkills.slice(1, 3),
        },
        {
          week: 3,
          title: 'Portfolio & Projects',
          focus: 'Building portfolio projects',
          tasks: [
            { day: 15, task: `Plan a ${targetRole} portfolio project` },
            { day: 16, task: 'Start building the project' },
            { day: 17, task: 'Continue building and add documentation' },
            { day: 18, task: 'Deploy project to GitHub/cloud' },
            { day: 19, task: 'Write case study for portfolio' },
          ],
          skills: ['Project Building', 'Git', 'Documentation'],
        },
        {
          week: 4,
          title: 'Interview Preparation',
          focus: 'Mock interviews and final preparation',
          tasks: [
            { day: 22, task: 'Review all technical concepts' },
            { day: 23, task: 'Practice 10 technical interview questions' },
            { day: 24, task: 'Conduct mock behavioral interview' },
            { day: 25, task: 'Research target companies' },
            { day: 26, task: 'Finalize resume and LinkedIn profile' },
          ],
          skills: ['Interview Skills', 'Communication', 'Problem Solving'],
        },
      ],
      tips: [
        'Dedicate at least 2-3 hours daily to learning and practice',
        'Build real projects — employers value practical experience',
        'Network actively on LinkedIn and attend meetups',
        'Practice explaining your work clearly — communication is key',
        'Track your progress daily and adjust the plan as needed',
      ],
    };
  }
}

export const aiService = new AIService();