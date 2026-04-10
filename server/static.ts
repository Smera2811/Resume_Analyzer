import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import fs from "fs";
import path from "path";
import express, { type Express } from "express";

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function serveStatic(app: Express) {
  // On Render, the build folder is usually one level up from the server folder
  const distPath = resolve(__dirname, "..", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}. Make sure 'npm run build' completed successfully.`,
    );
  }

  // Serve the static files from the public directory
  app.use(express.static(distPath));

  // Fall through to index.html for any routes not handled by the API
  // This is essential for Single Page Applications (React/Wouter)
  app.get("*", (_req, res) => {
    res.sendFile(resolve(distPath, "index.html"));
  });
}
