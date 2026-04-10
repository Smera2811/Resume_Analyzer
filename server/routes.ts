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
// We force 'v1' to avoid the 'v1beta' 404 error you were seeing in the logs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
}, { apiVersion: 'v1' });

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
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  throw new Error("Unsupported file type");
}

const SYSTEM_PROMPT = `You are an expert AI hiring assistant and senior technical recruiter with 15+ years of experience. Your role is to perform deep semantic analysis. 
You must return a VALID JSON object with this structure:
{
  "score": <integer 0-100>,
  "level": <string>,
  "strongMatches": [<array>],
  "gaps": [<array>],
  "transferableSkills": [<array>],
  "finalAssessment": <string>
}`;

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {

  app.post("/api/extract-text", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const text = await extractTextFromFile(req.file.buffer, req.file.mimetype);
      if (!text || text.length < 10) {
        return res.status(422).json({ error: "Could not extract readable text." });
      }
      return res.json({ text });
    } catch (error: any) {
      console.error("Text extraction error:", error);
      return res.status(500).json({ error: "Failed to extract text" });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const parsed = analyzeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request data" });
      }

      const { resume, jobDescription } = parsed.data;
      const userMessage = `Resume:\n${resume}\n\nJob Description:\n${jobDescription}\n\nAnalyze and return JSON.`;

      // Main Gemini API Call with JSON configuration
      const result_ai = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + userMessage }] }
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const response = await result_ai.response;
      const content = response.text();

      if (!content) {
        throw new Error("Empty response from Gemini");
      }

      const result: AnalysisResult = JSON.parse(content);

      // Auto-calculate level based on score
      if (result.score >= 85) result.level = "Excellent";
      else if (result.score >= 70) result.level = "Good";
      else if (result.score >= 50) result.level = "Moderate";
      else result.level = "Weak";

      return res.json(result);
    } catch (error: any) {
      // Improved error logging for Render
      console.error("Analysis error detailed:", error.message || error);
      return res.status(500).json({
        error: "Failed to analyze resume. Check your Gemini API Key.",
        details: error.message
      });
    }
  });

  return httpServer;
}