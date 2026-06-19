// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: AuthUser;
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// ─── Resume / Profile Types ───────────────────────────────────────────────────

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startYear: string;
  endYear: string;
  gpa?: string;
}

export interface Experience {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
  technologies: string[];
}

export interface Project {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
}

export interface Certification {
  name: string;
  issuer: string;
  year: string;
}

export interface CandidateProfile {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  education: Education[];
  experience: Experience[];
  projects: Project[];
  certifications: Certification[];
}

// ─── Skill Gap Types ──────────────────────────────────────────────────────────

export interface SkillGapResult {
  matchedSkills: string[];
  missingSkills: string[];
  recommendedSkills: string[];
  readinessScore: number;
  totalRequired: number;
}

// ─── Interview Question Types ─────────────────────────────────────────────────

export interface InterviewQuestion {
  question: string;
  category: 'technical' | 'project' | 'scenario' | 'hr';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  hint: string;
}

export interface InterviewQuestions {
  technical: InterviewQuestion[];
  project: InterviewQuestion[];
  scenario: InterviewQuestion[];
  hr: InterviewQuestion[];
}

// ─── Learning Resource Types ──────────────────────────────────────────────────

export type ResourceType = 'free' | 'paid' | 'certification' | 'practice';
export type ResourcePlatform =
  | 'Coursera'
  | 'Udemy'
  | 'YouTube'
  | 'edX'
  | 'LeetCode'
  | 'HackerRank'
  | 'Kaggle'
  | 'LinkedIn Learning'
  | 'Google'
  | 'Microsoft'
  | 'AWS'
  | 'DataCamp'
  | 'freeCodeCamp'
  | 'Other';

export interface LearningResource {
  skill: string;
  name: string;
  url: string;
  platform: string;
  type: ResourceType;
  description: string;
  estimatedHours: number;
  isCertification: boolean;
}

// ─── Roadmap Types ────────────────────────────────────────────────────────────

export interface DailyTask {
  day: number;
  task: string;
  resource?: string;
}

export interface WeekPlan {
  week: number;
  title: string;
  focus: string;
  tasks: DailyTask[];
  skills: string[];
}

export interface PreparationRoadmap {
  totalWeeks: number;
  targetRole: string;
  weeks: WeekPlan[];
  tips: string[];
}

// ─── Analysis Types ───────────────────────────────────────────────────────────

export type SupportedRole =
  | 'Data Analyst'
  | 'Python Developer'
  | 'Machine Learning Engineer'
  | 'AI Engineer'
  | 'Software Engineer'
  | 'Full Stack Developer'
  | 'UI/UX Designer'
  | 'DevOps Engineer';

export interface RoleSkills {
  description: string;
  requiredSkills: string[];
  recommendedSkills: string[];
}

export interface AnalysisResponse {
  id: string;
  userId: string;
  targetRole: string;
  resumeFileName: string;
  candidateName: string | null;
  candidateEmail: string | null;
  candidatePhone: string | null;
  education: Education[];
  experience: Experience[];
  projects: Project[];
  certifications: Certification[];
  extractedSkills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  readinessScore: number;
  candidateSummary: string | null;
  learningResources: LearningResource[];
  interviewQuestions: InterviewQuestions | null;
  preparationRoadmap: PreparationRoadmap | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export interface ApiError {
  success: false;
  message: string;
  statusCode: number;
  errors?: Record<string, string>;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}
