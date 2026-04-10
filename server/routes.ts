import type { Express } from "express";
import { createServer, type Server } from "http";
import { createRequire } from "module";
import multer from "multer";
// import OpenAI from "openai"; <--- Removed
import { GoogleGenerativeAI } from "@google/generative-ai"; // Added Gemini
import mammoth from "mammoth";
import { analyzeRequestSchema, type AnalysisResult } from "@shared/schema";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (
  buffer: Buffer,
) => Promise<{ text: string }>;

// --- GEMINI SETUP ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({
  model: "gemini-pro",
  generationConfig: { responseMimeType: "application/json" },
});

/* // OLD OPENAI CODE - COMMENTED OUT TO PREVENT CRASH
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});
*/

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and Word documents (.doc, .docx) are supported"));
    }
  },
});

async function extractTextFromFile(
  buffer: Buffer,
  mimetype: string,
): Promise<string> {
  if (mimetype === "application/pdf") {
    const data = await pdfParse(buffer);
    return data.text.trim();
  }

  if (
    mimetype === "application/msword" ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  throw new Error("Unsupported file type");
}

const SYSTEM_PROMPT = `You are an expert AI hiring assistant and senior technical recruiter with 15+ years of experience across all industries. Your role is to perform deep semantic analysis comparing a candidate's resume against a job description.

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
- 85-100: Excellent
- 70-84: Good
- 50-69: Moderate
- 0-49: Weak`;

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // File text extraction endpoint
  app.post("/api/extract-text", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const text = await extractTextFromFile(
        req.file.buffer,
        req.file.mimetype,
      );
      if (!text || text.length < 10) {
        return res
          .status(422)
          .json({ error: "Could not extract readable text from this file." });
      }
      return res.json({ text });
    } catch (error: any) {
      console.error("Text extraction error:", error);
      return res
        .status(500)
        .json({ error: error.message || "Failed to extract text from file" });
    }
  });

  // Main analysis endpoint (REPLACED OPENAI WITH GEMINI)
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

      const userMessage = `Resume:\n${resume}\n\nJob Description:\n${jobDescription}\n\nAnalyze the resume against this job description and return the JSON analysis.`;

      // Gemini API Call
      const result_ai = await model.generateContent([
        { text: SYSTEM_PROMPT },
        { text: userMessage },
      ]);

      const content = result_ai.response.text();

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
      return res.status(500).json({
        error: "Failed to analyze resume. Check your Gemini API Key.",
      });
    }
  });

  return httpServer;
}
