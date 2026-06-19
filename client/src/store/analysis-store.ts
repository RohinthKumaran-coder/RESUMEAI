import { create } from 'zustand';
import { analysisApi } from '../lib/api';
import type { Analysis } from '../types';

interface AnalysisState {
  analyses: Analysis[];
  currentAnalysis: Analysis | null;
  isLoading: boolean;
  isCreating: boolean;
  creatingStep: string;
  error: string | null;

  createAnalysis: (file: File, targetRole: string) => Promise<Analysis>;
  fetchAnalysis: (id: string) => Promise<void>;
  fetchAnalyses: () => Promise<void>;
  deleteAnalysis: (id: string) => Promise<void>;
  generateQuestions: (id: string) => Promise<void>;
  generateRoadmap: (id: string) => Promise<void>;
  setCurrentAnalysis: (analysis: Analysis | null) => void;
  clearError: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  analyses: [],
  currentAnalysis: null,
  isLoading: false,
  isCreating: false,
  creatingStep: '',
  error: null,

  createAnalysis: async (file, targetRole) => {
    set({ isCreating: true, error: null, creatingStep: 'Uploading resume...' });
    try {
      set({ creatingStep: 'Parsing PDF content...' });
      await new Promise((r) => setTimeout(r, 500));
      set({ creatingStep: 'Analyzing with AI...' });
      const analysis = await analysisApi.create(file, targetRole);
      set((state) => ({
        analyses: [analysis, ...state.analyses],
        currentAnalysis: analysis,
        isCreating: false,
        creatingStep: '',
      }));
      return analysis;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Analysis failed';
      set({ error: msg, isCreating: false, creatingStep: '' });
      throw new Error(msg);
    }
  },

  fetchAnalysis: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const analysis = await analysisApi.getOne(id);
      set({ currentAnalysis: analysis, isLoading: false });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to load analysis';
      set({ error: msg, isLoading: false });
    }
  },

  fetchAnalyses: async () => {
    set({ isLoading: true, error: null });
    try {
      const analyses = await analysisApi.getAll();
      set({ analyses, isLoading: false });
    } catch {
      set({ error: 'Failed to load analyses', isLoading: false });
    }
  },

  deleteAnalysis: async (id) => {
    try {
      await analysisApi.delete(id);
      set((state) => ({
        analyses: state.analyses.filter((a) => a.id !== id),
        currentAnalysis: state.currentAnalysis?.id === id ? null : state.currentAnalysis,
      }));
    } catch {
      set({ error: 'Failed to delete analysis' });
    }
  },

  generateQuestions: async (id) => {
    set({ isLoading: true });
    try {
      const updated = await analysisApi.generateQuestions(id);
      set((state) => ({
        currentAnalysis: updated,
        analyses: state.analyses.map((a) => (a.id === id ? updated : a)),
        isLoading: false,
      }));
    } catch {
      set({ error: 'Failed to generate questions', isLoading: false });
    }
  },

  generateRoadmap: async (id) => {
    set({ isLoading: true });
    try {
      const updated = await analysisApi.generateRoadmap(id);
      set((state) => ({
        currentAnalysis: updated,
        analyses: state.analyses.map((a) => (a.id === id ? updated : a)),
        isLoading: false,
      }));
    } catch {
      set({ error: 'Failed to generate roadmap', isLoading: false });
    }
  },

  setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),
  clearError: () => set({ error: null }),
}));
