import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Download, FileSpreadsheet, RefreshCcw, Loader2,
  User, GraduationCap, Briefcase, FolderGit2, Award, Brain,
  CheckCircle, XCircle, Lightbulb, ExternalLink, Calendar,
  ChevronDown, ChevronUp, BookOpen, Target, MessageSquare, Users
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Navbar } from '@/components/layout/Navbar';
import { useAnalysisStore } from '@/store/analysis-store';
import { analysisApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { InterviewQuestion, LearningResource, WeekPlan } from '@/types';

// ─── Readiness Score Gauge ────────────────────────────────────────────────────
function ReadinessGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(score)));
  const color = pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444';
  const label = pct >= 70 ? 'STRONG' : pct >= 40 ? 'MODERATE' : 'NEEDS WORK';
  const radius = 70;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
          <circle
            cx="80" cy="80" r={radius}
            fill="none" stroke={color} strokeWidth="12"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-black" style={{ color }}>{pct}%</span>
          <span className="text-xs font-bold text-[hsl(var(--muted-foreground))] mt-1">{label}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Career readiness for your target role
        </p>
      </div>
    </div>
  );
}

// ─── Question Card ────────────────────────────────────────────────────────────
function QuestionCard({ q, idx }: { q: InterviewQuestion; idx: number }) {
  const [open, setOpen] = useState(false);
  const diffColor = q.difficulty === 'Easy' ? 'success' : q.difficulty === 'Medium' ? 'warning' : 'destructive';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
      className="border border-[hsl(var(--border))] rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-4 p-4 hover:bg-[hsl(var(--accent))]/50 transition-colors text-left"
      >
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-bold flex items-center justify-center">
          {idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-relaxed">{q.question}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant={diffColor as 'success' | 'warning' | 'destructive'} className="text-xs">{q.difficulty}</Badge>
          {open ? <ChevronUp className="w-4 h-4 text-[hsl(var(--muted-foreground))]" /> : <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30">
          <div className="flex gap-2 mt-3">
            <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">{q.hint}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Resource Card ────────────────────────────────────────────────────────────
function ResourceCard({ res }: { res: LearningResource }) {
  const typeVariant = res.type === 'free' ? 'free' : res.type === 'paid' ? 'paid' : res.type === 'certification' ? 'certification' : 'practice';
  return (
    <Card className="card-hover h-full">
      <CardContent className="p-5 h-full flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-3">
          <Badge variant={typeVariant as 'free' | 'paid' | 'certification' | 'practice'} className="text-xs uppercase">
            {res.type}
          </Badge>
          {res.isCertification && <Badge variant="certification" className="text-xs">🏅 Certification</Badge>}
        </div>
        <h4 className="font-semibold text-sm mb-1 line-clamp-2 flex-1">{res.name}</h4>
        <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2">{res.platform}</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 line-clamp-2">{res.description}</p>
        <div className="flex items-center justify-between mt-auto">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">~{res.estimatedHours}h</span>
          <a
            href={res.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Open <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Week Card ────────────────────────────────────────────────────────────────
function WeekCard({ week }: { week: WeekPlan }) {
  const [open, setOpen] = useState(week.week === 1);
  const colors = ['bg-blue-500', 'bg-teal-500', 'bg-amber-500', 'bg-purple-500'];
  const color = colors[(week.week - 1) % colors.length];

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 hover:bg-[hsl(var(--accent))]/30 transition-colors text-left"
      >
        <div className={`w-12 h-12 ${color} rounded-xl text-white font-black text-lg flex items-center justify-center flex-shrink-0`}>
          W{week.week}
        </div>
        <div className="flex-1">
          <p className="font-bold">{week.title}</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{week.focus}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{week.tasks.length} tasks</Badge>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {open && (
        <CardContent className="pt-0 pb-5">
          <div className="border-t border-[hsl(var(--border))] pt-4 space-y-2">
            {week.tasks.map((task) => (
              <div key={task.day} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-[hsl(var(--muted))] rounded-md text-xs font-bold flex items-center justify-center">
                  {task.day}
                </span>
                <div>
                  <p className="text-sm">{task.task}</p>
                  {task.resource && <p className="text-xs text-[hsl(var(--muted-foreground))]">📚 {task.resource}</p>}
                </div>
              </div>
            ))}
          </div>
          {week.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[hsl(var(--border))]">
              {week.skills.map((s) => <Badge key={s} variant="info" className="text-xs">{s}</Badge>)}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentAnalysis, isLoading, fetchAnalysis, generateQuestions, generateRoadmap } = useAnalysisStore();
  const [skillFilter, setSkillFilter] = useState('all');
  const [generatingQ, setGeneratingQ] = useState(false);
  const [generatingR, setGeneratingR] = useState(false);

  useEffect(() => {
    if (id) fetchAnalysis(id);
  }, [id, fetchAnalysis]);

  const a = currentAnalysis;

  const handleExportPDF = () => {
    if (!id) return;
    analysisApi.exportPDF(id);
    toast({ title: '📄 Generating PDF...', description: 'Your report will download shortly.' });
  };

  const handleExportCSV = () => {
    if (!id) return;
    analysisApi.exportCSV(id);
    toast({ title: '📊 Generating CSV...', description: 'Your file will download shortly.' });
  };

  const handleGenQuestions = async () => {
    if (!id) return;
    setGeneratingQ(true);
    await generateQuestions(id);
    setGeneratingQ(false);
    toast({ title: '✅ Questions generated!', variant: 'success' });
  };

  const handleGenRoadmap = async () => {
    if (!id) return;
    setGeneratingR(true);
    await generateRoadmap(id);
    setGeneratingR(false);
    toast({ title: '✅ Roadmap generated!', variant: 'success' });
  };

  if (isLoading || !a) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-10 space-y-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      </div>
    );
  }

  // Radar chart data
  const allRequired = [...a.matchedSkills, ...a.missingSkills];
  const radarData = allRequired.slice(0, 8).map((skill) => ({
    skill: skill.length > 12 ? skill.slice(0, 12) + '…' : skill,
    candidate: a.matchedSkills.includes(skill) ? 80 + Math.random() * 20 : 0,
    required: 100,
  }));

  // Bar chart data
  const barData = [
    { name: 'Matched', value: a.matchedSkills.length, fill: '#10B981' },
    { name: 'Missing', value: a.missingSkills.length, fill: '#EF4444' },
    { name: 'Recommended', value: Math.min(5, a.missingSkills.length), fill: '#3B82F6' },
  ];

  // Group resources by skill
  const skillsWithResources = [...new Set((a.learningResources || []).map((r) => r.skill))];
  const filteredResources = skillFilter === 'all'
    ? a.learningResources || []
    : (a.learningResources || []).filter((r) => r.skill === skillFilter);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />

      {/* Sticky Export Bar */}
      <div className="sticky top-16 z-40 glass border-b border-[hsl(var(--border))]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant={a.readinessScore >= 70 ? 'success' : a.readinessScore >= 40 ? 'warning' : 'missing'} className="text-xs hidden sm:flex">
              {Math.round(a.readinessScore)}% Ready
            </Badge>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
              <Download className="w-3.5 h-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
              <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── A: Candidate Profile ─────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Candidate Profile
                <Badge variant="info" className="ml-auto">{a.targetRole}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic info */}
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-md">
                    <User className="w-10 h-10 text-white" />
                  </div>
                </div>
                <div className="flex-1 grid sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Name', value: a.candidateName || 'N/A' },
                    { label: 'Email', value: a.candidateEmail || 'N/A' },
                    { label: 'Phone', value: a.candidatePhone || 'N/A' },
                    { label: 'Target Role', value: a.targetRole },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-0.5">{label}</p>
                      <p className="font-medium text-sm">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Summary */}
              {a.candidateSummary && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-600">AI-Generated Summary</span>
                  </div>
                  <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed">{a.candidateSummary}</p>
                </div>
              )}

              {/* Education */}
              {a.education?.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-2 font-semibold text-sm mb-3">
                    <GraduationCap className="w-4 h-4 text-teal-600" /> Education
                  </h4>
                  <div className="space-y-2">
                    {a.education.map((edu, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-[hsl(var(--muted))]/50 rounded-lg">
                        <GraduationCap className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{edu.degree} in {edu.field}</p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">{edu.institution} • {edu.startYear}–{edu.endYear}{edu.gpa ? ` • GPA: ${edu.gpa}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience */}
              {a.experience?.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-2 font-semibold text-sm mb-3">
                    <Briefcase className="w-4 h-4 text-purple-600" /> Work Experience
                  </h4>
                  <div className="space-y-2">
                    {a.experience.map((exp, i) => (
                      <div key={i} className="p-3 bg-[hsl(var(--muted))]/50 rounded-lg">
                        <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                          <p className="font-medium text-sm">{exp.role}</p>
                          <span className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1"><Calendar className="w-3 h-3" />{exp.startDate} – {exp.endDate}</span>
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">{exp.company}</p>
                        {exp.technologies?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {exp.technologies.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {a.projects?.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-2 font-semibold text-sm mb-3">
                    <FolderGit2 className="w-4 h-4 text-amber-600" /> Projects
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {a.projects.map((proj, i) => (
                      <div key={i} className="p-3 bg-[hsl(var(--muted))]/50 rounded-lg">
                        <p className="font-medium text-sm mb-1">{proj.name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2 line-clamp-2">{proj.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {proj.technologies?.slice(0, 4).map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications */}
              {a.certifications?.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-2 font-semibold text-sm mb-3">
                    <Award className="w-4 h-4 text-rose-600" /> Certifications
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {a.certifications.map((cert, i) => (
                      <div key={i} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                        <Award className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-sm font-medium">{cert.name}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">— {cert.issuer} ({cert.year})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── B+C: Skill Analysis + Readiness ──────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Skill Analysis (2/3) */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  Skill Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Radar Chart */}
                {radarData.length > 0 && (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="Required" dataKey="required" stroke="#E2E8F0" fill="#E2E8F0" fillOpacity={0.2} />
                        <Radar name="Your Skills" dataKey="candidate" stroke="#2563EB" fill="#2563EB" fillOpacity={0.4} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Progress bars */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium">Skill Coverage</span>
                      <span className="text-[hsl(var(--muted-foreground))]">{a.matchedSkills.length}/{a.matchedSkills.length + a.missingSkills.length}</span>
                    </div>
                    <Progress value={(a.matchedSkills.length / (a.matchedSkills.length + a.missingSkills.length || 1)) * 100} />
                  </div>
                </div>

                {/* Skill Badges */}
                {a.matchedSkills.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-emerald-600 mb-2 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> Matched Skills ({a.matchedSkills.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {a.matchedSkills.map((s) => (
                        <Badge key={s} variant="matched" className="gap-1">✓ {s}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {a.missingSkills.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-red-500 mb-2 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" /> Missing Skills ({a.missingSkills.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {a.missingSkills.map((s) => (
                        <Badge key={s} variant="missing" className="gap-1">✗ {s}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bar chart */}
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} width={80} />
                      <Tooltip formatter={(v) => [`${v} skills`, '']} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                        {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Readiness Score (1/3) */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-teal-600" />
                  Readiness Score
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <ReadinessGauge score={a.readinessScore} />
                <div className="w-full space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-[hsl(var(--muted-foreground))]">Matched</span>
                    <span className="font-bold text-emerald-600">{a.matchedSkills.length} skills</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[hsl(var(--muted-foreground))]">Missing</span>
                    <span className="font-bold text-red-500">{a.missingSkills.length} skills</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[hsl(var(--muted-foreground))]">Total Required</span>
                    <span className="font-bold">{a.matchedSkills.length + a.missingSkills.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ── D: Learning Recommendations ──────────────────────────────────── */}
        {(a.learningResources?.length || 0) > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-amber-600" />
                  Learning Recommendations
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={skillFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSkillFilter('all')}
                  >All</Button>
                  {skillsWithResources.slice(0, 5).map((s) => (
                    <Button
                      key={s}
                      variant={skillFilter === s ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSkillFilter(s)}
                    >{s}</Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredResources.map((res, i) => <ResourceCard key={i} res={res} />)}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── E: Interview Preparation ──────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card>
            <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                Interview Preparation
              </CardTitle>
              {!a.interviewQuestions && (
                <Button variant="outline" size="sm" onClick={handleGenQuestions} disabled={generatingQ} className="gap-2">
                  {generatingQ ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                  Generate Questions
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {a.interviewQuestions ? (
                <Tabs defaultValue="technical">
                  <TabsList className="grid grid-cols-4 w-full mb-6">
                    <TabsTrigger value="technical" className="gap-1.5 text-xs sm:text-sm">
                      <Brain className="w-3.5 h-3.5 sm:hidden" />
                      Technical <Badge variant="info" className="text-[10px] hidden sm:flex">{a.interviewQuestions.technical.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="project" className="text-xs sm:text-sm">
                      Project <Badge variant="info" className="text-[10px] hidden sm:flex">{a.interviewQuestions.project.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="scenario" className="text-xs sm:text-sm">
                      Scenario <Badge variant="info" className="text-[10px] hidden sm:flex">{a.interviewQuestions.scenario.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="hr" className="text-xs sm:text-sm">
                      <Users className="w-3.5 h-3.5 sm:hidden" />
                      HR <Badge variant="info" className="text-[10px] hidden sm:flex">{a.interviewQuestions.hr.length}</Badge>
                    </TabsTrigger>
                  </TabsList>

                  {(['technical', 'project', 'scenario', 'hr'] as const).map((cat) => (
                    <TabsContent key={cat} value={cat}>
                      <div className="space-y-3">
                        {a.interviewQuestions![cat].map((q, i) => <QuestionCard key={i} q={q} idx={i} />)}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-[hsl(var(--muted-foreground))] mx-auto mb-3" />
                  <p className="text-[hsl(var(--muted-foreground))]">No questions generated yet.</p>
                  <Button variant="gradient" className="mt-4 gap-2" onClick={handleGenQuestions} disabled={generatingQ}>
                    {generatingQ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    Generate 25 Questions
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── F: Preparation Roadmap ────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex-row items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-600" />
                30-Day Preparation Roadmap
              </CardTitle>
              {!a.preparationRoadmap && (
                <Button variant="outline" size="sm" onClick={handleGenRoadmap} disabled={generatingR} className="gap-2">
                  {generatingR ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                  Generate Roadmap
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {a.preparationRoadmap ? (
                <div className="space-y-4">
                  {a.preparationRoadmap.weeks.map((week) => <WeekCard key={week.week} week={week} />)}

                  {a.preparationRoadmap.tips?.length > 0 && (
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
                      <h4 className="font-semibold text-blue-600 mb-3 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" /> Pro Tips
                      </h4>
                      <ul className="space-y-2">
                        {a.preparationRoadmap.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-blue-600 font-bold flex-shrink-0">•</span>
                            <span className="text-[hsl(var(--foreground))]">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-[hsl(var(--muted-foreground))] mx-auto mb-3" />
                  <p className="text-[hsl(var(--muted-foreground))]">No roadmap generated yet.</p>
                  <Button variant="gradient" className="mt-4 gap-2" onClick={handleGenRoadmap} disabled={generatingR}>
                    {generatingR ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                    Generate 30-Day Plan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

// Need this for the TrendingUp icon used below
function TrendingUp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
      <polyline points="16,7 22,7 22,13" />
    </svg>
  );
}
