import type { Express } from "express";
import { createServer, type Server } from "http";
import { createRequire } from "module";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import { analyzeRequestSchema, type AnalysisResult } from "@shared/schema";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (
  buffer: Buffer,
) => Promise<{ text: string }>;

// --- GEMINI SETUP ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel(
  {
    model: "gemini-2.0-flash", // Stable workhorse for 2026
  },
  { apiVersion: "v1" },
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF and Word documents are supported"));
  },
});

async function extractTextFromFile(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === "application/pdf") {
    const data = await pdfParse(buffer);
    return data.text.trim();
  }
  if (mimetype.includes("word") || mimetype.includes("officedocument")) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }
  throw new Error("Unsupported file type");
}

const SYSTEM_PROMPT = `You are an expert technical recruiter. Analyze the resume against the job description.
Return ONLY a JSON object with this EXACT structure:
{
  "score": <0-100>,
  "level": "Excellent" | "Good" | "Moderate" | "Weak",
  "strongMatches": ["bullet", "bullet"],
  "gaps": ["bullet", "bullet"],
  "transferableSkills": ["bullet", "bullet"],
  "finalAssessment": "2-3 sentences"
}`;

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.post("/api/extract-text", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file" });
      const text = await extractTextFromFile(req.file.buffer, req.file.mimetype);
      return res.json({ text });
    } catch (error: any) {
      res.status(500).json({ error: "Text extraction failed" });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const parsed = analyzeRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

      const { resume, jobDescription } = parsed.data;
      const userMessage = `Resume: ${resume}\n\nJD: ${jobDescription}\n\nAnalyze and return raw JSON.`;

      let attempts = 0;
      const maxAttempts = 3;
      let text = "";

      // --- RETRY LOOP ---
      while (attempts < maxAttempts) {
        try {
          const result_ai = await model.generateContent(SYSTEM_PROMPT + "\n\n" + userMessage);
          const response = await result_ai.response;
          text = response.text();
          if (text) break;
        } catch (error: any) {
          if (error.message.includes("503") || error.message.includes("demand")) {
            attempts++;
            await new Promise(r => setTimeout(r, 2000));
          } else {
            throw error;
          }
        }
      }

      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const result: AnalysisResult = JSON.parse(cleanJson);

      if (result.score >= 85) result.level = "Excellent";
      else if (result.score >= 70) result.level = "Good";
      else if (result.score >= 50) result.level = "Moderate";
      else result.level = "Weak";

      return res.json(result);
    } catch (error: any) {
      console.error("ANALYSIS ERROR:", error.message);
      return res.status(500).json({ error: "Analysis failed", details: error.message });
    }
  });

  return httpServer;
}