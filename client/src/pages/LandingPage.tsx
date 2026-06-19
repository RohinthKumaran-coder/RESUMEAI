import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BrainCircuit, FileText, Target, BookOpen, MessageSquare, TrendingUp,
  Download, CheckCircle, ArrowRight, Sparkles, Zap, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth-store';

const ROLES = ['Data Analyst', 'ML Engineer', 'AI Engineer', 'Full Stack Dev', 'DevOps Engineer', 'UI/UX Designer'];

const FEATURES = [
  { icon: FileText, title: 'Resume Analysis', desc: 'AI extracts skills, education, and experience from your PDF resume instantly.', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { icon: Target, title: 'Skill Gap Detection', desc: 'Compare your skills against role requirements and get a precise readiness score.', color: 'text-teal-500', bg: 'bg-teal-500/10' },
  { icon: BookOpen, title: 'Learning Paths', desc: 'Get curated free and paid courses, YouTube resources, and certifications for every gap.', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { icon: MessageSquare, title: 'Interview Prep', desc: '25 personalized questions across Technical, Project, Scenario, and HR categories.', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { icon: TrendingUp, title: '30-Day Roadmap', desc: 'A structured week-by-week preparation plan tailored to your skill gaps.', color: 'text-rose-500', bg: 'bg-rose-500/10' },
  { icon: Download, title: 'Export Reports', desc: 'Download your full analysis as a branded PDF report or CSV for tracking.', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

const STEPS = [
  { num: '01', title: 'Upload Your Resume', desc: 'Drag and drop your PDF resume and select your target job role.' },
  { num: '02', title: 'AI Analyzes Everything', desc: 'Our GPT-powered engine extracts skills, identifies gaps, and generates insights.' },
  { num: '03', title: 'Get Your Report', desc: 'Review your readiness score, learning plan, and practice interview questions.' },
];

const STATS = [
  { value: '8+', label: 'Supported Roles' },
  { value: '25', label: 'Interview Questions' },
  { value: '30', label: 'Day Roadmap' },
  { value: '100%', label: 'AI Powered' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [roleIndex, setRoleIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRoleIndex((i) => (i + 1) % ROLES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleCTA = () => navigate(isAuthenticated ? '/analyze' : '/register');

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden gradient-hero min-h-screen flex items-center">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-3xl" />
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC4yIiBvcGFjaXR5PSIwLjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Text */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-white/90 text-sm font-medium">AI-Powered Career Intelligence</span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-tight mb-6">
                Land Your Dream
                <span className="block mt-2">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400">
                    {ROLES[roleIndex]}
                  </span>
                </span>
                <span className="block text-4xl sm:text-5xl font-bold text-white/80 mt-2">Role</span>
              </h1>

              <p className="text-lg sm:text-xl text-white/70 mb-10 leading-relaxed max-w-xl">
                Upload your resume, get an AI-powered skill gap analysis, personalized learning resources, 
                and tailored interview questions — all in under 60 seconds.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Button variant="gradient" size="xl" onClick={handleCTA} className="group shadow-2xl shadow-blue-500/30">
                  <Zap className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                  Analyze My Resume Free
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                {isAuthenticated && (
                  <Button variant="outline" size="xl" onClick={() => navigate('/dashboard')}
                    className="border-white/30 text-white hover:bg-white/10">
                    View Dashboard
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-6">
                {[
                  'No credit card needed',
                  'PDF upload in seconds',
                  'GPT-4o powered',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-white/60 text-sm">
                    <CheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: Dashboard mockup */}
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div className="relative animate-float">
                {/* Mock dashboard card */}
                <div className="glass rounded-2xl p-6 border border-white/20 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-white/60 text-sm">Readiness Score</p>
                      <p className="text-3xl font-black text-white">78%</p>
                    </div>
                    <div className="w-20 h-20 relative">
                      <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#14B8A6" strokeWidth="3" strokeDasharray="78, 100" strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-white text-sm font-bold">78%</span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div>
                      <div className="flex justify-between text-sm text-white/70 mb-1">
                        <span>✅ Matched Skills</span><span>7/9</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full"><div className="h-2 bg-teal-400 rounded-full" style={{ width: '78%' }} /></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm text-white/70 mb-1">
                        <span>❌ Missing Skills</span><span>2/9</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full"><div className="h-2 bg-red-400 rounded-full" style={{ width: '22%' }} /></div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {['Python', 'SQL', 'TensorFlow', 'Docker'].map((s) => (
                      <span key={s} className="px-2.5 py-1 bg-teal-500/20 text-teal-300 rounded-full text-xs font-medium">✓ {s}</span>
                    ))}
                    {['MLOps', 'Kubernetes'].map((s) => (
                      <span key={s} className="px-2.5 py-1 bg-red-500/20 text-red-300 rounded-full text-xs font-medium">✗ {s}</span>
                    ))}
                  </div>

                  <div className="text-xs text-white/40 text-center">AI Analysis for: Machine Learning Engineer</div>
                </div>

                {/* Floating badges */}
                <div className="absolute -top-4 -right-4 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse-glow">
                  🎯 25 Interview Questions
                </div>
                <div className="absolute -bottom-4 -left-4 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  📚 30-Day Roadmap
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-[hsl(var(--muted))]/50 border-y border-[hsl(var(--border))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-4xl font-black gradient-text mb-2">{stat.value}</div>
                <div className="text-[hsl(var(--muted-foreground))] text-sm font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              Everything you need to <span className="gradient-text">get hired</span>
            </h2>
            <p className="text-xl text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
              ResumeIQ combines AI-powered resume parsing, skill analysis, and personalized coaching into one powerful platform.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="card-hover h-full border border-[hsl(var(--border))] hover:border-blue-500/30 hover:shadow-blue-500/5">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4`}>
                      <feature.icon className={`w-6 h-6 ${feature.color}`} />
                    </div>
                    <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                    <p className="text-[hsl(var(--muted-foreground))] text-sm leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-[hsl(var(--muted))]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-black mb-4">How it <span className="gradient-text">works</span></h2>
            <p className="text-xl text-[hsl(var(--muted-foreground))]">Three simple steps to your dream job</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-16 left-1/3 right-1/3 h-0.5 bg-gradient-to-r from-blue-500 to-teal-500" />

            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.2 }}
                viewport={{ once: true }}
                className="text-center relative"
              >
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30 text-white text-xl font-black">
                  {step.num}
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="gradient-primary rounded-3xl p-12 shadow-2xl shadow-blue-500/30"
          >
            <Shield className="w-12 h-12 text-white/80 mx-auto mb-6" />
            <h2 className="text-4xl font-black text-white mb-4">Ready to land your dream role?</h2>
            <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto">
              Join thousands of job seekers who've improved their career readiness with ResumeIQ.
            </p>
            <Button
              variant="outline"
              size="xl"
              onClick={handleCTA}
              className="border-white/40 text-white hover:bg-white/20 hover:border-white"
            >
              <Zap className="w-5 h-5 mr-2" />
              Start Free Analysis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[hsl(var(--border))] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-blue-600" />
            <span className="font-bold gradient-text">ResumeIQ</span>
          </div>
          <p className="text-[hsl(var(--muted-foreground))] text-sm">
            © {new Date().getFullYear()} ResumeIQ. AI-Powered Career Preparation.
          </p>
        </div>
      </footer>
    </div>
  );
}
