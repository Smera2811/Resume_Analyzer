import { z } from "zod";

export const analyzeRequestSchema = z.object({
  resume: z.string().min(50, "Resume must be at least 50 characters"),
  jobDescription: z.string().min(50, "Job description must be at least 50 characters"),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

export const matchLevelSchema = z.enum(["Excellent", "Good", "Moderate", "Weak"]);
export type MatchLevel = z.infer<typeof matchLevelSchema>;

export const analysisResultSchema = z.object({
  score: z.number().min(0).max(100),
  level: matchLevelSchema,
  strongMatches: z.array(z.string()),
  gaps: z.array(z.string()),
  transferableSkills: z.array(z.string()),
  finalAssessment: z.string(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
