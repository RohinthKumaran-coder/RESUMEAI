'use client';

import { useState, useEffect, useCallback, useRef, type ChangeEvent, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit, FileText, Target, BookOpen, MessageSquare, TrendingUp,
  Download, CheckCircle, ArrowRight, Sparkles, Zap, Shield, Upload, Loader2,
  LogOut, Moon, Sun, ChevronDown, Trash2, Eye, BarChart3, Calendar, Award,
  AlertCircle, Clock, ExternalLink, ChevronLeft,
} from 'lucide-react';
import { create } from 'zustand';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AuthUser { id: string; email: string; name?: string | null; avatar?: string | null; createdAt?: string; }
interface Education { institution: string; degree: string; field: string; startYear: string; endYear: string; gpa?: string; }
interface Experience { company: string; role: string; startDate: string; endDate: string; description: string; technologies: string[]; }
interface Project { name: string; description: string; technologies: string[]; url?: string; }
interface Certification { name: string; issuer: string; year: string; }
interface InterviewQuestion { question: string; category: string; difficulty: string; hint: string; }
interface InterviewQuestions { technical: InterviewQuestion[]; project: InterviewQuestion[]; scenario: InterviewQuestion[]; hr: InterviewQuestion[]; }
interface LearningResource { skill: string; name: string; url: string; platform: string; type: string; description: string; estimatedHours: number; isCertification: boolean; }
interface WeekPlan { week: number; title: string; focus: string; tasks: { day: number; task: string; resource?: string }[]; skills: string[]; }
interface PreparationRoadmap { totalWeeks: number; targetRole: string; weeks: WeekPlan[]; tips: string[]; }
interface Analysis {
  id: string; userId: string; targetRole: string; resumeFileName: string;
  candidateName: string | null; candidateEmail: string | null; candidatePhone: string | null;
  education: Education[]; experience: Experience[]; projects: Project[]; certifications: Certification[];
  extractedSkills: string[]; matchedSkills: string[]; missingSkills: string[];
  readinessScore: number;
  // candidateSummary may arrive as a plain string OR as an object like {summary, expectedSalary}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  candidateSummary: any;
  learningResources: LearningResource[]; interviewQuestions: InterviewQuestions | null;
  preparationRoadmap: PreparationRoadmap | null; createdAt: string; updatedAt: string;
}
interface RoleInfo { id: string; name: string; description: string; requiredSkillsCount: number; skills: string[]; }

type Screen = 'landing' | 'login' | 'register' | 'dashboard' | 'analyze' | 'detail';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Safely coerce candidateSummary (may be string | object | null) to a string or null.
 * Handles the common AI mis-shape: { summary: "...", expectedSalary: "..." }
 */
function normalizeSummary(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    // Prefer .summary, fall back to any other string value
    for (const key of ['summary', 'text', 'content', 'description']) {
      if (typeof obj[key] === 'string' && (obj[key] as string).trim()) {
        return (obj[key] as string).trim();
      }
    }
    // Last resort: JSON
    return JSON.stringify(raw);
  }
  return String(raw).trim() || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZUSTAND STORE
// ═══════════════════════════════════════════════════════════════════════════════

interface AppState {
  screen: Screen;
  token: string | null;
  user: AuthUser | null;
  analyses: Analysis[];
  activeAnalysis: Analysis | null;
  roles: RoleInfo[];
  dark: boolean;
  toast: { message: string; type: 'success' | 'error' } | null;
  go: (screen: Screen) => void;
  setToast: (t: AppState['toast']) => void;
  setToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  setAnalyses: (a: Analysis[]) => void;
  setActiveAnalysis: (a: Analysis | null) => void;
  setRoles: (r: RoleInfo[]) => void;
  toggleDark: () => void;
  logout: () => void;
}

