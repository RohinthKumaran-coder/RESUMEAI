import axios from 'axios';
import type { Analysis, AuthUser, RoleInfo } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('resumeiq_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('resumeiq_token');
      localStorage.removeItem('resumeiq_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: async (name: string, email: string, password: string) => {
    const { data } = await api.post<{ success: boolean; token: string; user: AuthUser }>(
      '/auth/register',
      { name, email, password }
    );
    return data;
  },
  login: async (email: string, password: string) => {
    const { data } = await api.post<{ success: boolean; token: string; user: AuthUser }>(
      '/auth/login',
      { email, password }
    );
    return data;
  },
  getMe: async () => {
    const { data } = await api.get<{ success: boolean; data: AuthUser }>('/auth/me');
    return data.data;
  },
};

// ── Analysis ──────────────────────────────────────────────────────────────────

export const analysisApi = {
  create: async (
    file: File,
    roles: string[],
    customRole?: string,
    targetCompany?: string,
    jobDescription?: string
  ) => {
    const formData = new FormData();
    formData.append('resume', file);
    formData.append('targetRoles', JSON.stringify(roles));
    if (customRole) formData.append('customRole', customRole);
    if (targetCompany) formData.append('targetCompany', targetCompany);
    if (jobDescription) formData.append('jobDescription', jobDescription);
    const { data } = await api.post<{ success: boolean; data: Analysis }>('/analysis', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  getOne: async (id: string) => {
    const { data } = await api.get<{ success: boolean; data: Analysis }>(`/analysis/${id}`);
    return data.data;
  },

  getAll: async () => {
    const { data } = await api.get<{ success: boolean; data: Analysis[] }>('/analysis');
    return data.data;
  },

  delete: async (id: string) => {
    await api.delete(`/analysis/${id}`);
  },

  generateQuestions: async (id: string) => {
    const { data } = await api.post<{ success: boolean; data: Analysis }>(
      `/analysis/${id}/generate-questions`
    );
    return data.data;
  },

  generateRoadmap: async (id: string) => {
    const { data } = await api.post<{ success: boolean; data: Analysis }>(
      `/analysis/${id}/generate-roadmap`
    );
    return data.data;
  },

  exportPDF: async (id: string): Promise<void> => {
    const token = localStorage.getItem('resumeiq_token');
    const url = `/api/analysis/${id}/export/pdf`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PDF export failed (${res.status}): ${text}`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.setAttribute('download', `resumeiq-report-${id.slice(0, 8)}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  },

  exportCSV: async (id: string): Promise<void> => {
    const token = localStorage.getItem('resumeiq_token');
    const url = `/api/analysis/${id}/export/csv`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`CSV export failed (${res.status}): ${text}`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.setAttribute('download', `resumeiq-skills-${id.slice(0, 8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  },
};

// ── Roles ─────────────────────────────────────────────────────────────────────

export const rolesApi = {
  getAll: async () => {
    const { data } = await api.get<{ success: boolean; data: RoleInfo[] }>('/roles');
    return data.data;
  },
};

export default api;