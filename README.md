# StudyCanvas AI 🎨📚

> **StudyCanvas AI** is an intelligent, offline-capable digital study notebook that combines raw HTML5 Canvas handwriting and diagrams, multi-page vector project organization, and a Generative AI study assistant strictly grounded in the student's own notes.

---

## 🌟 Key Features

### 🖌️ Phase 1: High-Performance Canvas Note Editor
- **Raw HTML Canvas 2D Engine**: No bloated canvas libraries. Pointer events (`pointerdown`, `pointermove`, `pointerup`) with pressure sensitivity and quadratic Bézier curve smoothing for natural pen flow on mouse, touch, and stylus.
- **Tools**:
  - **Pen**: Precision strokes with adjustable color, thickness (1–20px), and opacity.
  - **Highlighter**: Semi-transparent highlighter with multiply blending.
  - **Eraser**: Stroke-level collision detection and brush erasing.
  - **Text Tool**: Place text boxes anywhere, drag to move, double-click to edit inline.
  - **Selection Lasso (S)**: Bounding box selection for quick deletion or contextual AI assistance.
  - **Pan & Zoom**: Infinite smooth pan and zoom (0.25x to 4.0x) with keyboard shortcut support.
- **Paper Backgrounds**: Blank, Ruled, Grid, and Dotted backgrounds rendered crisply across any DPI.
- **Undo / Redo**: Per-page history stack with `Ctrl+Z` / `Ctrl+Shift+Z`.
- **Autosave**: Debounced offline persistence to IndexedDB via Dexie with live "Saved" indicator.

### 📑 Phase 2: Project & Multi-Page Management
- **Dashboard**: Card grid showing projects, first-page thumbnail previews, last-edited timestamps, create, rename, duplicate, search, and delete with confirmations.
- **Left Sidebar**: Page thumbnails with real-time vector previews, add page, rename, delete, and drag-and-drop reordering.
- **High-Resolution PDF Export**: Vector-to-image re-rendering at 2x DPI using `jsPDF`. Export the full project in user-defined page order with progress indicators, or export single pages.

### 🤖 Phase 3: Grounded AI Study Assistant
- **Scope Selector**:
  - `Current Page`: Inspects current page strokes and text.
  - `Entire Project`: Synthesizes across all notebook pages in order.
  - `Selected Area`: Crops the user's selection bounding box for focused inquiry.
- **Context Builder Module (`src/ai/contextBuilder.ts`)**:
  - Extracts typed text boxes with `[Page N: Title]` headers.
  - Generates high-resolution PNG snapshots of handwritten strokes and diagrams for multimodal vision input.
  - Computes stable `contentHash` and maintains a per-page digest cache to minimize token consumption and avoid re-processing unchanged pages.
- **Strict Grounding Rules**:
  - System prompt strictly mandates answers be grounded **only** in the provided notes.
  - Answers cite sources in the format `[Page N]`. Citations are interactive buttons in the chat UI that click-to-jump directly to the referenced page.
  - If a topic is absent, the assistant states: *"Your notes don't cover this. Here is what they do mention: ... Consider adding notes on: ..."*
- **Non-Destructive Refinement Confirmation**:
  - Side-by-side preview modal compares Original Notes vs. AI Suggestion.
  - Options: *"Replace original"*, *"Insert as new text box"*, *"Add as new page"*, or *"Discard"*.
- **Quick AI Study Actions**:
  - Explain Concept (Simple, Detailed, ELI5, Analogy).
  - Summarize (Short Bullets, Medium Bullets, Detailed Paragraph).
  - Generate Adaptive Quizzes.
  - Refine & Structure Notes.

### 🏆 Phase 4: Brownie Points
- **AI Flashcards**: Automatic card extraction, 3D interactive flip card viewer, Leitner 5-box spaced repetition algorithm, and "Know It" / "Still Learning" tracking.
- **Adaptive Study Quiz**: Interactive quiz taking (Multiple Choice, True/False, and AI-graded Short Answer) with topic accuracy tracking, difficulty calibration (Easy, Medium, Hard), and confetti celebrations.
- **Smart Revision Sheet**: 1-click synthesis of Key Concepts, Definitions, Formulas, and Likely Exam Questions into a printable 1-page PDF or new canvas page.
- **Floating Selection Menu**: Lasso-select any diagram or paragraph on canvas to immediately trigger Explain, Summarize, or Refine.

