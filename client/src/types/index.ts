export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
}

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

export type ResourceType = 'free' | 'paid' | 'certification' | 'practice';

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

export interface Analysis {
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

export type SupportedRole =
  | 'Data Analyst'
  | 'Python Developer'
  | 'Machine Learning Engineer'
  | 'AI Engineer'
  | 'Software Engineer'
  | 'Full Stack Developer'
  | 'UI/UX Designer'
  | 'DevOps Engineer';

export interface RoleInfo {
  id: SupportedRole;
  name: SupportedRole;
  description: string;
  requiredSkillsCount: number;
  skills: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}
