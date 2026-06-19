import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlusCircle, TrendingUp, FileText, Clock, Trash2, ArrowRight, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Navbar } from '@/components/layout/Navbar';
import { useAnalysisStore } from '@/store/analysis-store';
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/hooks/use-toast';

function ScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444';
  const dash = (pct / 100) * 2 * Math.PI * 18;
  return (
    <svg width="52" height="52" viewBox="0 0 44 44" className="-rotate-90">
      <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4" className="text-[hsl(var(--muted))]" />
      <circle cx="22" cy="22" r="18" fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${dash} 999`} strokeLinecap="round" className="transition-all duration-700" />
    </svg>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { analyses, isLoading, fetchAnalyses, deleteAnalysis } = useAnalysisStore();
  const { toast } = useToast();

  useEffect(() => { fetchAnalyses(); }, [fetchAnalyses]);

  const avgScore = analyses.length
    ? Math.round(analyses.reduce((acc, a) => acc + (a.readinessScore || 0), 0) / analyses.length)
    : 0;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this analysis?')) return;
    await deleteAnalysis(id);
    toast({ title: 'Analysis deleted', variant: 'default' });
  };

  const roleEmoji: Record<string, string> = {
    'Data Analyst': '📊', 'Python Developer': '🐍', 'Machine Learning Engineer': '🤖',
    'AI Engineer': '✨', 'Software Engineer': '💻', 'Full Stack Developer': '🌐',
    'UI/UX Designer': '🎨', 'DevOps Engineer': '⚙️',
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-black mb-1">
              Welcome back, <span className="gradient-text">{user?.name?.split(' ')[0] || 'there'}</span> 👋
            </h1>
            <p className="text-[hsl(var(--muted-foreground))]">Track your career preparation progress</p>
          </div>
          <Button variant="gradient" onClick={() => navigate('/analyze')} className="gap-2 shadow-lg">
            <PlusCircle className="w-4 h-4" /> New Analysis
          </Button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total Analyses', value: analyses.length, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-500/10' },
            { label: 'Avg. Readiness', value: `${avgScore}%`, icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-500/10' },
            { label: 'Roles Explored', value: new Set(analyses.map((a) => a.targetRole)).size, icon: BrainCircuit, color: 'text-purple-600', bg: 'bg-purple-500/10' },
            { label: 'Latest Score', value: analyses[0] ? `${Math.round(analyses[0].readinessScore || 0)}%` : '—', icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-500/10' },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="card-hover">
                <CardContent className="p-5">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <p className="text-2xl font-black">{isLoading ? '—' : stat.value}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Analyses List */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Your Analyses
            </CardTitle>
            {analyses.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/analyze')} className="gap-1.5">
                <PlusCircle className="w-4 h-4" /> New
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : analyses.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-[hsl(var(--muted))] rounded-3xl flex items-center justify-center mx-auto mb-5">
                  <BrainCircuit className="w-10 h-10 text-[hsl(var(--muted-foreground))]" />
                </div>
                <h3 className="text-xl font-bold mb-2">No analyses yet</h3>
                <p className="text-[hsl(var(--muted-foreground))] mb-6">Upload your first resume to get started</p>
                <Button variant="gradient" onClick={() => navigate('/analyze')} className="gap-2">
                  <PlusCircle className="w-4 h-4" /> Analyze My Resume
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {analyses.map((analysis, i) => {
                  const score = Math.round(analysis.readinessScore || 0);
                  const scoreColor = score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-500';
                  return (
                    <motion.div
                      key={analysis.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4 p-4 rounded-xl border border-[hsl(var(--border))] hover:border-blue-400/40 hover:bg-[hsl(var(--accent))]/50 transition-all cursor-pointer group"
                      onClick={() => navigate(`/analysis/${analysis.id}`)}
                    >
                      <div className="flex-shrink-0">
                        <ScoreRing score={score} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{roleEmoji[analysis.targetRole] || '💼'}</span>
                          <span className="font-bold truncate">{analysis.targetRole}</span>
                          <Badge variant="outline" className="text-xs hidden sm:flex">
                            {analysis.resumeFileName.slice(0, 20)}...
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                          <span className={`font-semibold ${scoreColor}`}>{score}% Ready</span>
                          <span>✅ {analysis.matchedSkills.length} matched</span>
                          <span>❌ {analysis.missingSkills.length} missing</span>
                          <span className="flex items-center gap-1 hidden sm:flex"><Clock className="w-3 h-3" />{new Date(analysis.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                          onClick={(e) => handleDelete(analysis.id, e)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <ArrowRight className="w-5 h-5 text-[hsl(var(--muted-foreground))] group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
