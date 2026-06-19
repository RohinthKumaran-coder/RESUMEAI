import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, Zap, Loader2, ChevronDown } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { useAnalysisStore } from '@/store/analysis-store';
import { rolesApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { RoleInfo } from '@/types';

export function AnalyzePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createAnalysis, isCreating, creatingStep } = useAnalysisStore();

  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [useCustomRole, setUseCustomRole] = useState(false);
  const [customRole, setCustomRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const companyBoxRef = useRef<HTMLDivElement>(null);

  const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'jpg', 'jpeg', 'png'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const COMPANIES = [
    'Google', 'Microsoft', 'Amazon', 'Apple', 'Meta', 'Netflix', 'Adobe', 'Salesforce',
    'Oracle', 'IBM', 'Intel', 'NVIDIA', 'Uber', 'Airbnb', 'Spotify', 'LinkedIn',
    'Zoho', 'Infosys', 'TCS', 'Wipro', 'Accenture', 'Cognizant', 'HCLTech', 'Capgemini',
    'Flipkart', 'Swiggy', 'Zomato', 'Paytm', 'Freshworks', 'Atlassian', 'Stripe', 'ServiceNow',
  ];

  // Load roles from API
  useEffect(() => {
    rolesApi.getAll().then(setRoles).catch(() => { });
  }, []);

  // Close company dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (companyBoxRef.current && !companyBoxRef.current.contains(e.target as Node)) {
        setCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredCompanies = COMPANIES.filter((c) =>
    c.toLowerCase().includes(companySearch.toLowerCase())
  );
  const exactCompanyMatch = filteredCompanies.some(
    (c) => c.toLowerCase() === companySearch.trim().toLowerCase()
  );

  const selectCompany = (c: string) => {
    setTargetCompany(c);
    setCompanyDropdownOpen(false);
    setCompanySearch('');
  };

  const validateFile = (f: File): string | null => {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext))
      return `Unsupported file type. Please upload: ${ALLOWED_EXTENSIONS.join(', ')}`;
    if (f.size > MAX_FILE_SIZE) return 'File too large. Maximum size is 10MB.';
    return null;
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = validateFile(f);
    if (err) { toast({ title: err, variant: 'destructive' }); e.target.value = ''; return; }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const err = validateFile(f);
    if (err) { toast({ title: err, variant: 'destructive' }); return; }
    setFile(f);
  };

  const toggleRole = (id: string) => {
    setSelectedRoles((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const hasTarget =
    selectedRoles.length > 0 || (useCustomRole && customRole.trim().length > 0);

  const handleSubmit = async () => {
    if (!file || !hasTarget) {
      toast({ title: 'Please select a file and at least one target role.', variant: 'destructive' });
      return;
    }
    try {
      const analysis = await createAnalysis(
        file,
        selectedRoles,
        useCustomRole && customRole.trim() ? customRole.trim() : undefined,
        targetCompany.trim() || undefined,
        jobDescription.trim() || undefined,
      );
      toast({ title: '✅ Analysis complete!', variant: 'success' });
      // Navigate to the detail page with the real analysis ID
      navigate(`/analysis/${analysis.id}`);
    } catch (err: unknown) {
      toast({
        title: 'Analysis failed',
        description: (err as Error).message || 'Something went wrong.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black mb-2">Analyze Your Resume</h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            Upload your resume and tell us what you&apos;re targeting
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Upload */}
          <div
            className="rounded-2xl border-2 border-dashed border-[hsl(var(--border))] p-8 text-center hover:border-blue-500/50 transition cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.jpg,.jpeg,.png"
              onChange={handleFile}
              className="hidden"
            />
            {file ? (
              <div>
                <FileText className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <p className="font-bold text-lg">{file.name}</p>
                <p className="text-[hsl(var(--muted-foreground))] text-sm mt-1">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
            ) : (
              <div>
                <Upload className="w-16 h-16 text-[hsl(var(--muted-foreground))]/30 mx-auto mb-4" />
                <p className="font-bold text-lg">Drop your resume here</p>
                <p className="text-[hsl(var(--muted-foreground))] text-sm mt-1">or click to browse</p>
                <p className="text-[hsl(var(--muted-foreground))] text-xs mt-2">
                  PDF, DOCX, TXT, JPG, PNG · max 10MB
                </p>
              </div>
            )}
          </div>

          {/* Role Selection */}
          <div>
            <h3 className="font-bold text-lg mb-4">Select Target Role(s)</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
              {roles.map((r) => {
                const active = selectedRoles.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleRole(r.id)}
                    type="button"
                    className={`w-full text-left p-4 rounded-xl border transition ${active
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-[hsl(var(--border))] hover:border-blue-500/30'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold">{r.name}</div>
                      {active && <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />}
                    </div>
                    <div className="text-[hsl(var(--muted-foreground))] text-xs mt-0.5">
                      {r.description}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {r.requiredSkillsCount} required skills
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setUseCustomRole((v) => !v)}
                className={`w-full text-left p-4 rounded-xl border transition ${useCustomRole
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-[hsl(var(--border))] hover:border-blue-500/30'
                  }`}
              >
                <div className="font-bold">Other — type your own role</div>
                <div className="text-[hsl(var(--muted-foreground))] text-xs mt-0.5">
                  Not seeing your target role above? Specify it directly.
                </div>
              </button>

              {useCustomRole && (
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="e.g. Site Reliability Engineer"
                  className="w-full px-4 py-2.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              )}
            </div>
          </div>
        </div>

        {/* Company + Job Description */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {/* Target Company */}
          <div ref={companyBoxRef} className="relative">
            <label className="block text-sm font-medium mb-1.5">
              Target Company{' '}
              <span className="text-[hsl(var(--muted-foreground))] font-normal">(optional)</span>
            </label>
            <button
              type="button"
              onClick={() => { setCompanyDropdownOpen((v) => !v); setCompanySearch(''); }}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              <span className={targetCompany ? 'font-medium' : 'text-[hsl(var(--muted-foreground))]'}>
                {targetCompany || 'Select a company...'}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-[hsl(var(--muted-foreground))] transition-transform ${companyDropdownOpen ? 'rotate-180' : ''
                  }`}
              />
            </button>

            {companyDropdownOpen && (
              <div className="absolute z-20 mt-2 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl overflow-hidden">
                <input
                  autoFocus
                  type="text"
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full px-4 py-2.5 text-sm border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none"
                />
                <div className="max-h-52 overflow-y-auto">
                  {filteredCompanies.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => selectCompany(c)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-[hsl(var(--muted))] transition"
                    >
                      {c}
                    </button>
                  ))}
                  {companySearch.trim() && !exactCompanyMatch && (
                    <button
                      type="button"
                      onClick={() => selectCompany(companySearch.trim())}
                      className="w-full text-left px-4 py-2.5 text-sm text-blue-600 font-medium hover:bg-[hsl(var(--muted))] transition border-t border-[hsl(var(--border))]"
                    >
                      Use &quot;{companySearch.trim()}&quot;
                    </button>
                  )}
                  {filteredCompanies.length === 0 && !companySearch.trim() && (
                    <div className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      Start typing to search…
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Job Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Job Description{' '}
              <span className="text-[hsl(var(--muted-foreground))] font-normal">
                (optional, improves accuracy)
              </span>
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={1}
              placeholder="Paste the job posting here for a more precise skill-gap match"
              className="w-full px-4 py-2.5 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              onFocus={(e) => { e.target.rows = 5; }}
              onBlur={(e) => { if (!e.target.value) e.target.rows = 1; }}
            />
          </div>
        </div>

        {/* Submit */}
        <div className="mt-8 text-center">
          <button
            onClick={handleSubmit}
            disabled={isCreating || !file || !hasTarget}
            className="px-10 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg transition disabled:opacity-50 flex items-center justify-center gap-3 mx-auto"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                {creatingStep || 'Analyzing...'}
              </>
            ) : (
              <>
                <Zap className="w-6 h-6" />
                Analyze Resume
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}