const useStore = create<AppState>((set) => ({
  screen: 'landing', token: null, user: null, analyses: [], activeAnalysis: null, roles: [], dark: true, toast: null,
  go: (screen) => set({ screen }),
  setToast: (toast) => { set({ toast }); if (toast) setTimeout(() => set({ toast: null }), 4000); },
  setToken: (token) => { set({ token }); if (token) localStorage.setItem('token', token); else localStorage.removeItem('token'); },
  setUser: (user) => set({ user }),
  setAnalyses: (analyses) => set({ analyses }),
  setActiveAnalysis: (activeAnalysis) => set({ activeAnalysis }),
  setRoles: (roles) => set({ roles }),
  toggleDark: () => set((s) => {
    const dark = !s.dark;
    document.documentElement.classList.toggle('dark', dark);
    return { dark };
  }),
  logout: () => { localStorage.removeItem('token'); set({ token: null, user: null, analyses: [], activeAnalysis: null, screen: 'landing' }); },
}));

// ═══════════════════════════════════════════════════════════════════════════════
// API HELPER
// ═══════════════════════════════════════════════════════════════════════════════

async function api(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, { ...opts, headers: { ...headers, ...opts.headers as Record<string, string> } });
  if (path.includes('/export/pdf')) return res;
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function Page() {
  const { screen, token, dark, toast, go, setToken, setUser, setToast, setAnalyses, setRoles } = useStore();

  useEffect(() => {
    const saved = localStorage.getItem('token');
    if (saved) {
      setToken(saved);
      api('/auth/me').then((d) => {
        if (d.success) { setUser(d.data); go('dashboard'); }
        else { localStorage.removeItem('token'); setToken(null); }
      }).catch(() => { localStorage.removeItem('token'); setToken(null); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) return;
    api('/analysis').then((d) => { if (d.success) setAnalyses(d.data); });
    api('/roles').then((d) => { if (d.success) setRoles(d.data); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className={dark ? 'dark' : ''}>
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.div key={screen} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
          {screen === 'landing' && <Landing />}
          {screen === 'login' && <AuthForm mode="login" />}
          {screen === 'register' && <AuthForm mode="register" />}
          {screen === 'dashboard' && <Dashboard />}
          {screen === 'analyze' && <Analyze />}
          {screen === 'detail' && <AnalysisDetail />}
        </motion.div>
      </AnimatePresence>
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════════════════════

function Navbar() {
  const { user, dark, go, toggleDark, logout } = useStore();
  return (
    <nav className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <button onClick={() => go(user ? 'dashboard' : 'landing')} className="flex items-center gap-2 hover:opacity-80 transition">
          <BrainCircuit className="w-7 h-7 text-primary" />
          <span className="text-xl font-black gradient-text">ResumeIQ</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={toggleDark} className="p-2 rounded-lg hover:bg-muted transition" title="Toggle theme">
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {user ? (
            <>
              <button onClick={() => go('analyze')} className="px-4 py-2 text-sm font-medium rounded-lg gradient-primary text-white hover:opacity-90 transition">
                <Zap className="w-4 h-4 inline mr-1" /> Analyze
              </button>
              <button onClick={() => go('dashboard')} className="px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition">Dashboard</button>
              <button onClick={logout} className="p-2 rounded-lg hover:bg-muted transition text-muted-foreground" title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => go('login')} className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted transition">Login</button>
              <button onClick={() => go('register')} className="px-4 py-2 text-sm font-medium rounded-lg gradient-primary text-white hover:opacity-90 transition">Sign Up</button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const HERO_ROLES = ['Data Analyst', 'ML Engineer', 'AI Engineer', 'Full Stack Dev', 'DevOps Engineer', 'UI/UX Designer'];
const FEATURES = [
  { icon: FileText, title: 'Resume Analysis', desc: 'AI extracts skills, education, and experience from your PDF.', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { icon: Target, title: 'Skill Gap Detection', desc: 'Compare skills against role requirements with a readiness score.', color: 'text-teal-500', bg: 'bg-teal-500/10' },
  { icon: BookOpen, title: 'Learning Paths', desc: 'Curated courses, YouTube resources, and certifications.', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { icon: MessageSquare, title: 'Interview Prep', desc: '25 personalized questions across 4 categories.', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { icon: TrendingUp, title: '30-Day Roadmap', desc: 'Week-by-week preparation plan tailored to your gaps.', color: 'text-rose-500', bg: 'bg-rose-500/10' },
  { icon: Download, title: 'Export Reports', desc: 'Download analysis as PDF report or CSV.', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

function Landing() {
  const { user, go } = useStore();
  const [roleIdx, setRoleIdx] = useState(0);
  useEffect(() => { const i = setInterval(() => setRoleIdx((n) => (n + 1) % HERO_ROLES.length), 2000); return () => clearInterval(i); }, []);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero min-h-screen flex items-center">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-white/90 text-sm font-medium">AI-Powered Career Intelligence</span>
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-tight mb-6">
                Land Your Dream
                <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400">
                  {HERO_ROLES[roleIdx]}
                </span>
                <span className="block text-4xl sm:text-5xl font-bold text-white/80 mt-2">Role</span>
              </h1>
              <p className="text-lg sm:text-xl text-white/70 mb-10 leading-relaxed max-w-xl">
                Upload your resume, get an AI-powered skill gap analysis, personalized learning resources,
                and tailored interview questions — all in under 60 seconds.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <button onClick={() => go(user ? 'analyze' : 'register')}
                  className="group px-8 py-4 text-lg font-bold rounded-xl gradient-primary text-white shadow-2xl shadow-blue-500/30 hover:opacity-90 transition flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5 group-hover:animate-bounce" /> Analyze My Resume Free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
              <div className="flex items-center gap-6">
                {['No credit card', 'PDF upload', 'Claude AI powered'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-white/60 text-sm">
                    <CheckCircle className="w-4 h-4 text-teal-400 shrink-0" /> <span>{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="hidden lg:block">
              <div className="relative animate-float">
                <div className="glass rounded-2xl p-6 border border-white/20 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <div><p className="text-white/60 text-sm">Readiness Score</p><p className="text-3xl font-black text-white">78%</p></div>
                    <div className="w-20 h-20 relative">
                      <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#14B8A6" strokeWidth="3" strokeDasharray="78, 100" strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">78%</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {['Python', 'SQL', 'TensorFlow', 'Docker'].map((s) => (<span key={s} className="px-2.5 py-1 bg-teal-500/20 text-teal-300 rounded-full text-xs font-medium">✓ {s}</span>))}
                    {['MLOps', 'K8s'].map((s) => (<span key={s} className="px-2.5 py-1 bg-red-500/20 text-red-300 rounded-full text-xs font-medium">✗ {s}</span>))}
                  </div>
                  <div className="text-xs text-white/40 text-center">AI Analysis for: Machine Learning Engineer</div>
                </div>
                <div className="absolute -top-4 -right-4 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse-glow">🎯 25 Interview Qs</div>
                <div className="absolute -bottom-4 -left-4 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">📚 30-Day Roadmap</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-muted/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[{ v: '8+', l: 'Supported Roles' }, { v: '25', l: 'Interview Questions' }, { v: '30', l: 'Day Roadmap' }, { v: '100%', l: 'AI Powered' }].map((s, i) => (
            <motion.div key={s.l} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }} className="text-center">
              <div className="text-4xl font-black gradient-text mb-2">{s.v}</div>
              <div className="text-muted-foreground text-sm font-medium">{s.l}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black mb-4">Everything you need to <span className="gradient-text">get hired</span></h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">ResumeIQ combines AI-powered resume parsing, skill analysis, and personalized coaching.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} viewport={{ once: true }}
                className="card-hover p-6 rounded-xl border border-border bg-card hover:border-blue-500/30">
                <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="gradient-primary rounded-3xl p-12 shadow-2xl shadow-blue-500/30">
            <Shield className="w-12 h-12 text-white/80 mx-auto mb-6" />
            <h2 className="text-4xl font-black text-white mb-4">Ready to land your dream role?</h2>
            <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto">Join job seekers who&apos;ve improved their career readiness with ResumeIQ.</p>
            <button onClick={() => go(user ? 'analyze' : 'register')}
              className="px-8 py-4 border-2 border-white/40 text-white rounded-xl font-bold hover:bg-white/20 transition flex items-center gap-2 mx-auto">
              <Zap className="w-5 h-5" /> Start Free Analysis <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-blue-600" /><span className="font-bold gradient-text">ResumeIQ</span></div>
          <p className="text-muted-foreground text-sm">© {new Date().getFullYear()} ResumeIQ. AI-Powered Career Preparation.</p>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH FORM
// ═══════════════════════════════════════════════════════════════════════════════

function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { go, setToken, setUser, setToast } = useStore();
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const body = mode === 'register' ? form : { email: form.email, password: form.password };
      const data = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) });
      if (data.success) {
        setToken(data.token);
        setUser(data.user);
        setToast({ message: mode === 'register' ? 'Account created!' : 'Welcome back!', type: 'success' });
        go('dashboard');
      } else { setError(data.message || 'Something went wrong.'); }
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 rounded-2xl border border-border bg-card shadow-2xl">
        <div className="text-center mb-8">
          <BrainCircuit className="w-10 h-10 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-black">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
          <p className="text-muted-foreground text-sm mt-1">{mode === 'login' ? 'Sign in to your account' : 'Start your career journey'}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="John Doe" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="••••••••" />
          </div>
          {error && <p className="text-red-500 text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-lg gradient-primary text-white font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => go(mode === 'login' ? 'register' : 'login')} className="text-primary font-semibold hover:underline">
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function Dashboard() {
  const { analyses, go, setActiveAnalysis, setAnalyses, setToast } = useStore();

  const handleDelete = async (id: string) => {
    const data = await api(`/analysis/${id}`, { method: 'DELETE' });
    if (data.success) {
      setAnalyses(analyses.filter((a) => a.id !== id));
      setToast({ message: 'Analysis deleted.', type: 'success' });
    }
  };

  const viewDetail = (a: Analysis) => { setActiveAnalysis(a); go('detail'); };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black">Dashboard</h1>
          <p className="text-muted-foreground">Your resume analyses</p>
        </div>
        <button onClick={() => go('analyze')} className="px-6 py-3 rounded-xl gradient-primary text-white font-bold hover:opacity-90 transition flex items-center gap-2">
          <Zap className="w-5 h-5" /> New Analysis
        </button>
      </div>

      {analyses.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
          <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">No analyses yet</h3>
          <p className="text-muted-foreground mb-6">Upload your resume and select a target role to get started.</p>
          <button onClick={() => go('analyze')} className="px-6 py-3 rounded-xl gradient-primary text-white font-bold hover:opacity-90 transition">
            <Zap className="w-4 h-4 inline mr-2" /> Analyze Resume
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {analyses.map((a) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="card-hover rounded-xl border border-border bg-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg">{a.candidateName || 'Resume'}</h3>
                  <p className="text-sm text-muted-foreground">{a.targetRole}</p>
                </div>
                <div className={`text-2xl font-black ${a.readinessScore >= 70 ? 'text-emerald-500' : a.readinessScore >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                  {Math.round(a.readinessScore)}%
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {a.matchedSkills.slice(0, 3).map((s) => (<span key={s} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full text-xs">✓ {s}</span>))}
                {a.missingSkills.slice(0, 2).map((s) => (<span key={s} className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded-full text-xs">✗ {s}</span>))}
              </div>
              <div className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {new Date(a.createdAt).toLocaleDateString()}
              </div>
              <div className="flex gap-2">
                <button onClick={() => viewDetail(a)} className="flex-1 py-2 rounded-lg bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition flex items-center justify-center gap-1">
                  <Eye className="w-4 h-4" /> View
                </button>
                <button onClick={() => handleDelete(a.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYZE PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function Analyze() {
  const { roles, go, setActiveAnalysis, setToast, setAnalyses, analyses } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [useCustomRole, setUseCustomRole] = useState(false);
  const [customRole, setCustomRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'jpg', 'jpeg', 'png'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const validateFile = (f: File): string | null => {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) return `Unsupported file type. Please upload: ${ALLOWED_EXTENSIONS.join(', ')}`;
    if (f.size > MAX_FILE_SIZE) return 'File too large. Maximum size is 10MB.';
    return null;
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = validateFile(f);
    if (err) { setToast({ message: err, type: 'error' }); e.target.value = ''; return; }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const err = validateFile(f);
    if (err) { setToast({ message: err, type: 'error' }); return; }
    setFile(f);
  };

  const toggleRole = (id: string) => {
    setSelectedRoles((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]);
  };

  const hasTarget = selectedRoles.length > 0 || (useCustomRole && customRole.trim().length > 0);

  const handleSubmit = async () => {
    if (!file || !hasTarget) { setToast({ message: 'Please select a file and at least one target role.', type: 'error' }); return; }
    setLoading(true);
    setProgress('Uploading resume...');
    try {
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('targetRoles', JSON.stringify(selectedRoles));
      if (useCustomRole && customRole.trim()) formData.append('customRole', customRole.trim());
      if (targetCompany.trim()) formData.append('targetCompany', targetCompany.trim());
      if (jobDescription.trim()) formData.append('jobDescription', jobDescription.trim());
      setProgress('AI is analyzing your resume...');
      const data = await api('/analysis', { method: 'POST', body: formData });
      if (data.success) {
        setActiveAnalysis(data.data);
        setAnalyses([data.data, ...analyses]);
        setToast({ message: 'Analysis complete!', type: 'success' });
        go('detail');
      } else {
        setToast({ message: data.message || 'Analysis failed.', type: 'error' });
      }
    } catch { setToast({ message: 'Network error.', type: 'error' }); }
    setLoading(false); setProgress('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-black mb-2">Analyze Your Resume</h1>
        <p className="text-muted-foreground">Upload your resume and tell us what you&apos;re targeting</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Upload */}
        <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 transition cursor-pointer"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png" onChange={handleFile} className="hidden" />
          {file ? (
            <div>
              <FileText className="w-16 h-16 text-primary mx-auto mb-4" />
              <p className="font-bold text-lg">{file.name}</p>
              <p className="text-muted-foreground text-sm mt-1">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          ) : (
            <div>
              <Upload className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-bold text-lg">Drop your resume here</p>
              <p className="text-muted-foreground text-sm mt-1">or click to browse</p>
              <p className="text-muted-foreground text-xs mt-2">PDF, DOCX, TXT, JPG, PNG · max 10MB</p>
            </div>
          )}
        </div>

        {/* Role selection — multi-select + custom */}
        <div>
          <h3 className="font-bold text-lg mb-4">Select Target Role(s)</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
            {roles.map((r) => {
              const active = selectedRoles.includes(r.id);
              return (
                <button key={r.id} onClick={() => toggleRole(r.id)} type="button"
                  className={`w-full text-left p-4 rounded-xl border transition ${active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-bold">{r.name}</div>
                    {active && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                  <div className="text-muted-foreground text-xs mt-0.5">{r.description}</div>
                  <div className="text-xs text-primary mt-1">{r.requiredSkillsCount} required skills</div>
                </button>
              );
            })}
            <button type="button" onClick={() => setUseCustomRole((v) => !v)}
              className={`w-full text-left p-4 rounded-xl border transition ${useCustomRole ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'}`}>
              <div className="font-bold">Other — type your own role</div>
              <div className="text-muted-foreground text-xs mt-0.5">Not seeing your target role above? Specify it directly.</div>
            </button>
            {useCustomRole && (
              <input type="text" value={customRole} onChange={(e) => setCustomRole(e.target.value)}
                placeholder="e.g. Site Reliability Engineer"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
            )}
          </div>
        </div>
      </div>

      {/* Company + Job Description — optional, sharpens the analysis */}
      <div className="mt-8 grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1.5">Target Company <span className="text-muted-foreground font-normal">(optional)</span></label>
          <input type="text" value={targetCompany} onChange={(e) => setTargetCompany(e.target.value)}
            placeholder="e.g. Google, Zoho, a startup..."
            className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Job Description <span className="text-muted-foreground font-normal">(optional, improves accuracy)</span></label>
          <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={1}
            placeholder="Paste the job posting here for a more precise skill-gap match"
            className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
            onFocus={(e) => { e.target.rows = 5; }} />
        </div>
      </div>

      <div className="mt-8 text-center">
        <button onClick={handleSubmit} disabled={loading || !file || !hasTarget}
          className="px-10 py-4 rounded-xl gradient-primary text-white font-bold text-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-3 mx-auto">
          {loading ? <><Loader2 className="w-6 h-6 animate-spin" />{progress}</> : <><Zap className="w-6 h-6" /> Analyze Resume</>}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYSIS DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════════════════

function AnalysisDetail() {
  const { activeAnalysis: a, go, setActiveAnalysis, setToast } = useStore();
  const [tab, setTab] = useState<'overview' | 'skills' | 'learn' | 'interview' | 'roadmap'>('overview');
  const [genLoading, setGenLoading] = useState('');

  if (!a) { go('dashboard'); return null; }

  // ── KEY FIX ─────────────────────────────────────────────────────────────────
  // AI sometimes returns candidateSummary as { summary: "...", expectedSalary: "..." }
  // instead of a plain string. Normalize it before any render.
  const candidateSummary = normalizeSummary(a.candidateSummary);
  // ────────────────────────────────────────────────────────────────────────────

  const score = Math.round(a.readinessScore);
  const scoreColor = score >= 70 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-red-500';

  const handleExportPDF = async () => {
    const res = await api(`/analysis/${a.id}/export/pdf`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `resumeiq-report.pdf`; link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportCSV = async () => {
    const res = await fetch(`/api/analysis/${a.id}/export/csv`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `resumeiq-skills.csv`; link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleGenQuestions = async () => {
    setGenLoading('questions');
    const data = await api(`/analysis/${a.id}/generate-questions`, { method: 'POST' });
    if (data.success) { setActiveAnalysis(data.data); setToast({ message: 'Interview questions generated!', type: 'success' }); }
    setGenLoading('');
  };

  const handleGenRoadmap = async () => {
    setGenLoading('roadmap');
    const data = await api(`/analysis/${a.id}/generate-roadmap`, { method: 'POST' });
    if (data.success) { setActiveAnalysis(data.data); setToast({ message: 'Roadmap generated!', type: 'success' }); }
    setGenLoading('');
  };

  const TABS = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'skills' as const, label: 'Skills', icon: Target },
    { id: 'learn' as const, label: 'Learning', icon: BookOpen },
    { id: 'interview' as const, label: 'Interview', icon: MessageSquare },
    { id: 'roadmap' as const, label: 'Roadmap', icon: Calendar },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => go('dashboard')} className="p-2 rounded-lg hover:bg-muted transition"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-black">{a.candidateName || 'Resume Analysis'}</h1>
          <p className="text-muted-foreground text-sm">{a.targetRole} • {new Date(a.createdAt).toLocaleDateString()}</p>
        </div>
        <div className={`text-4xl font-black ${scoreColor}`}>{score}%</div>
      </div>

      {/* Export buttons */}
      <div className="flex gap-3 mb-6">
        <button onClick={handleExportPDF} className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition text-sm font-medium flex items-center gap-2">
          <Download className="w-4 h-4" /> PDF
        </button>
        <button onClick={handleExportCSV} className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition text-sm font-medium flex items-center gap-2">
          <Download className="w-4 h-4" /> CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition whitespace-nowrap ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Candidate Profile */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <h3 className="text-xs font-black tracking-widest uppercase text-muted-foreground">Candidate Profile</h3>
            </div>

            {(() => {
              const totalYears = (a.experience ?? []).reduce((acc, exp) => {
                const start = new Date(exp.startDate).getFullYear();
                const end = exp.endDate?.toLowerCase().includes('present')
                  ? new Date().getFullYear()
                  : new Date(exp.endDate).getFullYear();
                return acc + (isNaN(end - start) ? 0 : Math.max(0, end - start));
              }, 0);
              const level = totalYears === 0 ? 'Fresher' : totalYears <= 2 ? 'Junior' : totalYears <= 5 ? 'Mid-Level' : 'Senior';
              const eduStr = (a.education ?? []).map(e => `${e.degree} ${e.field}, ${e.institution}, ${e.startYear}–${e.endYear}`).join('; ') || 'N/A';
              const expStr = totalYears === 0 ? '0 years (Fresher)' : `${totalYears} year${totalYears > 1 ? 's' : ''}`;
              const projectCount = (a.projects ?? []).length;

              const rows = [
                { label: 'Name', value: a.candidateName || 'N/A', type: 'text' },
                { label: 'Target Role', value: a.targetRole, type: 'text' },
                { label: 'Education', value: eduStr, type: 'text' },
                { label: 'Experience', value: expStr, type: 'text' },
                { label: 'Projects', value: projectCount > 0 ? `${projectCount} project${projectCount > 1 ? 's' : ''} listed` : 'None', type: 'text' },
                { label: 'Certifications', value: null, type: 'certs' },
                { label: 'Skills', value: `${a.extractedSkills.length} skills detected`, type: 'text' },
                { label: 'Level', value: level, type: 'text' },
              ];

              return rows.map(({ label, value, type }) => (
                <div key={label} className={`flex py-3 border-b border-border last:border-0 ${type === 'certs' ? 'flex-col gap-2' : 'items-start gap-4'}`}>
                  <span className="text-[10px] font-black tracking-widest uppercase text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
                  {type === 'certs' ? (
                    <div className="flex flex-wrap gap-2">
                      {(a.certifications ?? []).length > 0
                        ? a.certifications.map((c, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            🏅 {c.name}{c.issuer ? ` — ${c.issuer}` : ''}
                          </span>
                        ))
                        : <span className="text-sm text-muted-foreground">None</span>
                      }
                    </div>
                  ) : (
                    <span className="text-sm font-medium flex-1">{value}</span>
                  )}
                </div>
              ));
            })()}

            {/* ── FIXED: use normalized candidateSummary string, never the raw object ── */}
            {candidateSummary && (
              <p className="text-sm text-muted-foreground mt-4 leading-relaxed border-t border-border pt-4">
                {candidateSummary}
              </p>
            )}
          </div>

          {/* Score card */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-bold text-lg mb-4">Readiness Score</h3>
            <div className="flex items-center gap-6 mb-6">
              <div className="w-28 h-28 relative">
                <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" className="text-muted" strokeWidth="2.5" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none"
                    stroke={score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444'} strokeWidth="2.5" strokeDasharray={`${score}, 100`} strokeLinecap="round" />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-2xl font-black ${scoreColor}`}>{score}%</span>
              </div>
              <div>
                <p className="text-sm"><span className="text-emerald-500 font-bold">{a.matchedSkills.length}</span> matched</p>
                <p className="text-sm"><span className="text-red-500 font-bold">{a.missingSkills.length}</span> missing</p>
                <p className="text-sm text-muted-foreground">{a.matchedSkills.length + a.missingSkills.length} total required</p>
              </div>
            </div>
          </div>

          {/* Education */}
          {(a.education?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-primary" /> Education</h3>
              {a.education.map((e, i) => (
                <div key={i} className="py-2 border-b border-border last:border-0">
                  <p className="font-medium">{e.degree} in {e.field}</p>
                  <p className="text-sm text-muted-foreground">{e.institution} • {e.startYear}–{e.endYear}</p>
                </div>
              ))}
            </div>
          )}

          {/* Experience */}
          {(a.experience?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Experience</h3>
              {a.experience.map((e, i) => (
                <div key={i} className="py-2 border-b border-border last:border-0">
                  <p className="font-medium">{e.role}</p>
                  <p className="text-sm text-muted-foreground">{e.company} • {e.startDate}–{e.endDate}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SKILLS TAB ───────────────────────────────────────────────────────── */}
      {tab === 'skills' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-bold text-lg mb-4 text-emerald-500">✓ Matched Skills ({a.matchedSkills.length})</h3>
            <div className="flex flex-wrap gap-2">
              {a.matchedSkills.map((s) => (<span key={s} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg text-sm font-medium">{s}</span>))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-bold text-lg mb-4 text-red-500">✗ Missing Skills ({a.missingSkills.length})</h3>
            <div className="flex flex-wrap gap-2">
              {a.missingSkills.map((s) => (<span key={s} className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg text-sm font-medium">{s}</span>))}
            </div>
          </div>
          <div className="md:col-span-2 rounded-xl border border-border bg-card p-6">
            <h3 className="font-bold text-lg mb-4 text-blue-500">All Extracted Skills ({a.extractedSkills.length})</h3>
            <div className="flex flex-wrap gap-2">
              {a.extractedSkills.map((s) => (<span key={s} className="px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-lg text-sm font-medium">{s}</span>))}
            </div>
          </div>
        </div>
      )}

      {/* ── LEARNING TAB ─────────────────────────────────────────────────────── */}
      {tab === 'learn' && (
        <div>
          {(a.learningResources?.length ?? 0) > 0 ? (
            <div className="grid md:grid-cols-2 gap-4">
              {a.learningResources.map((r, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5 card-hover">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r.skill}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.type === 'free' ? 'bg-emerald-500/10 text-emerald-500' : r.type === 'paid' ? 'bg-amber-500/10 text-amber-500' : 'bg-purple-500/10 text-purple-500'}`}>
                      {r.type.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="font-bold mb-1">{r.name}</h4>
                  <p className="text-muted-foreground text-sm mb-2">{r.platform} • {r.estimatedHours}h</p>
                  <p className="text-sm text-muted-foreground mb-3">{r.description}</p>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm font-medium flex items-center gap-1 hover:underline">
                    <ExternalLink className="w-3 h-3" /> View Resource
                  </a>
                </div>
              ))}
            </div>
          ) : <p className="text-muted-foreground text-center py-12">No learning resources available.</p>}
        </div>
      )}

      {/* ── INTERVIEW TAB ────────────────────────────────────────────────────── */}
      {tab === 'interview' && (
        <div>
          {a.interviewQuestions ? (
            <div className="space-y-6">
              {(['technical', 'project', 'scenario', 'hr'] as const).map((cat) => {
                const qs = a.interviewQuestions![cat];
                if (!qs?.length) return null;
                const colors: Record<string, string> = {
                  technical: 'text-blue-500 border-blue-500/20',
                  project: 'text-teal-500 border-teal-500/20',
                  scenario: 'text-amber-500 border-amber-500/20',
                  hr: 'text-purple-500 border-purple-500/20',
                };
                return (
                  <div key={cat}>
                    <h3 className={`font-bold text-lg mb-3 capitalize ${colors[cat].split(' ')[0]}`}>{cat} Questions ({qs.length})</h3>
                    <div className="space-y-3">
                      {qs.map((q, i) => (
                        <div key={i} className={`rounded-xl border bg-card p-4 ${colors[cat].split(' ')[1]}`}>
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-medium text-sm flex-1">Q{i + 1}. {q.question}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ml-2 shrink-0 ${q.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-500' : q.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}>
                              {q.difficulty}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">💡 {q.hint}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No interview questions yet</h3>
              <button onClick={handleGenQuestions} disabled={genLoading === 'questions'}
                className="px-6 py-3 rounded-xl gradient-primary text-white font-bold hover:opacity-90 transition flex items-center gap-2 mx-auto disabled:opacity-50">
                {genLoading === 'questions' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} Generate Questions
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ROADMAP TAB ──────────────────────────────────────────────────────── */}
      {tab === 'roadmap' && (
        <div>
          {a.preparationRoadmap ? (
            <div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {a.preparationRoadmap.weeks.map((w) => (
                  <div key={w.week} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-white text-sm font-bold">{w.week}</div>
                      <h4 className="font-bold text-sm">{w.title}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{w.focus}</p>
                    <div className="space-y-1.5">
                      {w.tasks.map((t, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-bold">D{t.day}</div>
                          <span>{t.task}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {w.skills.map((s) => (<span key={s} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium">{s}</span>))}
                    </div>
                  </div>
                ))}
              </div>
              {(a.preparationRoadmap.tips?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-border bg-card p-6">
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500" /> Tips for Success</h3>
                  <ul className="space-y-2">
                    {a.preparationRoadmap.tips.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No roadmap yet</h3>
              <button onClick={handleGenRoadmap} disabled={genLoading === 'roadmap'}
                className="px-6 py-3 rounded-xl gradient-primary text-white font-bold hover:opacity-90 transition flex items-center gap-2 mx-auto disabled:opacity-50">
                {genLoading === 'roadmap' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />} Generate Roadmap
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}