### 🎙️ Phase 5: Accessibility & Multimodal Input
- **TTS Read-Aloud (`CanvasReaderBar.tsx`)**:
  - Web Speech API integration with sentence-level visual highlight synchronization.
  - Sentence splitter using `Intl.Segmenter` with punctuation regex fallback (resolves the long-utterance cutoff bug).
  - Floating player bar with pause, resume, speed control, and skip forward/back.
- **Voice Dictation & Voice Questions (`VoiceDictationModal.tsx`)**:
  - Real-time continuous speech-to-text with auto-punctuation.
  - Natural commands: *"New line"*, *"Full stop"*, *"Comma"*, *"New page"*.
  - Voice query button in AI Chat with a 2-second silence auto-send countdown.
- **Handwriting-to-Typed-Text Vision Review (`HandwritingReviewModal.tsx`)**:
  - Side-by-side diff review of handwritten ink strokes vs. Gemini multimodal transcription.
  - Low-confidence words visually flagged with amber underlays for student correction.
  - Preserves formatting: headings, bullet lists, math equations, and tables.
  - Non-destructive canvas replacement with full Undo (`Ctrl+Z`) support.

### 🎮 Phase 6: Engagement & Gamification
- **Persistent Pomodoro Timer (`PomodoroWidget.tsx`)**:
  - 25m Focus / 5m Break / 15m Long Break sessions with audio chimes and browser notifications.
  - Survives page refreshes using epoch start timestamps in `localStorage`.
  - Distraction-Free Focus Mode: Collapses sidebars, expands canvas, and locks tools.
  - IndexedDB study session logging and daily focus minute tracking.
- **52-Week Activity Heatmap (`Heatmap.tsx`)**:
  - GitHub-style SVG activity contribution grid mapping daily XP and session intensity.
  - Interactive cell tooltips displaying date and XP earned.
- **Gamification & Badges (`LevelBar.tsx`, `BadgeGrid.tsx`)**:
  - Level progression calculated as `Level = floor(sqrt(XP / 100)) + 1`.
  - 14 unlockable achievements across Streaks, Mastery, Study, and Tools.
- **Multiplayer Quiz Battle (`QuizBattleModal.tsx`, `server/battle.js`)**:
  - SQLite-backed multiplayer quiz room engine with 6-character room codes.
  - Live Server-Sent Events (SSE) leaderboard streaming for real-time scores and speed bonuses.
  - Asynchronous challenge link mode for asynchronous peer battles.

### 🧠 Phase 7: Pedagogy & Personalization
- **Feynman "Teach-It-Back" Mode (`FeynmanModal.tsx`)**:
  - Student explains a concept in their own words (typed or dictated).
  - Rubric evaluation across 4 dimensions: Accuracy, Completeness, Clarity, and Own Words (scored /10).
  - Misconception detector directly contrasting student claim vs. notes citation fact.
  - Socratic follow-up questions to reinforce understanding.
- **AI Study Buddy Personas (`PersonaSelector.tsx`, `personaConfig.ts`)**:
  - Switch between 5 distinct pedagogical styles: Friendly Peer, Strict Tutor, Socratic Coach, Hype Coach, and Calm Mentor.
  - System prompt layer composition preserving 100% strict notes grounding and citations.
- **Interactive Mind Map Synthesizer (`MindMapModal.tsx`)**:
  - Automatic concept extraction into hierarchical nodes and relational cross-links.
  - Responsive D3 tree visualization with zoom/pan controls, search, and page reference jumps.
  - 1-click export as SVG or insertion as a new vector canvas page.
- **Exam Countdown Planner (`ExamPlannerModal.tsx`, `scheduler.ts`)**:
  - Deterministic spaced-repetition scheduler (First Pass -> Practice Quiz -> Spaced Review -> Revision Sheet).
  - Configurable daily hours and days off.
  - 1-click calendar export (`.ics` format compatible with Google Calendar, Apple Calendar, and Outlook).
- **Central Study Hub (`StudyHub.tsx`)**:
  - Comprehensive student command center uniting Level progression, Today's focus time, Heatmap, Feynman history, Badges, and 1-click tool shortcuts.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Canvas-Confetti.
- **Canvas Engine**: Raw Canvas 2D API, Pointer Events, Quadratic Bézier Curve Smoothing, DPR handling.
- **Persistence**: IndexedDB (Dexie.js).
- **PDF Export**: jsPDF with offscreen vector rendering.
- **Backend AI Proxy**: Node.js & Express (`/api/ai`), dotenv.
- **AI Model**: Google Gemini 2.5 Flash (`gemini-2.5-flash`) with multimodal image support and structured JSON schemas (`responseSchema`). Includes a high-fidelity Grounded Fallback Engine for offline testing.

