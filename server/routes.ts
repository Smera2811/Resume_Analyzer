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
// We use 'v1' to ensure we are on the stable production endpoint
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel(
  {
    model: "gemini-1.5-flash",
  },
  { apiVersion: "v1" },
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
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

async function extractTextFromFile(
  buffer: Buffer,
  mimetype: string,
): Promise<string> {
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

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.post("/api/extract-text", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file" });
      const text = await extractTextFromFile(
        req.file.buffer,
        req.file.mimetype,
      );
      return res.json({ text });
    } catch (error: any) {
      res.status(500).json({ error: "Text extraction failed" });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const parsed = analyzeRequestSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "Invalid data" });

      const { resume, jobDescription } = parsed.data;
      const finalPrompt = `${SYSTEM_PROMPT}\n\nResume: ${resume}\n\nJD: ${jobDescription}\n\nReturn JSON only.`;

      // We removed generationConfig here to fix the "Unknown name responseMimeType" error
      const result_ai = await model.generateContent(finalPrompt);
      const response = await result_ai.response;
      let text = response.text();

      // CLEANUP: Removes markdown backticks if Gemini adds them
      text = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const result: AnalysisResult = JSON.parse(text);

      // Final scoring logic
      if (result.score >= 85) result.level = "Excellent";
      else if (result.score >= 70) result.level = "Good";
      else if (result.score >= 50) result.level = "Moderate";
      else result.level = "Weak";

      return res.json(result);
    } catch (error: any) {
      console.error("Analysis Crash:", error.message);
      return res.status(500).json({
        error: "Analysis failed",
        details: error.message,
      });
    }
  });

  return httpServer;
}
