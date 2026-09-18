# Autonomous UI Auditor

> **PRAGYAAN 2.0 / Clash of Devs Hackathon @ KMIT**  
> **Problem Statement P8:** Autonomous Agentic Black-Box UI/UX & Accessibility Testing Framework

---

## Phase 2: Browser Runtime & Target Navigation

Phase 2 establishes the end-to-end connection between the React developer dashboard, the Node.js TypeScript backend, and a real Playwright Chromium browser instance.

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
Target Application Page Opened & Verified
```

---

## Getting Started (Local Setup)

### 1. Prerequisites
- Node.js 18+ or 20+
- npm (v9+)

### 2. Install Dependencies
```bash
npm install
```

### 3. Install Playwright Chromium Browser
```bash
npx playwright install chromium
```

### 4. Start Development Server
```bash
npm run dev
```
The server will boot on `http://localhost:3000` (serving both the Express API and the Vite frontend).

---

## Testing Phase 2

1. Open `http://localhost:3000` in your browser.
2. In the **TARGET APPLICATION** section, enter a target URL (e.g. `https://example.com`).
3. (Optional) Enter a testing goal in the **TESTING GOAL** textarea (e.g. `Find blue running shoes under ₹8,000 and reach the product details page.`).
4. Click **RUN AGENT**.
5. Observe:
   - A real, visible Chromium browser window launches on your desktop.
   - The browser navigates to the specified URL.
   - The **AGENT STATUS** panel in the dashboard progresses:
     - `READY` → `STARTING BROWSER` → `TARGET PAGE OPENED`
     - Browser: `Active (Chromium - Visible Window)`
     - Agent: `Ready`
     - Current step: `01 - Navigate`
     - Current URL: Updates with the confirmed target URL
     - Page Title: Shows the retrieved `<title>` from the page.
   - The **LIVE JOURNEY** panel records the single verified navigation step.
   - The browser window remains open for observation.

---

## Architecture & Project Structure

```
├── server.ts                       # Express server + Vite development middleware
├── server/
│   ├── index.ts                    # API router mounting /api/agent
│   ├── routes/
│   │   └── agent.ts                # POST /api/agent/start, GET /api/agent/status
│   └── browser/
│       └── browserManager.ts       # Playwright Chromium manager (launch, navigate, inspect)
├── src/
│   ├── App.tsx                     # Main dashboard controller
│   ├── types/
│   │   └── index.ts                # Shared TypeScript contracts
│   ├── components/
│   │   ├── Header.tsx              # Application header & status indicator
│   │   ├── TargetApplication.tsx   # Target URL configuration
│   │   ├── TestingGoal.tsx         # Natural-language goal configuration
│   │   ├── RunAgentButton.tsx      # Execution button with loading & error states
│   │   ├── AgentStatusPanel.tsx    # Live browser runtime telemetry
│   │   ├── JourneyPanel.tsx        # Live journey execution tracer
│   │   ├── FindingsPanel.tsx       # Accessibility & UX metrics (0 in Phase 2)
│   │   ├── BrowserEvidencePanel.tsx# Browser screenshots placeholder (Phase 2)
│   │   └── AuditReportPanel.tsx    # Audit report summary placeholder (Phase 2)
│   └── index.css                   # Tailwind styling
├── package.json
└── README.md
```

---

## Phase Boundaries & Integrity

- **No Fake AI Simulation:** No synthetic Gemini reasoning or mock agent actions are simulated.
- **No Mock Findings:** Findings counters remain cleanly at 0 until real audits are implemented in future phases.
- **True Black-Box Testing:** Operates purely through external browser navigation without requiring access to the target application's source code or test hooks.
