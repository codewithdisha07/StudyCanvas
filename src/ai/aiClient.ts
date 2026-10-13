import type { GroundedContextPayload } from './contextBuilder';
import type { QuizQuestion, Flashcard } from '../types';

export interface ChatResponse {
  text: string;
  citations: string[];
  isInsufficient?: boolean;
}

export interface ExplainResponse {
  text: string;
  citations: string[];
}

export interface SummarizeResponse {
  text: string;
  citations: string[];
}

export interface QuizResponse {
  questions: QuizQuestion[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface RefineResponse {
  original: string;
  refined: string;
  explanationOfChanges?: string;
}

export interface FlashcardsResponse {
  flashcards: Flashcard[];
}

export interface RevisionSheetResponse {
  title: string;
  summary: string;
  keyConcepts: string[];
  formulas: string[];
  examQuestions: string[];
  citations?: string[];
}

async function postAI<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/ai/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AI Request Failed (${res.status}): ${errorText}`);
  }

  return await res.json();
}

export async function askAIChat(
  prompt: string,
  context: GroundedContextPayload,
  personaPrompt?: string
): Promise<ChatResponse> {
  return await postAI<ChatResponse>('chat', {
    prompt,
    context,
    images: context.images,
    personaPrompt,
  });
}

export async function explainConcept(
  concept: string,
  level: 'simple' | 'detailed' | 'eli5' | 'analogy',
  context: GroundedContextPayload
): Promise<ExplainResponse> {
  return await postAI<ExplainResponse>('explain', {
    concept,
    level,
    context,
    images: context.images,
  });
}

export async function summarizeNotes(
  length: 'short' | 'medium' | 'detailed',
  style: 'bullets' | 'paragraph',
  context: GroundedContextPayload
): Promise<SummarizeResponse> {
  return await postAI<SummarizeResponse>('summarize', {
    length,
    style,
    context,
    images: context.images,
  });
}

export async function generateQuiz(
  count: number,
  difficulty: 'easy' | 'medium' | 'hard',
  context: GroundedContextPayload
): Promise<QuizResponse> {
  return await postAI<QuizResponse>('quiz', {
    count,
    difficulty,
    context,
    images: context.images,
  });
}

export async function gradeShortAnswer(
  question: string,
  studentAnswer: string,
  expectedAnswer: string,
  context: GroundedContextPayload
): Promise<{ isCorrect: boolean; feedback: string }> {
  return await postAI<{ isCorrect: boolean; feedback: string }>('grade-short-answer', {
    question,
    studentAnswer,
    expectedAnswer,
    context,
  });
}

export async function refineContent(
  originalText: string,
  mode: 'simplify' | 'fix_grammar' | 'structured' | 'exam_ready',
  context: GroundedContextPayload
): Promise<RefineResponse> {
  return await postAI<RefineResponse>('refine', {
    originalText,
    mode,
    context,
  });
}

export async function generateFlashcards(
  count: number,
  context: GroundedContextPayload
): Promise<FlashcardsResponse> {
  return await postAI<FlashcardsResponse>('flashcards', {
    count,
    context,
    images: context.images,
  });
}

export async function generateRevisionSheet(
  context: GroundedContextPayload
): Promise<RevisionSheetResponse> {
  return await postAI<RevisionSheetResponse>('revision-sheet', {
    context,
    images: context.images,
  });
}

export interface TranscriptionBlock {
  type: 'heading' | 'paragraph' | 'list' | 'formula' | 'table';
  text: string;
  confidence: number;
  uncertainWords: string[];
}

export interface HandwritingResponse {
  blocks: TranscriptionBlock[];
  isLegible: boolean;
  legibilityNote?: string;
}

export async function transcribeHandwriting(
  context: GroundedContextPayload
): Promise<HandwritingResponse> {
  return await postAI<HandwritingResponse>('transcribe-handwriting', {
    context,
    images: context.images,
  });
}

export interface FeynmanFeedback {
  topic: string;
  scores: {
    accuracy: number;
    completeness: number;
    clarity: number;
    ownWords: number;
    overall: number;
  };
  coveredPoints: string[];
  missingPoints: string[];
  misconceptions: Array<{
    studentClaim: string;
    actualNoteFact: string;
    citation: string;
  }>;
  verdict: string;
  followUpQuestions: string[];
  isTopicInNotes: boolean;
}

export async function evaluateFeynman(
  topic: string,
  explanation: string,
  audience: string,
  context: GroundedContextPayload,
  personaPrompt?: string
): Promise<FeynmanFeedback> {
  return await postAI<FeynmanFeedback>('feynman', {
    topic,
    explanation,
    audience,
    context,
    personaPrompt,
  });
}

export interface MindMapNode {
  id: string;
  label: string;
  summary: string;
  level: number;
  pageRefs: number[];
  parentId?: string;
}

export interface MindMapEdge {
  from: string;
  to: string;
  type: 'parent' | 'relatedTo';
  label?: string;
}

export interface MindMapResponse {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

export async function generateMindMap(
  context: GroundedContextPayload
): Promise<MindMapResponse> {
  return await postAI<MindMapResponse>('mindmap', {
    context,
  });
}

// Quiz Battle Client API
export async function createBattleRoom(title: string, questions: QuizQuestion[], mode = 'async') {
  const res = await fetch('/api/battle/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, questions, mode }),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function joinBattleRoom(roomCode: string, nickname: string) {
  const res = await fetch(`/api/battle/${roomCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function submitBattleAnswer(
  roomCode: string,
  playerId: string,
  questionIndex: number,
  selectedOption: string,
  timeTakenMs: number
) {
  const res = await fetch(`/api/battle/${roomCode}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId, questionIndex, selectedOption, timeTakenMs }),
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function getBattleState(roomCode: string) {
  const res = await fetch(`/api/battle/${roomCode}/state`);
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

