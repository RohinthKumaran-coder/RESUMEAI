import { randomUUID } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  password: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisRecord {
  id: string;
  userId: string;
  targetRole: string;
  resumeFileName: string;
  resumeText: string;
  candidateName: string | null;
  candidateEmail: string | null;
  candidatePhone: string | null;
  education: unknown[];
  experience: unknown[];
  projects: unknown[];
  certifications: unknown[];
  extractedSkills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  readinessScore: number;
  candidateSummary: string | null;
  learningResources: unknown[];
  interviewQuestions: unknown | null;
  preparationRoadmap: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── In-Memory Store ──────────────────────────────────────────────────────────

const users: Map<string, UserRecord> = new Map();
const analyses: Map<string, AnalysisRecord> = new Map();

// ─── User Operations ──────────────────────────────────────────────────────────

export const db = {
  user: {
    findByEmail: (email: string) =>
      [...users.values()].find((u) => u.email === email) ?? null,

    findById: (id: string) => users.get(id) ?? null,

    create: (data: { email: string; password: string; name?: string | null }): UserRecord => {
      const user: UserRecord = {
        id: randomUUID(),
        email: data.email,
        name: data.name ?? null,
        password: data.password,
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.set(user.id, user);
      return user;
    },
  },

  analysis: {
    create: (data: Omit<AnalysisRecord, 'id' | 'createdAt' | 'updatedAt'>): AnalysisRecord => {
      const record: AnalysisRecord = {
        ...data,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      analyses.set(record.id, record);
      return record;
    },

    findById: (id: string) => analyses.get(id) ?? null,

    findByUser: (userId: string): AnalysisRecord[] =>
      [...analyses.values()]
        .filter((a) => a.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),

    update: (id: string, data: Partial<AnalysisRecord>): AnalysisRecord | null => {
      const existing = analyses.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      analyses.set(id, updated);
      return updated;
    },

    delete: (id: string): boolean => analyses.delete(id),
  },
};