import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'battle_quiz.db');
const db = new Database(dbPath);

// Initialize SQLite Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'async', -- 'live' or 'async'
    status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting', 'active', 'finished'
    current_question_index INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    questions_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    nickname TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    answers_count INTEGER DEFAULT 0,
    joined_at INTEGER NOT NULL,
    FOREIGN KEY(room_code) REFERENCES rooms(code)
  );

  CREATE TABLE IF NOT EXISTS answers (
    id TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    player_id TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    selected_option TEXT,
    is_correct INTEGER NOT NULL,
    time_taken_ms INTEGER NOT NULL,
    points_awarded INTEGER NOT NULL,
    answered_at INTEGER NOT NULL,
    UNIQUE(room_code, player_id, question_index)
  );
`);

// Active SSE Connections by room code: roomCode -> Set of { res, playerId }
const sseSubscribers = new Map();

export function broadcastRoomUpdate(roomCode) {
  const subscribers = sseSubscribers.get(roomCode);
  if (!subscribers || subscribers.size === 0) return;

  const state = getRoomState(roomCode, null);
  if (!state) return;

  const data = `data: ${JSON.stringify(state)}\n\n`;
  for (const client of subscribers) {
    try {
      client.res.write(data);
    } catch {
      subscribers.delete(client);
    }
  }
}

export function subscribeToRoom(roomCode, playerId, res) {
  if (!sseSubscribers.has(roomCode)) {
    sseSubscribers.set(roomCode, new Set());
  }
  const client = { res, playerId };
  sseSubscribers.get(roomCode).add(client);

  res.on('close', () => {
    const subs = sseSubscribers.get(roomCode);
    if (subs) {
      subs.delete(client);
      if (subs.size === 0) sseSubscribers.delete(roomCode);
    }
  });
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function createRoom({ title, mode = 'async', questions, durationHours = 24 }) {
  let code = generateRoomCode();
  // Ensure code uniqueness
  const check = db.prepare('SELECT code FROM rooms WHERE code = ?').get(code);
  if (check) code = generateRoomCode();

  const now = Date.now();
  const expiresAt = now + durationHours * 3600 * 1000;

  // Sanitize questions to store without exposing correct answers to public requests
  const sanitized = questions.map((q, idx) => ({
    id: q.id || `q-${idx}`,
    question: q.question,
    options: q.options || [],
    correctOption: q.correctOption,
    explanation: q.explanation || '',
    difficulty: q.difficulty || 'medium',
  }));

  db.prepare(`
    INSERT INTO rooms (code, title, mode, status, current_question_index, created_at, expires_at, questions_json)
    VALUES (?, ?, ?, ?, 0, ?, ?, ?)
  `).run(code, title || 'StudyCanvas Battle', mode, mode === 'live' ? 'waiting' : 'active', now, expiresAt, JSON.stringify(sanitized));

  return { code, mode, title, expiresAt };
}

export function joinRoom(roomCode, nickname) {
  const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(roomCode.toUpperCase());
  if (!room) return { error: 'Room not found' };

  if (Date.now() > room.expires_at) {
    return { error: 'This battle room has expired' };
  }

  const playerId = `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const cleanNick = (nickname || 'Student').trim().slice(0, 20);

  db.prepare(`
    INSERT INTO players (id, room_code, nickname, score, answers_count, joined_at)
    VALUES (?, ?, ?, 0, 0, ?)
  `).run(playerId, room.code, cleanNick, Date.now());

  broadcastRoomUpdate(room.code);

  return { playerId, nickname: cleanNick, roomCode: room.code };
}

export function submitAnswer({ roomCode, playerId, questionIndex, selectedOption, timeTakenMs = 5000 }) {
  const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(roomCode.toUpperCase());
  if (!room) return { error: 'Room not found' };

  const player = db.prepare('SELECT * FROM players WHERE id = ? AND room_code = ?').get(playerId, room.code);
  if (!player) return { error: 'Player not found in room' };

  // Anti-cheat check: Prevent duplicate submissions for same question
  const existing = db.prepare('SELECT id FROM answers WHERE room_code = ? AND player_id = ? AND question_index = ?').get(room.code, playerId, questionIndex);
  if (existing) {
    return { error: 'Question already answered' };
  }

  const questions = JSON.parse(room.questions_json);
  const q = questions[questionIndex];
  if (!q) return { error: 'Invalid question index' };

  // Server-side answer check
  const isCorrect = (selectedOption || '').trim().toLowerCase() === (q.correctOption || '').trim().toLowerCase();
  
  // Calculate points: 100 base + speed bonus up to 50
  const speedBonus = isCorrect ? Math.max(0, Math.floor((15000 - Math.min(timeTakenMs, 15000)) / 300)) : 0;
  const points = isCorrect ? 100 + speedBonus : 0;

  const ansId = `ans-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(`
    INSERT INTO answers (id, room_code, player_id, question_index, selected_option, is_correct, time_taken_ms, points_awarded, answered_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ansId, room.code, playerId, questionIndex, selectedOption, isCorrect ? 1 : 0, timeTakenMs, points, Date.now());

  // Update player score
  db.prepare(`
    UPDATE players 
    SET score = score + ?, answers_count = answers_count + 1
    WHERE id = ?
  `).run(points, playerId);

  broadcastRoomUpdate(room.code);

  return {
    isCorrect,
    pointsAwarded: points,
    explanation: q.explanation,
    correctOption: q.correctOption,
  };
}

export function advanceLiveQuestion(roomCode) {
  const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(roomCode.toUpperCase());
  if (!room || room.mode !== 'live') return;

  const questions = JSON.parse(room.questions_json);
  const nextIdx = room.current_question_index + 1;
  const isFinished = nextIdx >= questions.length;

  db.prepare(`
    UPDATE rooms 
    SET current_question_index = ?, status = ?
    WHERE code = ?
  `).run(nextIdx, isFinished ? 'finished' : 'active', room.code);

  broadcastRoomUpdate(room.code);
}

export function startLiveBattle(roomCode) {
  db.prepare(`
    UPDATE rooms SET status = 'active', current_question_index = 0 WHERE code = ?
  `).run(roomCode.toUpperCase());

  broadcastRoomUpdate(roomCode.toUpperCase());
}

export function getRoomState(roomCode, requestingPlayerId = null) {
  const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(roomCode.toUpperCase());
  if (!room) return null;

  const questions = JSON.parse(room.questions_json);

  // Strip correctOption unless room is finished or player has answered
  const publicQuestions = questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    difficulty: q.difficulty,
  }));

  const players = db.prepare(`
    SELECT id, nickname, score, answers_count
    FROM players
    WHERE room_code = ?
    ORDER BY score DESC, joined_at ASC
  `).all(room.code);

  return {
    code: room.code,
    title: room.title,
    mode: room.mode,
    status: room.status,
    currentQuestionIndex: room.current_question_index,
    totalQuestions: questions.length,
    questions: publicQuestions,
    players,
    expiresAt: room.expires_at,
  };
}
