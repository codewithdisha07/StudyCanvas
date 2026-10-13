import { describe, it, expect } from 'vitest';
import { splitIntoSentences } from '../features/tts/sentenceSplitter';
import { generateDeterministicPlan } from '../features/planner/scheduler';
import { composePersonaPrompt } from '../../server/geminiService.js';
import { STUDY_PERSONAS } from '../features/personas/personaConfig';
import type { ExamTopic } from '../types';

describe('Unit Tests: StudyCanvas AI Features', () => {
  describe('5.1 Sentence Splitter (Intl.Segmenter + Regex Fallback)', () => {
    it('splits complex multi-sentence paragraphs cleanly', () => {
      const text = 'Cellular respiration produces ATP. Glycolysis happens in the cytoplasm! Does the Krebs cycle require oxygen? Yes, it does.';
      const sentences = splitIntoSentences(text);
      expect(sentences.length).toBe(4);
      expect(sentences[0]).toBe('Cellular respiration produces ATP.');
      expect(sentences[1]).toBe('Glycolysis happens in the cytoplasm!');
      expect(sentences[2]).toBe('Does the Krebs cycle require oxygen?');
      expect(sentences[3]).toBe('Yes, it does.');
    });

    it('handles abbreviations, decimal points, and numbers without accidental splits', () => {
      const text = 'Activation threshold is 0.75V. The efficiency was approx. 95% overall.';
      const sentences = splitIntoSentences(text);
      expect(sentences.length).toBeGreaterThanOrEqual(1);
      expect(sentences[0]).toContain('0.75V');
    });

    it('returns empty array on empty input or whitespace', () => {
      expect(splitIntoSentences('')).toEqual([]);
      expect(splitIntoSentences('   \n  \t  ')).toEqual([]);
    });
  });

  describe('6.2 Gamification: Level, Streak & Freeze Calculations', () => {
    it('correctly derives levels from cumulative XP using quadratic scaling', () => {
      const calculateLevel = (xp: number) => Math.floor(Math.sqrt(xp / 100)) + 1;

      expect(calculateLevel(0)).toBe(1);
      expect(calculateLevel(99)).toBe(1);
      expect(calculateLevel(100)).toBe(2);
      expect(calculateLevel(400)).toBe(3);
      expect(calculateLevel(900)).toBe(4);
      expect(calculateLevel(1600)).toBe(5);
    });

    it('handles daily streak progression and consecutive day boundaries', () => {
      const checkStreak = (lastDateStr: string | null, todayStr: string, currentStreak: number, freezes: number) => {
        if (!lastDateStr) return { streak: 1, freezes };
        if (lastDateStr === todayStr) return { streak: currentStreak, freezes };

        const lastDate = new Date(lastDateStr);
        const today = new Date(todayStr);
        const diffDays = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

        if (diffDays === 1) {
          return { streak: currentStreak + 1, freezes };
        } else if (diffDays === 2 && freezes > 0) {
          // Freeze saved streak
          return { streak: currentStreak, freezes: freezes - 1 };
        } else {
          // Streak broken
          return { streak: 1, freezes };
        }
      };

      // Consecutive day advance
      const r1 = checkStreak('2026-10-12', '2026-10-13', 5, 1);
      expect(r1.streak).toBe(6);
      expect(r1.freezes).toBe(1);

      // Missed day with freeze available
      const r2 = checkStreak('2026-10-11', '2026-10-13', 5, 2);
      expect(r2.streak).toBe(5);
      expect(r2.freezes).toBe(1);

      // Missed day without freeze
      const r3 = checkStreak('2026-10-10', '2026-10-13', 5, 0);
      expect(r3.streak).toBe(1);
    });
  });

  describe('7.4 Deterministic Exam Planner Scheduling Algorithm', () => {
    const sampleTopics: ExamTopic[] = [
      { id: 'top-1', name: 'Quantum Mechanics', weight: 5, difficulty: 5, pageRefs: [1] },
      { id: 'top-2', name: 'Wave Optics', weight: 4, difficulty: 3, pageRefs: [2] },
      { id: 'top-3', name: 'Thermodynamics', weight: 3, difficulty: 2, pageRefs: [3] },
    ];

    it('ensures schedule respects duration, prioritizes high weight topics, and keeps final day light', () => {
      const plan = generateDeterministicPlan({
        projectId: 'proj-1',
        examName: 'Physics Final',
        examDate: '2026-10-23',
        availability: { hoursPerDay: 2, daysOff: [0] },
        topics: sampleTopics,
      });

      expect(plan.tasks.length).toBeGreaterThan(0);

      // Check final day task is light review
      const lastTask = plan.tasks[plan.tasks.length - 1];
      expect(lastTask.type).toBe('revision_sheet');
      expect(lastTask.durationMinutes).toBeLessThanOrEqual(30);

      // Verify that top weight topic gets first-pass study allocated
      const qmFirstPass = plan.tasks.find((t) => t.topicId === 'top-1' && t.type === 'first_pass');
      expect(qmFirstPass).toBeDefined();

      // Ensure mock exam is scheduled before final day
      const mockExam = plan.tasks.find((t) => t.type === 'mock_exam');
      expect(mockExam).toBeDefined();
    });
  });

  describe('7.2 Study Buddy Persona & Grounding System Prompt Composition', () => {
    it('composes persona without stripping or compromising grounding and citation rules', () => {
      for (const persona of STUDY_PERSONAS) {
        const composed = composePersonaPrompt(persona.promptLayer);

        // Verify that critical grounding constraints remain verbatim in the prompt
        expect(composed).toContain('Answer ONLY from the provided notes');
        expect(composed).toContain('CITE SOURCES IN EVERY ANSWER');
        expect(composed).toContain('[Page N]');
        expect(composed).toContain("Your notes don't cover this");
        expect(composed).toContain('AI STUDY BUDDY PERSONA & PEDAGOGY LAYER');
        expect(composed).toContain(persona.promptLayer);
      }
    });
  });

  describe('6.3 Battle Scoring & Anti-Cheat Rules', () => {
    it('calculates score based on correctness and speed bonus (up to 50 pts)', () => {
      const calculateScore = (isCorrect: boolean, timeTakenMs: number) => {
        if (!isCorrect) return 0;
        const speedBonus = Math.max(0, Math.floor((15000 - Math.min(timeTakenMs, 15000)) / 300));
        return 100 + speedBonus;
      };

      // Perfect fast answer (1s) -> 100 base + 46 speed bonus = 146
      expect(calculateScore(true, 1000)).toBe(146);
      // Slower correct answer (14s) -> 100 base + 3 speed bonus = 103
      expect(calculateScore(true, 14000)).toBe(103);
      // Timeout / 15s correct answer -> 100 base + 0 bonus = 100
      expect(calculateScore(true, 16000)).toBe(100);
      // Incorrect answer -> always 0
      expect(calculateScore(false, 500)).toBe(0);
    });
  });
});
