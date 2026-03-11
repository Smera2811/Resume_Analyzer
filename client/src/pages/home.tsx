import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import type { AnalysisResult, MatchLevel } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  FileText,
  Briefcase,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Star,
  ChevronDown,
  RotateCcw,
  AlertCircle,
  TrendingUp,
  Zap,
  Moon,
  Sun,
} from "lucide-react";

const LEVEL_CONFIG: Record<
  MatchLevel,
  { color: string; bg: string; border: string; ring: string; icon: string; gradient: string }
> = {
  Excellent: {
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    ring: "ring-emerald-500/20",
    icon: "🏆",
    gradient: "from-emerald-500 to-teal-500",
  },
  Good: {
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    ring: "ring-blue-500/20",
    icon: "✅",
    gradient: "from-blue-500 to-indigo-500",
  },
  Moderate: {
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    ring: "ring-amber-500/20",
    icon: "⚡",
    gradient: "from-amber-500 to-orange-500",
  },
  Weak: {
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-800",
    ring: "ring-red-500/20",
    icon: "⚠️",
    gradient: "from-red-500 to-rose-500",
  },
};

function ScoreRing({ score, level }: { score: number; level: MatchLevel }) {
  const config = LEVEL_CONFIG[level];
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 128 128">
        <circle
          cx="64"
          cy="64"
          r="54"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-muted/40"
        />
        <motion.circle
          cx="64"
          cy="64"
          r="54"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
          className={`bg-gradient-to-r ${config.gradient}`}
          stroke={`url(#scoreGrad-${level})`}
        />
        <defs>
          <linearGradient id={`scoreGrad-${level}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop
              offset="0%"
              stopColor={
                level === "Excellent"
                  ? "#10b981"
                  : level === "Good"
                  ? "#3b82f6"
                  : level === "Moderate"
                  ? "#f59e0b"
                  : "#ef4444"
              }
            />
            <stop
              offset="100%"
              stopColor={
                level === "Excellent"
                  ? "#14b8a6"
                  : level === "Good"
                  ? "#6366f1"
                  : level === "Moderate"
                  ? "#f97316"
                  : "#f43f5e"
              }
            />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold text-foreground"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-muted-foreground font-medium mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function BulletList({
  items,
  variant,
  delay = 0,
}: {
  items: string[];
  variant: "success" | "danger" | "accent";
  delay?: number;
}) {
  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />,
    danger: <XCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />,
    accent: <ArrowRightLeft className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />,
  };

  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: delay + i * 0.07 }}
          className="flex items-start gap-2.5 text-sm text-foreground/85 leading-relaxed"
        >
          {iconMap[variant]}
          <span>{item}</span>
        </motion.li>
      ))}
    </ul>
  );
}

function ResultCard({
  title,
  icon,
  children,
  delay = 0,
  accentClass = "",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  accentClass?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className={`bg-card border rounded-xl p-5 shadow-sm ${accentClass}`}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-1.5 rounded-lg bg-muted/60">{icon}</div>
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

function LoadingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="relative">
        <motion.div
          className="w-16 h-16 rounded-full border-4 border-primary/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-primary"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-base font-semibold text-foreground">Analyzing match...</p>
        <p className="text-sm text-muted-foreground">Performing semantic comparison</p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-primary"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}

function AnalysisResults({ result }: { result: AnalysisResult }) {
  const config = LEVEL_CONFIG[result.level];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
      data-testid="analysis-results"
    >
      {/* Score Header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`border rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6 ${config.bg} ${config.border}`}
      >
        <ScoreRing score={result.score} level={result.level} />
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
            <span className="text-xl">{config.icon}</span>
            <span
              className={`text-2xl font-bold ${config.color}`}
              data-testid="match-level"
            >
              {result.level} Match
            </span>
          </div>
          <p
            className="text-sm text-muted-foreground leading-relaxed max-w-md"
            data-testid="final-assessment"
          >
            {result.finalAssessment}
          </p>
        </div>
      </motion.div>

      {/* Three columns grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <ResultCard
          title="Strong Matches"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          delay={0.1}
          accentClass="border-emerald-100 dark:border-emerald-900/40"
        >
          <BulletList items={result.strongMatches} variant="success" delay={0.15} />
        </ResultCard>

        <ResultCard
          title="Gaps & Missing Requirements"
          icon={<XCircle className="w-4 h-4 text-red-500" />}
          delay={0.2}
          accentClass="border-red-100 dark:border-red-900/40"
        >
          <BulletList items={result.gaps} variant="danger" delay={0.25} />
        </ResultCard>

        <ResultCard
          title="Transferable Skills"
          icon={<ArrowRightLeft className="w-4 h-4 text-blue-500" />}
          delay={0.3}
          accentClass="border-blue-100 dark:border-blue-900/40"
        >
          <BulletList items={result.transferableSkills} variant="accent" delay={0.35} />
        </ResultCard>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isDark, setIsDark] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const toggleDark = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const mutation = useMutation({
    mutationFn: async (data: { resume: string; jobDescription: string }) => {
      const response = await apiRequest("POST", "/api/analyze", data);
      return response.json() as Promise<AnalysisResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Analysis failed",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = () => {
    if (!resume.trim() || !jobDescription.trim()) {
      toast({
        title: "Missing content",
        description: "Please paste both your resume and the job description.",
        variant: "destructive",
      });
      return;
    }
    setResult(null);
    mutation.mutate({ resume, jobDescription });
  };

  const handleReset = () => {
    setResume("");
    setJobDescription("");
    setResult(null);
    mutation.reset();
  };

  const charCount = {
    resume: resume.length,
    jd: jobDescription.length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-foreground text-base">ResumeMatch</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-semibold">AI</Badge>
            </div>
          </div>
          <button
            onClick={toggleDark}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            data-testid="toggle-dark-mode"
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Moon className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-3 max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-xs font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Semantic AI Analysis — Not keyword matching
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            Resume ↔ Job Match Analyzer
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Paste your resume and a job description. Our AI performs deep semantic analysis to surface real alignment, gaps, and transferable skills — the way an expert recruiter would.
          </p>
        </motion.div>

        {/* Input panels */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid gap-5 md:grid-cols-2"
        >
          {/* Resume Input */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                Your Resume
              </label>
              <span className="text-xs text-muted-foreground">{charCount.resume.toLocaleString()} chars</span>
            </div>
            <div className="relative">
              <Textarea
                data-testid="input-resume"
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                placeholder="Paste your full resume here — work experience, skills, education, certifications, and any other relevant information..."
                className="min-h-[280px] resize-y text-sm leading-relaxed bg-card border-card-border focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/50 font-mono"
                disabled={mutation.isPending}
              />
              {resume.length > 0 && (
                <button
                  onClick={() => setResume("")}
                  className="absolute top-2.5 right-2.5 p-1 rounded hover:bg-muted transition-colors"
                  data-testid="clear-resume"
                >
                  <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Job Description Input */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                Job Description
              </label>
              <span className="text-xs text-muted-foreground">{charCount.jd.toLocaleString()} chars</span>
            </div>
            <div className="relative">
              <Textarea
                data-testid="input-job-description"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here — responsibilities, qualifications, required skills, nice-to-haves, and company context..."
                className="min-h-[280px] resize-y text-sm leading-relaxed bg-card border-card-border focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/50 font-mono"
                disabled={mutation.isPending}
              />
              {jobDescription.length > 0 && (
                <button
                  onClick={() => setJobDescription("")}
                  className="absolute top-2.5 right-2.5 p-1 rounded hover:bg-muted transition-colors"
                  data-testid="clear-job-description"
                >
                  <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Action row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-center justify-center gap-3"
        >
          {result && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={mutation.isPending}
              data-testid="button-reset"
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Start over
            </Button>
          )}
          <Button
            onClick={handleAnalyze}
            disabled={mutation.isPending || !resume.trim() || !jobDescription.trim()}
            data-testid="button-analyze"
            size="lg"
            className="px-8 font-semibold shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all"
          >
            {mutation.isPending ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 mr-2"
                >
                  <Sparkles className="w-4 h-4" />
                </motion.div>
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze Match
              </>
            )}
          </Button>
        </motion.div>

        {/* Helper tips row */}
        {!result && !mutation.isPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Semantic understanding — not keyword matching
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
              Match score with evidence-based reasoning
            </span>
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              Honest gap analysis you can act on
            </span>
          </motion.div>
        )}

        {/* Results section */}
        <div ref={resultsRef}>
          <AnimatePresence mode="wait">
            {mutation.isPending && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-card border rounded-xl"
              >
                <LoadingAnimation />
              </motion.div>
            )}

            {result && !mutation.isPending && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center gap-2 mb-5">
                  <Star className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Analysis Results</h2>
                  <div className="flex-1 h-px bg-border ml-1" />
                </div>
                <AnalysisResults result={result} />
              </motion.div>
            )}

            {mutation.isError && !mutation.isPending && !result && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-destructive/5 border border-destructive/20 rounded-xl p-6 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive text-sm">Analysis failed</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Something went wrong. Please check your input and try again.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>ResumeMatch AI — Semantic resume analysis powered by AI</span>
          <span>Results are AI-generated. Use as a hiring aid, not sole decision.</span>
        </div>
      </footer>
    </div>
  );
}