```
├── server/
│   ├── index.js              # Express proxy router for /api/ai endpoints
│   ├── geminiService.js      # Gemini 2.5 Flash API caller & Grounded Fallback Engine
│   └── run-dev.js            # Unified cross-platform dev runner
├── src/
│   ├── canvas/
│   │   └── CanvasEngine.ts   # Raw 2D canvas smoothing, backgrounds, hit testing
│   ├── ai/
│   │   ├── contextBuilder.ts # Context Builder (snapshots + text + contentHash cache)
│   │   └── aiClient.ts       # Frontend client for AI proxy endpoints
│   ├── db/
│   │   └── index.ts          # Dexie IndexedDB schemas, seed data & queries
│   ├── export/
│   │   └── pdfExporter.ts    # Multi-page vector PDF generation using jsPDF
│   ├── components/
│   │   ├── canvas/           # CanvasView, Toolbar, SelectionMenu
│   │   ├── pages/            # PageSidebar (thumbnails, reordering, export)
│   │   ├── projects/         # ProjectDashboard (project cards, search, CRUD)
│   │   └── ai/               # AIChatPanel, QuizModal, FlashcardsModal, RefinementModal, RevisionSheetModal, PersonalizedDashboardModal
│   ├── types/
│   │   └── index.ts          # Comprehensive TypeScript interfaces
│   ├── test/
│   │   └── grounding.test.ts # Vitest unit tests for context builder & grounding
│   ├── App.tsx               # Workspace shell
│   ├── main.tsx
│   └── index.css             # Tailwind CSS & theme tokens
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js v18 or later
- npm v9 or later

### 2. Installation
```bash
# Clone or navigate to the repository
cd Education

# Install dependencies
npm install
```

### 3. Configure Gemini API Key
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and add your Google Gemini API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=3001
```
*(Note: If no API key is provided, the application automatically uses the built-in Grounded Fallback Engine so all features, quizzes, flashcards, and strict refusal rules remain 100% testable and functional offline!)*

### 4. Running the App
Run both the Vite frontend and Express AI proxy server with one command:
```bash
npm run dev
```
Open your browser at:
```
http://localhost:5173
```

### 5. Running Tests
Execute the unit test suite verifying context builder hashing and strict grounding rules:
```bash
npm run test
```

### 6. Building for Production
```bash
npm run build
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `P` | Pen Tool |
| `H` | Highlighter Tool |
| `E` | Eraser Tool |
| `T` | Text Box Tool |
| `S` | Selection Lasso Tool |
| `Space` | Pan Workspace (Hold and drag) |
| `Ctrl + Z` | Undo last stroke / edit |
| `Ctrl + Shift + Z` | Redo |
| `Escape` | Dismiss Selection |

---

## 🎬 Demo Walkthrough Script

1. **Open Seeded Project**: On the home dashboard, click the seeded notebook *"CS 229: Deep Learning & Neural Architectures"*.
2. **Page Navigation & Drawing**:
   - Use the left thumbnail strip to switch between **Page 1**, **Page 2**, and **Page 3**.
   - Select the **Pen** (`P`), choose an indigo color from the palette, and draw an annotation.
   - Select the **Text Box** (`T`), click anywhere on the page, and type a definition.
   - Observe the **"Saved (IndexedDB)"** badge update at the bottom left.
3. **AI Study Assistant (Grounded Q&A)**:
   - In the right-side chat panel, ask: *"What does the chain rule compute in backpropagation?"*
   - Note the grounded answer citing `[Page 2]`. Click the `[Page 2]` citation button to automatically navigate directly to that page!
4. **Strict Grounding Refusal**:
   - Ask: *"What is the capital of Australia?"*
   - Note that the AI refuses to hallucinate: *"Your notes don't cover this. Here is what they do mention: ... Consider adding notes on: ..."*
5. **Interactive Adaptive Quiz**:
   - Click the **Quiz** button.
   - Complete the multiple-choice, true/false, and short-answer questions.
   - Submit your answers and enjoy the score breakdown and confetti celebration!
6. **Spaced Repetition Flashcards**:
   - Click the **Flashcards** button.
   - Click the card to flip it in 3D. Mark *"Know It!"* to advance its Leitner box level.
7. **Smart Revision Sheet & PDF Export**:
   - Click **Revision Sheet** to view the one-page synthesized cheat sheet.
   - Click **"Export Revision PDF"** or export the entire project via the sidebar's **"Full PDF"** button.
#   S t u d y C a n v a s  
 #   S t u d y C a n v a s  
 #   S t u d y C a n v a s  
 #   S t u d y C a n v a s  
 