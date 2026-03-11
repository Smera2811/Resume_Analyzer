# ResumeMatch AI

An AI-powered resume vs. job description matcher that performs deep semantic analysis to surface real alignment, gaps, and transferable skills — the way an expert recruiter would.

## Features

- **Semantic matching** — not keyword-based; uses GPT to understand conceptual alignment
- **Match Score (0–100)** with level (Excellent / Good / Moderate / Weak)
- **Strong Matches** — specific evidence from the resume that addresses the role
- **Gaps & Missing Requirements** — concrete, actionable gaps
- **Transferable Skills** — unlisted skills that add value
- **Final Assessment** — 2–3 sentence recruiter-style summary
- **Dark mode** toggle
- Animated results with framer-motion

## Architecture

- **Frontend**: React + Vite, TailwindCSS, shadcn/ui, framer-motion, wouter, TanStack Query
- **Backend**: Express.js with a single stateless `/api/analyze` endpoint
- **AI**: OpenAI gpt-5.2 via Replit AI Integrations (no API key needed)
- **No database** — purely stateless analysis tool

## Key Files

- `client/src/pages/home.tsx` — Main UI page (input form + results display)
- `server/routes.ts` — POST `/api/analyze` endpoint + AI system prompt
- `shared/schema.ts` — Zod schemas for request/response validation

## Running

The `Start application` workflow runs `npm run dev` which starts both the Express API and Vite dev server on port 5000.

## Environment

Uses `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` — auto-configured by Replit AI Integrations.
