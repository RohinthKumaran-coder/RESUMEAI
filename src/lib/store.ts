import { randomUUID } from 'crypto';
import { kv } from '@vercel/kv';

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

// ─── Key helpers ──────────────────────────────────────────────────────────────
// user:{id}              → UserRecord
// user_email:{email}     → userId (index)
// analysis:{id}          → AnalysisRecord
// user_analyses:{userId} → string[] of analysisIds

const K = {
  user: (id: string) => `user:${id}`,
  userEmail: (email: string) => `user_email:${email.toLowerCase()}`,
  analysis: (id: string) => `analysis:${id}`,
  userAnalyses: (userId: string) => `user_analyses:${userId}`,
};

// ─── Serialization helpers ────────────────────────────────────────────────────
// KV stores JSON; Date objects need to survive JSON round-trips.

function hydrateUser(raw: unknown): UserRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as unknown as UserRecord & { createdAt: string; updatedAt: string };
  return { ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) };
}

function hydrateAnalysis(raw: unknown): AnalysisRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as unknown as AnalysisRecord & { createdAt: string; updatedAt: string };
  return { ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt) };
}

// ─── DB interface ─────────────────────────────────────────────────────────────

export const db = {
  user: {
    findByEmail: async (email: string): Promise<UserRecord | null> => {
      const userId = await kv.get<string>(K.userEmail(email));
      if (!userId) return null;
      const raw = await kv.get(K.user(userId));
      return hydrateUser(raw);
    },

    findById: async (id: string): Promise<UserRecord | null> => {
      const raw = await kv.get(K.user(id));
      return hydrateUser(raw);
    },

    create: async (data: { email: string; password: string; name?: string | null }): Promise<UserRecord> => {
      const user: UserRecord = {
        id: randomUUID(),
        email: data.email,
        name: data.name ?? null,
        password: data.password,
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await kv.set(K.user(user.id), JSON.stringify(user));
      await kv.set(K.userEmail(user.email), user.id);
      return user;
    },
  },

  analysis: {
    create: async (data: Omit<AnalysisRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<AnalysisRecord> => {
      const record: AnalysisRecord = {
        ...data,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await kv.set(K.analysis(record.id), JSON.stringify(record));
      // Add to user's analysis list
      const existing = await kv.get<string[]>(K.userAnalyses(record.userId)) ?? [];
      await kv.set(K.userAnalyses(record.userId), JSON.stringify([record.id, ...existing]));
      return record;
    },

    findById: async (id: string): Promise<AnalysisRecord | null> => {
      const raw = await kv.get(K.analysis(id));
      return hydrateAnalysis(raw);
    },

    findByUser: async (userId: string): Promise<AnalysisRecord[]> => {
      const ids = await kv.get<string[]>(K.userAnalyses(userId)) ?? [];
      const records = await Promise.all(ids.map((id) => kv.get(K.analysis(id))));
      return records
        .map(hydrateAnalysis)
        .filter((r): r is AnalysisRecord => r !== null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    update: async (id: string, data: Partial<AnalysisRecord>): Promise<AnalysisRecord | null> => {
      const raw = await kv.get(K.analysis(id));
      const existing = hydrateAnalysis(raw);
      if (!existing) return null;
      const updated: AnalysisRecord = { ...existing, ...data, updatedAt: new Date() };
      await kv.set(K.analysis(id), JSON.stringify(updated));
      return updated;
    },

    delete: async (id: string): Promise<boolean> => {
      const raw = await kv.get(K.analysis(id));
      const record = hydrateAnalysis(raw);
      if (!record) return false;
      await kv.del(K.analysis(id));
      // Remove from user's analysis list
      const ids = await kv.get<string[]>(K.userAnalyses(record.userId)) ?? [];
      await kv.set(K.userAnalyses(record.userId), JSON.stringify(ids.filter((i) => i !== id)));
      return true;
    },
  },
};