import { describe, it, expect } from 'vitest';
import { computePageContentHash } from '../ai/contextBuilder';
import { simulateGroundedAI } from '../../server/geminiService.js';
import type { Page } from '../types';

describe('StudyCanvas AI Grounding & Context Tests', () => {
  const samplePage1: Page = {
    id: 'page-1',
    projectId: 'proj-1',
    title: 'Cellular Respiration',
    strokes: [
      {
        id: 's-1',
        tool: 'pen',
        color: '#000',
        size: 3,
        opacity: 1,
        points: [{ x: 10, y: 10 }],
      },
    ],
    textBoxes: [
      {
        id: 'tb-1',
        x: 20,
        y: 20,
        width: 300,
        text: 'Glycolysis breaks down glucose into pyruvate and produces 2 ATP.',
        fontSize: 16,
        color: '#000',
      },
    ],
    background: 'ruled',
    updatedAt: 1000,
  };

  it('computes stable content hashes and detects page modifications', () => {
    const hash1 = computePageContentHash(samplePage1);
    const hash2 = computePageContentHash(samplePage1);
    expect(hash1).toBe(hash2);

    const modifiedPage: Page = {
      ...samplePage1,
      textBoxes: [
        {
          ...samplePage1.textBoxes[0],
          text: 'Glycolysis produces 2 ATP and NADH.',
        },
      ],
    };
    const hashModified = computePageContentHash(modifiedPage);
    expect(hashModified).not.toBe(hash1);
  });

  it('strictly handles questions on topics NOT in the notes with insufficient information fallback', () => {
    const context = {
      scope: 'current',
      pages: [
        {
          id: samplePage1.id,
          projectId: samplePage1.projectId,
          pageNumber: 1,
          title: samplePage1.title,
          text: samplePage1.textBoxes[0].text,
          hasStrokes: true,
          strokeCount: 1,
        },
      ],
    };

    // Question about quantum computing when notes are only about biology glycolysis
    const response = simulateGroundedAI({
      feature: 'chat',
      prompt: 'What is quantum entanglement and superposition in qubits?',
      context,
    });

    expect(response.isInsufficient).toBe(true);
    expect(response.text).toContain("Your notes don't cover this");
    expect(response.text).toContain('Consider adding notes on');
  });

  it('provides grounded answers with clickable source citations for questions present in notes', () => {
    const context = {
      scope: 'current',
      pages: [
        {
          id: samplePage1.id,
          projectId: samplePage1.projectId,
          pageNumber: 1,
          title: samplePage1.title,
          text: samplePage1.textBoxes[0].text,
          hasStrokes: true,
          strokeCount: 1,
        },
      ],
    };

    const response = simulateGroundedAI({
      feature: 'chat',
      prompt: 'What does glycolysis break down and how much ATP does it produce?',
      context,
    });

    expect(response.isInsufficient).toBe(false);
    expect(response.citations.length).toBeGreaterThan(0);
    expect(response.citations).toContain('[Page 1]');
    expect(response.text).toContain('Based on your notes [Page 1]');
  });

  it('handles completely empty notes gracefully', () => {
    const emptyContext = {
      scope: 'current',
      pages: [
        {
          id: 'p-empty',
          projectId: 'proj-1',
          pageNumber: 1,
          title: 'Empty Page',
          text: '',
          hasStrokes: false,
          strokeCount: 0,
        },
      ],
    };

    const response = simulateGroundedAI({
      feature: 'chat',
      prompt: 'Summarize my notes',
      context: emptyContext,
    });

    expect(response.isInsufficient).toBe(true);
    expect(response.text).toContain("Your notes don't cover this");
  });
});
