import Dexie, { type Table } from 'dexie';
import type {
  Project,
  Page,
  QuizAttempt,
  Flashcard,
  NotesDigestCache,
  StudySession,
  XpEvent,
  UserStats,
  HandwritingTranscript,
  FeynmanAttempt,
  MindMapRecord,
  ExamPlanRecord,
  AppSettings,
  BattleRecord,
  XpActionType,
} from '../types';

export type {
  Project,
  Page,
  QuizAttempt,
  Flashcard,
  NotesDigestCache,
  StudySession,
  XpEvent,
  UserStats,
  HandwritingTranscript,
  FeynmanAttempt,
  MindMapRecord,
  ExamPlanRecord,
  AppSettings,
  BattleRecord,
  XpActionType,
};

export class StudyCanvasDB extends Dexie {
  projects!: Table<Project, string>;
  pages!: Table<Page, string>;
  quizzes!: Table<QuizAttempt, string>;
  flashcards!: Table<Flashcard, string>;
  digests!: Table<NotesDigestCache, string>;

  // Schema v2 tables
  studySessions!: Table<StudySession, string>;
  xpEvents!: Table<XpEvent, string>;
  userStats!: Table<UserStats, string>;
  handwritingTranscripts!: Table<HandwritingTranscript, string>;
  feynmanAttempts!: Table<FeynmanAttempt, string>;
  mindMaps!: Table<MindMapRecord, string>;
  examPlans!: Table<ExamPlanRecord, string>;
  appSettings!: Table<AppSettings, string>;
  battleHistory!: Table<BattleRecord, string>;

  constructor() {
    super('StudyCanvasAI_DB');
    this.version(1).stores({
      projects: 'id, title, updatedAt, createdAt',
      pages: 'id, projectId, updatedAt',
      quizzes: 'id, projectId, createdAt, difficulty',
      flashcards: 'id, projectId, sourcePageId, confidence, box',
      digests: 'id, pageId, contentHash',
    });

    // Version 2 migration
    this.version(2).stores({
      studySessions: 'id, projectId, startedAt, completed, type',
      xpEvents: 'id, action, dateStr, timestamp, projectId',
      userStats: 'id',
      handwritingTranscripts: 'id, pageId, projectId, createdAt',
      feynmanAttempts: 'id, projectId, topic, createdAt',
      mindMaps: 'id, projectId, contentHash, updatedAt',
      examPlans: 'id, projectId, examDate, updatedAt',
      appSettings: 'id',
      battleHistory: 'id, roomCode, createdAt',
    });
  }
}

export const db = new StudyCanvasDB();

// -------------------------------------------------------------
// Existing Helper Functions
// -------------------------------------------------------------

export async function getAllProjects(): Promise<Project[]> {
  return await db.projects.orderBy('updatedAt').reverse().toArray();
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  return await db.projects.get(id);
}

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put(project);
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.pages, db.quizzes, db.flashcards, async () => {
    await db.projects.delete(id);
    await db.pages.where('projectId').equals(id).delete();
    await db.quizzes.where('projectId').equals(id).delete();
    await db.flashcards.where('projectId').equals(id).delete();
  });
}

export async function getPagesForProject(projectId: string): Promise<Page[]> {
  const project = await db.projects.get(projectId);
  if (!project) return [];

  const rawPages = await db.pages.where('projectId').equals(projectId).toArray();
  const pageMap = new Map(rawPages.map((p) => [p.id, p]));

  const ordered: Page[] = [];
  for (const pageId of project.pageOrder) {
    const p = pageMap.get(pageId);
    if (p) ordered.push(p);
  }

  for (const p of rawPages) {
    if (!project.pageOrder.includes(p.id)) {
      ordered.push(p);
    }
  }

  return ordered;
}

export async function getPageById(pageId: string): Promise<Page | undefined> {
  return await db.pages.get(pageId);
}

export async function savePage(page: Page): Promise<void> {
  await db.pages.put(page);
  await db.projects.update(page.projectId, { updatedAt: Date.now() });
}

export async function deletePage(projectId: string, pageId: string): Promise<void> {
  await db.transaction('rw', db.projects, db.pages, async () => {
    await db.pages.delete(pageId);
    const project = await db.projects.get(projectId);
    if (project) {
      const newOrder = project.pageOrder.filter((id) => id !== pageId);
      await db.projects.update(projectId, {
        pageOrder: newOrder,
        updatedAt: Date.now(),
      });
    }
  });
}

