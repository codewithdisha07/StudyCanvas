export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export type ToolType = 'pen' | 'highlighter' | 'eraser' | 'text' | 'select' | 'pan';
export type BackgroundType = 'blank' | 'ruled' | 'grid' | 'dotted';

export interface Stroke {
  id: string;
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  size: number;
  opacity: number;
  points: Point[];
}

export interface TextBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  text: string;
  fontSize: number;
  color: string;
}

export interface Page {
  id: string;
  projectId: string;
  title: string;
  strokes: Stroke[];
  textBoxes: TextBox[];
  background: BackgroundType;
  pageNumber?: number;
  text?: string;
  thumbnail?: string; // dataURL
  contentHash?: string;
  updatedAt: number;
}

export interface Project {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pageOrder: string[];
}

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  sourcePageId?: string;
  sourcePageNumber: number;
  topic: string;
}

export interface QuizAttempt {
  id: string;
  projectId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questions: QuizQuestion[];
  answers: Record<string, string>;
  score: number;
  topicStats: Record<string, { total: number; correct: number }>;
  createdAt: number;
}

export interface Flashcard {
  id: string;
  projectId: string;
  front: string;
  back: string;
  sourcePageId?: string;
  sourcePageNumber: number;
  confidence: 'know' | 'learning' | 'unreviewed';
  box: number; // Leitner box (1 to 5)
  nextReviewAt: number;
}

export interface NotesDigestCache {
  id: string;
  pageId: string;
  contentHash: string;
  digest: string;
  updatedAt: number;
}

export type AIScope = 'current' | 'project' | 'selection';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// -------------------------------------------------------------
// Phase 5, 6, 7 Data Models
// -------------------------------------------------------------

export interface StudySession {
  id: string;
  projectId: string;
  startedAt: number;
  focusSeconds: number;
  completed: boolean;
  type: 'pomodoro' | 'short-break' | 'long-break';
}

export type XpActionType =
  | 'focus_session'
  | 'create_page'
  | 'edit_page'
  | 'finish_quiz'
  | 'review_flashcard'
  | 'feynman_attempt'
  | 'planner_task'
  | 'voice_tool_first_use'
  | 'handwriting_tool_first_use';

export interface XpEvent {
  id: string;
  action: XpActionType;
  xp: number;
  dateStr: string; // YYYY-MM-DD local date
  projectId?: string;
  timestamp: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: number;
  progress?: number;
  maxProgress?: number;
}

export interface UserStats {
  id: string; // 'default'
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  streakFreezes: number;
  earnedBadges: string[]; // Badge IDs
  badges?: string[];
}

export interface HandwritingBlock {
  type: 'heading' | 'paragraph' | 'list' | 'formula' | 'table';
  text: string;
  confidence: number;
  uncertainWords: string[];
}

export interface HandwritingTranscript {
  id: string;
  pageId: string;
  projectId: string;
  blocks: HandwritingBlock[];
  rawText: string;
  createdAt: number;
}

export interface FeynmanAttempt {
  id: string;
  projectId: string;
  topic: string;
  audience: 'grade6' | 'peer';
  studentExplanation: string;
  scores: {
    accuracy: number;
    completeness: number;
    clarity: number;
    ownWords: number;
  };
  coveredPoints: string[];
  missingPoints: string[];
  misconceptions: {
    statement?: string;
    actualNote?: string;
    studentClaim?: string;
    actualNoteFact?: string;
    citation: string;
  }[];
  verdict: string;
  followUpQuestions: string[];
  createdAt: number;
}

export interface MindMapNode {
  id: string;
  label: string;
  summary: string;
  level: number;
  pageRefs: number[];
  x?: number;
  y?: number;
  isUserEdited?: boolean;
}

export interface MindMapEdge {
  from: string;
  to: string;
  type: 'parent' | 'relatedTo';
  label?: string;
}

export interface MindMapRecord {
  id: string;
  projectId: string;
  contentHash: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  updatedAt: number;
}

export interface ExamPlanTopic {
  id: string;
  name: string;
  importance?: number; // 1-5
  weight?: number;
  difficulty?: number;
  estimatedDifficulty?: 'easy' | 'medium' | 'hard';
  pageRefs: number[];
}

export type ExamTopic = ExamPlanTopic;

export interface ExamPlanTask {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'study' | 'revision' | 'flashcards' | 'quiz' | 'feynman' | 'mock-quiz' | 'light-review' | 'first_pass' | 'mock_exam' | 'revision_sheet' | string;
  title?: string;
  topicId: string;
  topicName: string;
  pageRefs?: number[];
  durationMinutes: number;
  completed?: boolean;
  status?: 'completed' | 'pending';
  xpAwarded?: boolean;
}

export type ExamTask = ExamPlanTask;

export interface ExamPlanRecord {
  id: string;
  projectId: string;
  examName: string;
  examDate: string; // YYYY-MM-DD
  dailyAvailabilityMinutes?: Record<string, number>; // 'mon', 'tue', etc.
  availabilityHoursPerDay?: number;
  daysOff: string[] | number[]; // ['sun'] or [0]
  targetScore?: number;
  topics: ExamPlanTopic[];
  tasks: ExamPlanTask[];
  createdAt: number;
  updatedAt: number;
}

export type PersonaId = 'friendly-peer' | 'strict-tutor' | 'socratic-coach' | 'hype-coach' | 'calm-mentor';

export interface PersonaConfig {
  id: PersonaId;
  name: string;
  avatar: string;
  toneDescription: string;
  systemPromptLayer: string;
}

export interface AppSettings {
  id: string; // 'default'
  persona: PersonaId;
  ttsRate: number;
  ttsPitch: number;
  ttsVoiceName?: string;
  voiceLanguage: string;
  gamificationEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface BattleRecord {
  id: string;
  roomCode: string;
  title: string;
  projectId: string;
  hostNickname: string;
  mode: 'live' | 'async';
  questionsCount: number;
  createdAt: number;
}
