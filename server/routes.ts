import type { Express } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";
import { analyzeRequestSchema, type AnalysisResult } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are an expert AI hiring assistant and senior technical recruiter with 15+ years of experience across all industries. Your role is to perform deep semantic analysis comparing a candidate's resume against a job description.

You do NOT rely on keyword matching. Instead, you evaluate conceptual alignment, skill transferability, seniority level fit, domain expertise, and overall career trajectory.

You must return a JSON object with EXACTLY this structure:
{
  "score": <integer 0-100>,
  "level": <"Excellent" | "Good" | "Moderate" | "Weak">,
  "strongMatches": [<array of concise bullet strings>],
  "gaps": [<array of concise bullet strings>],
  "transferableSkills": [<array of concise bullet strings>],
  "finalAssessment": "<2-3 sentence objective summary>"
}

Score guidelines:
- 85-100: Excellent — candidate is exceptionally well-aligned; minor or no gaps
- 70-84: Good — strong fit with some addressable gaps
- 50-69: Moderate — meaningful overlap but notable gaps present
- 0-49: Weak — significant misalignment in skills, experience, or domain

Rules:
- strongMatches: 3-6 items. Specific evidence from the resume that directly addresses job requirements.
- gaps: 3-6 items. Concrete missing skills, experience, or qualifications. Be direct and specific.
- transferableSkills: 2-5 items. Skills from the resume that weren't explicitly required but add value.
- finalAssessment: Objective, recruiter-style summary. Evidence-based, no filler phrases.
- All bullet items should be concise (under 15 words each), specific, and evidence-grounded.
- Tone: professional, objective, direct. No hedging language.`;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/analyze", async (req, res) => {
    try {
      const parsed = analyzeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { resume, jobDescription } = parsed.data;

      const userMessage = `Resume:
${resume}

---

Job Description:
${jobDescription}

Analyze the resume against this job description and return the JSON analysis.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 8192,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return res.status(500).json({ error: "No response from AI" });
      }

      const result: AnalysisResult = JSON.parse(content);

      if (result.score >= 85) result.level = "Excellent";
      else if (result.score >= 70) result.level = "Good";
      else if (result.score >= 50) result.level = "Moderate";
      else result.level = "Weak";

      return res.json(result);
    } catch (error: any) {
      console.error("Analysis error:", error);
      return res.status(500).json({ error: "Failed to analyze resume" });
    }
  });

  return httpServer;
}
