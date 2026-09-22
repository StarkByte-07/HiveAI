# FlowSentry

> **PRAGYAAN 2.0 / Clash of Devs Hackathon @ KMIT**  
> **Problem Statement P8:** Autonomous Agentic Black-Box UI/UX & Accessibility Testing Framework

---

## Phase 3: Observation Engine

Phase 3 introduces a pure black-box **Observation Engine** that inspects target web applications through standard browser-observable accessibility and DOM APIs, paired with real Playwright screenshot capture.

```
User Input (Target URL + Natural Goal)
       ↓
React / TypeScript Dashboard (Vite)
       ↓
POST /api/agent/start (Express Server)
       ↓
BrowserManager (Playwright)
       ↓
Visible Chromium Window
       ↓
Target Application Page Opened
       ↓
ObservationEngine (server/observation/observationEngine.ts)
       ├── URL & Page Title
       ├── Visible Headings & Text Blocks
       ├── Standard Interactive Elements (role, name, tag, state)
       └── Live Viewport Screenshot (JPEG buffer / base64)
       ↓
Returned to Dashboard & Displayed in Real-Time
       ├── Page Observation Panel (Interactive elements, text, raw JSON)
       └── Browser Evidence Panel (Live Chromium Screenshot preview & modal)
```

---

## Local Setup & Quickstart

### 1. Prerequisites
- Node.js 18+ or 20+
- npm (v9+)

### 2. Install Dependencies
```bash
npm install
```

### 3. Install Playwright Chromium Browser (One-Time Setup)
```bash
npx playwright install chromium
```

### 4. Start Unified Development Server
```bash
npm run dev
```
The server will boot on `http://localhost:3000` (serving both the Express API and the Vite frontend).

---

## API Endpoints

- `POST /api/agent/start`: Launches visible Chromium, navigates to `targetUrl`, and automatically returns the structured observation and screenshot.
- `POST /api/agent/observe`: On-demand black-box observation of the currently active browser page without re-navigating.
- `GET /api/agent/screenshot`: Streams the latest real JPEG screenshot buffer captured by Playwright.
- `GET /api/agent/status`: Returns current browser lifecycle status and active page state.
- `GET /api/health`: Service health check.

---

## How to Test Phase 3

### Test Case A: Single-Page / Classic Site
1. Open `http://localhost:3000` in your browser.
2. Enter **Target Application**: `https://example.com/`
3. Enter **Testing Goal**: `Open the example website.`
4. Click **RUN AGENT**.
5. Verify:
   - Chromium launches and opens `https://example.com/`.
   - **Agent Status** transitions to `PAGE OBSERVED`.
   - **Page Observation Panel** displays:
     - URL: `https://example.com/`
     - Title: `Example Domain`
     - Interactive Elements: Link `Learn more` (`<a>`)
     - Visible Text: Domain documentation excerpt
   - **Browser Evidence Panel** displays the real screenshot of `example.com`.
   - **Live Journey** records:
     - `01 [NAVIGATE] Browser launched and target page opened: "Example Domain"`
     - `02 [OBSERVE] Observed target page: extracted 1 interactive elements...`

### Test Case B: Heavy Hydrated Modern App (IMDb)
1. In **Target Application**, enter: `https://www.imdb.com/`
2. In **Testing Goal**, enter: `Tell me what this website does.` (Goal is recorded but not executed yet, per Phase 3 rules).
3. Click **RUN AGENT**.
4. Verify:
   - Chromium opens IMDb.
   - FlowSentry extracts ~60 standard interactive elements (Search, Menu, Sign In, Links, Buttons) with standard accessibility roles (`button`, `link`, `textbox`, `searchbox`) and accessible names.
   - Headings like `"Featured today"`, `"Trending people"`, `"What to watch"` are captured.
   - Real screenshot of IMDb is displayed in the **Browser Evidence** panel.
   - Click **Re-inspect Page** to trigger `POST /api/agent/observe` on demand.

---

## Architecture & Project Structure

```
├── server.ts                             # Express server + Vite development middleware
├── server/
│   ├── index.ts                          # API router mounting /api/agent
│   ├── routes/
│   │   └── agent.ts                      # /api/agent/start, /observe, /screenshot, /status
│   ├── browser/
│   │   └── browserManager.ts             # Playwright Chromium manager
│   └── observation/
│       ├── observationTypes.ts           # Standard TypeScript observation contracts
│       └── observationEngine.ts          # Pure black-box DOM & accessibility observer
├── src/
│   ├── App.tsx                           # Main dashboard controller
│   ├── types/
│   │   └── index.ts                      # Shared TypeScript types
│   ├── components/
│   │   ├── Header.tsx                    # FlowSentry brand & status indicator
│   │   ├── TargetApplication.tsx         # Target URL input
│   │   ├── TestingGoal.tsx               # Natural-language goal configuration
│   │   ├── RunAgentButton.tsx            # Execution trigger with loading & error states
│   │   ├── AgentStatusPanel.tsx          # Real-time agent & browser telemetry
│   │   ├── PageObservationPanel.tsx      # Interactive elements, text & JSON viewer
│   │   ├── JourneyPanel.tsx              # Live journey execution tracer
│   │   ├── FindingsPanel.tsx             # Kept at 0 (analysis deferred to future phases)
│   │   ├── BrowserEvidencePanel.tsx      # Real Playwright screenshot viewer & modal
│   │   └── AuditReportPanel.tsx          # Empty state (deferred to future phases)
│   └── index.css                         # Tailwind styling
├── package.json
└── README.md.
```

---

## Strict Black-Box Principles

- **Zero Internal Knowledge:** Does not read target source code, test repositories, or proprietary test hooks.
- **Framework Agnostic:** Works against arbitrary web applications (HTML5, React, Next.js, Vue, vanilla).
- **Zero Simulation:** No fake agent clicks, typing, synthetic Gemini completions, or mock findings.