export async function updatePageOrder(projectId: string, pageOrder: string[]): Promise<void> {
  await db.projects.update(projectId, {
    pageOrder,
    updatedAt: Date.now(),
  });
}

export async function getQuizzesForProject(projectId: string): Promise<QuizAttempt[]> {
  return await db.quizzes.where('projectId').equals(projectId).reverse().sortBy('createdAt');
}

export async function saveQuizAttempt(attempt: QuizAttempt): Promise<void> {
  await db.quizzes.put(attempt);
}

export async function getFlashcardsForProject(projectId: string): Promise<Flashcard[]> {
  return await db.flashcards.where('projectId').equals(projectId).toArray();
}

export async function saveFlashcard(flashcard: Flashcard): Promise<void> {
  await db.flashcards.put(flashcard);
}

export async function saveMultipleFlashcards(cards: Flashcard[]): Promise<void> {
  await db.flashcards.bulkPut(cards);
}

export async function deleteFlashcard(id: string): Promise<void> {
  await db.flashcards.delete(id);
}

export async function getDigest(pageId: string, contentHash: string): Promise<NotesDigestCache | undefined> {
  return await db.digests.where({ pageId, contentHash }).first();
}

export async function saveDigest(digest: NotesDigestCache): Promise<void> {
  await db.digests.put(digest);
}

// -------------------------------------------------------------
// Phase 5, 6, 7 Database Operations
// -------------------------------------------------------------

// Study Sessions (Pomodoro)
export async function saveStudySession(session: StudySession): Promise<void> {
  await db.studySessions.put(session);
}

export async function getStudySessions(projectId?: string): Promise<StudySession[]> {
  if (projectId) {
    return await db.studySessions.where('projectId').equals(projectId).reverse().sortBy('startedAt');
  }
  return await db.studySessions.orderBy('startedAt').reverse().toArray();
}

// User Stats & XP
export const DEFAULT_USER_STATS: UserStats = {
  id: 'default',
  xp: 0,
  level: 1,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: '',
  streakFreezes: 1,
  earnedBadges: ['badge_first_page'],
};

export async function getUserStats(): Promise<UserStats> {
  const stats = await db.userStats.get('default');
  if (!stats) {
    await db.userStats.put(DEFAULT_USER_STATS);
    return DEFAULT_USER_STATS;
  }
  return stats;
}

export async function updateUserStats(updates: Partial<UserStats>): Promise<UserStats> {
  const current = await getUserStats();
  const next = { ...current, ...updates };
  await db.userStats.put(next);
  return next;
}

