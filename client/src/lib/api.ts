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
    console.log('[api:analysisApi:create] Initiating analysis creation.');
    console.log(`[api:analysisApi:create] File info:`, {
      name: file.name,
      size: file.size,
      type: file.type
    });
    console.log(`[api:analysisApi:create] Parameters:`, {
      roles,
      customRole,
      targetCompany,
      jobDescription
    });

    // Try reading file content on the client side to avoid Android Content Provider permission issues.
    let safeFile: File = file;
    try {
      console.log('[api:analysisApi:create] Reading file locally to byte array...');
      const buffer = await file.arrayBuffer();
      console.log(`[api:analysisApi:create] Successfully read ${buffer.byteLength} bytes.`);
      const blob = new Blob([buffer], { type: file.type || 'application/octet-stream' });
      safeFile = new File([blob], file.name, { type: file.type || 'application/octet-stream' });
    } catch (readErr: any) {
      console.error('[api:analysisApi:create] Client-side file read failed:', readErr);
      throw new Error(`Failed to read resume file: ${readErr.message || 'Permission denied'}. Please re-select the file or use a local file instead of a cloud storage link.`);
    }

    const formData = new FormData();
    formData.append('resume', safeFile);
    formData.append('targetRoles', JSON.stringify(roles));
    if (customRole) formData.append('customRole', customRole);
    if (targetCompany) formData.append('targetCompany', targetCompany);
    if (jobDescription) formData.append('jobDescription', jobDescription);

    console.log('[api:analysisApi:create] Sending POST /analysis request via axios.');
    
    // CRITICAL BUG FIX: Remove manual 'Content-Type': 'multipart/form-data' header.
    // If manually set, Axios deletes the boundary boundary value parameters in the header,
    // which causes the server side to throw a parsing error or disconnect the request.
    const { data } = await api.post<{ success: boolean; data: Analysis }>('/analysis', formData);
    
    console.log('[api:analysisApi:create] POST /analysis success:', data);
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