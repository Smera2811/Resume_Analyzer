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
// Using gemini-3.1-flash-lite-preview for the best current performance/availability balance
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel(
  {
    model: "gemini-3.1-flash-lite-preview",
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
  // File text extraction endpoint
  app.post("/api/extract-text", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file" });
      const text = await extractTextFromFile(
        req.file.buffer,
        req.file.mimetype,
      );
      return res.json({ text });
    } catch (error: any) {
      console.error("Extraction error:", error.message);
      res.status(500).json({ error: "Text extraction failed" });
    }
  });

  // Main analysis endpoint with Retry Logic
  app.post("/api/analyze", async (req, res) => {
    try {
      const parsed = analyzeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      }

      const { resume, jobDescription } = parsed.data;

      const userMessage = `
        Resume Content: ${resume}
        Job Description: ${jobDescription}

        Task: Analyze this resume against the job description.
        Return ONLY a raw JSON object. Do not include markdown formatting or backticks.
      `;

      let attempts = 0;
      const maxAttempts = 3;
      let text = "";
      let lastError = null;

      // --- RETRY LOOP START ---
      while (attempts < maxAttempts) {
        try {
          const result_ai = await model.generateContent(
            SYSTEM_PROMPT + "\n\n" + userMessage,
          );
          const response = await result_ai.response;
          text = response.text();

          if (text) break; // Success! Break out of loop.
        } catch (error: any) {
          lastError = error;
          // Check if it's a 503 (Overloaded) error to trigger a retry
          if (error.message.includes("503") || error.message.includes("high demand") || error.message.includes("Service Unavailable")) {
            attempts++;
            console.warn(`Gemini busy (Attempt ${attempts}/${maxAttempts}). Retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            // For 400, 401, 404, or 403, we don't retry as the error is permanent
            throw error;
          }
        }
      }
      // --- RETRY LOOP END ---

      if (!text) {
        throw new Error(`Failed after ${maxAttempts} attempts. Error: ${lastError?.message}`);
      }

      // Clean up markdown in case the AI adds it
      const cleanJson = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const result: AnalysisResult = JSON.parse(cleanJson);

      // Scoring levels normalization
      if (result.score >= 85) result.level = "Excellent";
      else if (result.score >= 70) result.level = "Good";
      else if (result.score >= 50) result.level = "Moderate";
      else result.level = "Weak";

      return res.json(result);
    } catch (error: any) {
      console.error("ANALYSIS ERROR:", error.message);
      return res.status(500).json({
        error: "Analysis failed",
        details: error.message,
      });
    }
  });

  return httpServer;
}