// Daily limits on repeatable XP actions to prevent farming
export const XP_ACTION_CONFIG: Record<XpActionType, { xp: number; dailyLimit: number }> = {
  focus_session: { xp: 50, dailyLimit: 8 },
  create_page: { xp: 20, dailyLimit: 10 },
  edit_page: { xp: 10, dailyLimit: 15 },
  finish_quiz: { xp: 40, dailyLimit: 10 },
  review_flashcard: { xp: 5, dailyLimit: 30 },
  feynman_attempt: { xp: 60, dailyLimit: 5 },
  planner_task: { xp: 35, dailyLimit: 10 },
  voice_tool_first_use: { xp: 50, dailyLimit: 1 },
  handwriting_tool_first_use: { xp: 50, dailyLimit: 1 },
};

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function recordXpEvent(action: XpActionType, customXp?: number, projectId?: string): Promise<{ awarded: number; totalXp: number; level: number; leveledUp: boolean }> {
  const todayStr = getTodayDateString();
  const config = XP_ACTION_CONFIG[action] || { xp: 10, dailyLimit: 10 };

  // Check daily count
  const countToday = await db.xpEvents
    .where({ dateStr: todayStr, action })
    .count();

  if (countToday >= config.dailyLimit) {
    const currentStats = await getUserStats();
    return { awarded: 0, totalXp: currentStats.xp, level: currentStats.level, leveledUp: false };
  }

  const xpToAward = customXp !== undefined ? customXp : config.xp;
  const event: XpEvent = {
    id: `xp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    action,
    xp: xpToAward,
    dateStr: todayStr,
    projectId,
    timestamp: Date.now(),
  };
  await db.xpEvents.put(event);

  // Update UserStats and calculate streaks & levels
  const current = await getUserStats();
  const newXp = current.xp + xpToAward;
  const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;
  const leveledUp = newLevel > current.level;

  // Streak calculations
  let currentStreak = current.currentStreak;
  let longestStreak = current.longestStreak;
  const lastDate = current.lastActiveDate;

  if (!lastDate) {
    currentStreak = 1;
  } else if (lastDate !== todayStr) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    if (lastDate === yesterdayStr) {
      currentStreak += 1;
    } else {
      // Missed a day
      if (current.streakFreezes > 0) {
        // Use freeze
        current.streakFreezes -= 1;
      } else {
        currentStreak = 1;
      }
    }
  }

  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  await db.userStats.put({
    ...current,
    xp: newXp,
    level: newLevel,
    currentStreak,
    longestStreak,
    lastActiveDate: todayStr,
  });

  return { awarded: xpToAward, totalXp: newXp, level: newLevel, leveledUp };
}

export async function getXpEventsForHeatmap(days = 365): Promise<Record<string, number>> {
  const sinceTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;
  const events = await db.xpEvents.where('timestamp').above(sinceTimestamp).toArray();

  const map: Record<string, number> = {};
  for (const e of events) {
    map[e.dateStr] = (map[e.dateStr] || 0) + e.xp;
  }
  return map;
}

// Award XP Event Helper wrapper
export async function awardXpEvent({
  type,
  amount,
  referenceId,
}: {
  type: string;
  amount?: number;
  description?: string;
  referenceId?: string;
}): Promise<{ awarded: number; totalXp: number; level: number; leveledUp: boolean }> {
  const actionType = (type === 'voice_or_handwriting' ? 'handwriting_tool_first_use' : type) as XpActionType;
  return await recordXpEvent(actionType, amount, referenceId);
}

export async function recordStudySession({
  projectId,
  focusSeconds,
  completed,
  type = 'pomodoro',
}: {
  projectId: string;
  focusSeconds: number;
  completed: boolean;
  type?: 'pomodoro' | 'short-break' | 'long-break';
}): Promise<StudySession> {
  const session: StudySession = {
    id: `sess-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    projectId,
    startedAt: Date.now() - focusSeconds * 1000,
    focusSeconds,
    completed,
    type,
  };
  await db.studySessions.put(session);
  return session;
}

// Feynman Attempts
export async function saveFeynmanAttempt(attempt: FeynmanAttempt): Promise<void> {
  await db.feynmanAttempts.put(attempt);
}

export async function getFeynmanAttempts(projectId?: string): Promise<FeynmanAttempt[]> {
  if (projectId) {
    return await db.feynmanAttempts.where('projectId').equals(projectId).reverse().sortBy('createdAt');
  }
  return await db.feynmanAttempts.orderBy('createdAt').reverse().toArray();
}

// Mind Maps
export async function saveMindMap(record: MindMapRecord): Promise<void> {
  await db.mindMaps.put(record);
}

export async function getMindMapByProject(projectId: string): Promise<MindMapRecord | undefined> {
  return await db.mindMaps.where('projectId').equals(projectId).first();
}

// Exam Plans
export async function saveExamPlan(plan: ExamPlanRecord): Promise<void> {
  await db.examPlans.put(plan);
}

export async function getExamPlans(projectId?: string): Promise<ExamPlanRecord[]> {
  if (projectId) {
    return await db.examPlans.where('projectId').equals(projectId).reverse().sortBy('updatedAt');
  }
  return await db.examPlans.orderBy('updatedAt').reverse().toArray();
}

// App Settings
export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'default',
  persona: 'friendly-peer',
  ttsRate: 1.0,
  ttsPitch: 1.0,
  voiceLanguage: 'en-US',
  gamificationEnabled: true,
  theme: 'system',
};

export async function getAppSettings(): Promise<AppSettings> {
  const s = await db.appSettings.get('default');
  if (!s) {
    await db.appSettings.put(DEFAULT_APP_SETTINGS);
    return DEFAULT_APP_SETTINGS;
  }
  return s;
}

export async function updateAppSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const next = { ...current, ...updates };
  await db.appSettings.put(next);
  return next;
}

// Seed Initial Sample Project (if empty)
export async function seedSampleDataIfEmpty(): Promise<string> {
  const count = await db.projects.count();
  if (count > 0) {
    const latest = await db.projects.orderBy('updatedAt').reverse().first();
    return latest!.id;
  }

  const projId = 'proj-neural-nets';
  const page1Id = 'page-intro';
  const page2Id = 'page-backprop';
  const page3Id = 'page-optimization';

  const sampleProject: Project = {
    id: projId,
    title: 'CS 229: Deep Learning & Neural Architectures',
    createdAt: Date.now() - 3600 * 1000 * 48,
    updatedAt: Date.now(),
    pageOrder: [page1Id, page2Id, page3Id],
  };

  const samplePages: Page[] = [
    {
      id: page1Id,
      projectId: projId,
      title: '1. Neural Architecture Fundamentals',
      background: 'grid',
      updatedAt: Date.now(),
      textBoxes: [
        {
          id: 'tb-1',
          x: 60,
          y: 70,
          width: 480,
          text: 'Neural Networks: Composed of input, hidden, and output layers.\nEach neuron calculates: z = W^T * x + b\nActivation functions introduce non-linearity (ReLU: max(0, z), Sigmoid: 1 / (1 + e^-z)).',
          fontSize: 18,
          color: '#1e293b',
        },
        {
          id: 'tb-2',
          x: 60,
          y: 240,
          width: 440,
          text: 'KEY PRINCIPLE: Linear layers alone collapse into a single matrix product. Non-linear activations are mandatory for Universal Function Approximation theorem!',
          fontSize: 16,
          color: '#4338ca',
        },
      ],
      strokes: [
        {
          id: 's-1',
          tool: 'pen',
          color: '#4f46e5',
          size: 3,
          opacity: 1,
          points: [
            { x: 60, y: 55, pressure: 0.5 },
            { x: 500, y: 55, pressure: 0.8 },
          ],
        },
        {
          id: 's-2',
          tool: 'highlighter',
          color: '#facc15',
          size: 20,
          opacity: 0.4,
          points: [
            { x: 60, y: 110, pressure: 0.7 },
            { x: 380, y: 110, pressure: 0.7 },
          ],
        },
      ],
    },
    {
      id: page2Id,
      projectId: projId,
      title: '2. Backpropagation & Chain Rule',
      background: 'ruled',
      updatedAt: Date.now(),
      textBoxes: [
        {
          id: 'tb-3',
          x: 60,
          y: 70,
          width: 500,
          text: 'Backpropagation: The computational engine of deep learning.\nUses the chain rule of calculus to compute gradient of loss L with respect to each weight:\ndL/dw_ij = (dL/dz_j) * (dz_j/dw_ij)',
          fontSize: 18,
          color: '#1e293b',
        },
        {
          id: 'tb-4',
          x: 60,
          y: 220,
          width: 480,
          text: 'Vanishing Gradient Problem:\nIn deep networks with Sigmoid/Tanh, gradients become exponentially small as they propagate backwards. ReLU mitigates this because derivative is 1 for positive inputs.',
          fontSize: 16,
          color: '#b91c1c',
        },
      ],
      strokes: [
        {
          id: 's-5',
          tool: 'highlighter',
          color: '#f87171',
          size: 18,
          opacity: 0.35,
          points: [
            { x: 60, y: 225 },
            { x: 300, y: 225 },
          ],
        },
      ],
    },
    {
      id: page3Id,
      projectId: projId,
      title: '3. Optimization Algorithms',
      background: 'dotted',
      updatedAt: Date.now(),
      textBoxes: [
        {
          id: 'tb-5',
          x: 60,
          y: 70,
          width: 500,
          text: 'Optimizers comparison:\n- SGD: Simple but oscillates in ravines.\n- Momentum: Adds velocity vector beta * v to accelerate through saddles.\n- Adam (Adaptive Moment Estimation): Combines momentum with RMSProp (computes adaptive learning rates per parameter using 1st and 2nd moment estimates).',
          fontSize: 18,
          color: '#1e293b',
        },
        {
          id: 'tb-6',
          x: 60,
          y: 270,
          width: 460,
          text: 'Hyperparameter Rule of Thumb: Default Adam parameters beta1=0.9, beta2=0.999, eps=1e-8. Learning rate typically 3e-4 (Karpathy constant).',
          fontSize: 16,
          color: '#047857',
        },
      ],
      strokes: [
        {
          id: 's-6',
          tool: 'pen',
          color: '#10b981',
          size: 3,
          opacity: 1,
          points: [
            { x: 60, y: 260 },
            { x: 500, y: 260 },
          ],
        },
      ],
    },
  ];

  await db.projects.put(sampleProject);
  for (const p of samplePages) {
    await db.pages.put(p);
  }

  // Pre-seed some study activity
  await recordXpEvent('create_page', 50, projId);
  await recordXpEvent('focus_session', 50, projId);

  return projId;
}
