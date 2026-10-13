import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { callGemini, simulateGroundedAI, composePersonaPrompt } from './geminiService.js';
import * as battle from './battle.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allows high-res base64 canvas snapshots

// Health check
app.get('/api/health', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  res.json({
    status: 'ok',
    mode: hasKey ? 'live-gemini-2.5-flash' : 'grounded-fallback-simulator',
    hasKey,
  });
});

// Chat endpoint (multimodal grounded chat)
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { prompt, context, images = [], personaPrompt = '' } = req.body;
    if (!context) {
      return res.status(400).json({ error: 'Context is required' });
    }

    const pages = context.pages || [];
    const contextPrompt = `STUDENT NOTES CONTEXT:
Scope: ${context.scope || 'Current Page'}
${pages.map((p) => `--- PAGE ${p.pageNumber}: ${p.title} ---\n${p.text || '[No typed text, see attached canvas diagram/handwriting]'}`).join('\n\n')}

USER QUESTION:
"${prompt}"

Please answer following the grounding rules. Always cite sources like [Page N]. If not present, state that notes don't cover this.`;

    const systemInstruction = composePersonaPrompt(personaPrompt);

    const geminiRaw = await callGemini({
      systemInstruction,
      promptText: contextPrompt,
      images,
      temperature: 0.2,
    });

    if (geminiRaw) {
      // Extract citations [Page N]
      const citations = Array.from(new Set(geminiRaw.match(/\[Page \d+\]/g) || []));
      const isInsufficient =
        geminiRaw.toLowerCase().includes("notes don't cover") ||
        geminiRaw.toLowerCase().includes('insufficient information') ||
        geminiRaw.toLowerCase().includes('not mentioned');

      return res.json({
        text: geminiRaw,
        citations,
        isInsufficient,
      });
    }

    // High fidelity grounded fallback
    const fallback = simulateGroundedAI({ feature: 'chat', prompt, context });
    return res.json(fallback);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to process AI chat request' });
  }
});

// Explain Concept
app.post('/api/ai/explain', async (req, res) => {
  try {
    const { concept, level = 'simple', context, images = [] } = req.body;
    const prompt = `Explain the concept "${concept}" at level "${level}" (options: simple, detailed, eli5, analogy) strictly based on the student's notes. Include [Page N] citations.`;

    const geminiRaw = await callGemini({
      promptText: `${prompt}\n\nNotes Context:\n${JSON.stringify(context?.pages || [])}`,
      images,
      temperature: 0.2,
    });

    if (geminiRaw) {
      const citations = Array.from(new Set(geminiRaw.match(/\[Page \d+\]/g) || []));
      return res.json({ text: geminiRaw, citations });
    }

    const fallback = simulateGroundedAI({
      feature: 'explain',
      prompt: concept,
      context,
      options: { level },
    });
    return res.json(fallback);
  } catch (err) {
    console.error('Explain error:', err);
    res.status(500).json({ error: 'Failed to explain concept' });
  }
});

// Summarize
app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { length = 'medium', style = 'bullets', context, images = [] } = req.body;
    const prompt = `Summarize the provided notes in ${style} format at ${length} length. Anchor every point to [Page N] citations.`;

    const geminiRaw = await callGemini({
      promptText: `${prompt}\n\nNotes Context:\n${JSON.stringify(context?.pages || [])}`,
      images,
      temperature: 0.2,
    });

    if (geminiRaw) {
      const citations = Array.from(new Set(geminiRaw.match(/\[Page \d+\]/g) || []));
      return res.json({ text: geminiRaw, citations });
    }

    const fallback = simulateGroundedAI({
      feature: 'summarize',
      context,
      options: { length, style },
    });
    return res.json(fallback);
  } catch (err) {
    console.error('Summarize error:', err);
    res.status(500).json({ error: 'Failed to summarize notes' });
  }
});

// Structured Quiz Generation
app.post('/api/ai/quiz', async (req, res) => {
  try {
    const { count = 4, difficulty = 'medium', context, images = [] } = req.body;

    const quizSchema = {
      type: 'OBJECT',
      properties: {
        questions: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              id: { type: 'STRING' },
              type: { type: 'STRING', enum: ['multiple-choice', 'true-false', 'short-answer'] },
              question: { type: 'STRING' },
              options: { type: 'ARRAY', items: { type: 'STRING' } },
              correctAnswer: { type: 'STRING' },
              explanation: { type: 'STRING' },
              sourcePageNumber: { type: 'INTEGER' },
              topic: { type: 'STRING' },
            },
            required: ['id', 'type', 'question', 'correctAnswer', 'explanation', 'sourcePageNumber', 'topic'],
          },
        },
      },
      required: ['questions'],
    };

    const promptText = `Generate a structured quiz with ${count} questions at ${difficulty} difficulty grounded strictly in these student notes. Each question must reference the source page number. Include a mix of multiple-choice, true-false, and short-answer questions.`;

    const geminiRaw = await callGemini({
      promptText: `${promptText}\n\nNotes Context:\n${JSON.stringify(context?.pages || [])}`,
      images,
      responseSchema: quizSchema,
      temperature: 0.2,
    });

    if (geminiRaw) {
      try {
        const parsed = JSON.parse(geminiRaw);
        return res.json({ ...parsed, difficulty });
      } catch (e) {
        console.warn('Could not parse Gemini quiz JSON, falling back:', e);
      }
    }

    const fallback = simulateGroundedAI({
      feature: 'quiz',
      context,
      options: { count, difficulty },
    });
    return res.json(fallback);
  } catch (err) {
    console.error('Quiz error:', err);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// Grade short answer
app.post('/api/ai/grade-short-answer', async (req, res) => {
  try {
    const { question, studentAnswer, expectedAnswer, context } = req.body;
    const prompt = `Grade the student's short answer against their notes and the expected answer.
Question: ${question}
Expected Answer: ${expectedAnswer}
Student Answer: ${studentAnswer}

Evaluate: Is it correct, partially correct, or incorrect? Provide brief encouraging feedback and note citation [Page N].`;

    const geminiRaw = await callGemini({
      promptText: prompt,
      temperature: 0.1,
    });

    if (geminiRaw) {
      const isCorrect = !geminiRaw.toLowerCase().includes('incorrect') && !geminiRaw.toLowerCase().includes('not correct');
      return res.json({
        isCorrect,
        feedback: geminiRaw,
      });
    }

    // Fallback heuristic
    const cleanedStudent = (studentAnswer || '').toLowerCase().trim();
    const cleanedExpected = (expectedAnswer || '').toLowerCase().trim();
    const isCorrect = cleanedStudent.length > 2 && (cleanedExpected.includes(cleanedStudent) || cleanedStudent.includes(cleanedExpected) || cleanedStudent.length > 5);

    return res.json({
      isCorrect,
      feedback: isCorrect
        ? `Great job! Your answer matches the key points noted in your study canvas.`
        : `Almost! Compare your answer with the notes: expected "${expectedAnswer}".`,
    });
  } catch (err) {
    console.error('Grade error:', err);
    res.status(500).json({ error: 'Failed to grade answer' });
  }
});

// Content Refinement
app.post('/api/ai/refine', async (req, res) => {
  try {
    const { originalText, mode = 'simplify', context } = req.body;

    const refineSchema = {
      type: 'OBJECT',
      properties: {
        original: { type: 'STRING' },
        refined: { type: 'STRING' },
        explanationOfChanges: { type: 'STRING' },
      },
      required: ['original', 'refined'],
    };

    const promptText = `Refine the student's note content using mode "${mode}" (simplify explanation / fix grammar / organize into structured notes / improve an answer / make exam-ready). DO NOT fabricate new facts outside their notes. Keep all original facts intact.
Original Note:
"${originalText}"`;

    const geminiRaw = await callGemini({
      promptText,
      responseSchema: refineSchema,
      temperature: 0.2,
    });

    if (geminiRaw) {
      try {
        const parsed = JSON.parse(geminiRaw);
        return res.json(parsed);
      } catch (e) {
        console.warn('Failed parsing refinement JSON, falling back:', e);
      }
    }

    const fallback = simulateGroundedAI({
      feature: 'refine',
      prompt: originalText,
      context,
      options: { mode },
    });
    return res.json(fallback);
  } catch (err) {
    console.error('Refine error:', err);
    res.status(500).json({ error: 'Failed to refine content' });
  }
});

// Flashcards Generator
app.post('/api/ai/flashcards', async (req, res) => {
  try {
    const { count = 5, context, images = [] } = req.body;

    const flashcardsSchema = {
      type: 'OBJECT',
      properties: {
        flashcards: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              id: { type: 'STRING' },
              front: { type: 'STRING' },
              back: { type: 'STRING' },
              sourcePageNumber: { type: 'INTEGER' },
            },
            required: ['id', 'front', 'back', 'sourcePageNumber'],
          },
        },
      },
      required: ['flashcards'],
    };

    const promptText = `Generate ${count} flashcards (front: key question or concept, back: answer grounded in the notes) from these student notes.`;

    const geminiRaw = await callGemini({
      promptText: `${promptText}\n\nContext:\n${JSON.stringify(context?.pages || [])}`,
      images,
      responseSchema: flashcardsSchema,
      temperature: 0.2,
    });

    if (geminiRaw) {
      try {
        const parsed = JSON.parse(geminiRaw);
        return res.json(parsed);
      } catch (e) {
        console.warn('Failed to parse flashcards JSON:', e);
      }
    }

    const fallback = simulateGroundedAI({
      feature: 'flashcards',
      context,
      options: { count },
    });
    return res.json(fallback);
  } catch (err) {
    console.error('Flashcards error:', err);
    res.status(500).json({ error: 'Failed to generate flashcards' });
  }
});

// Revision Sheet Generator
app.post('/api/ai/revision-sheet', async (req, res) => {
  try {
    const { context, images = [] } = req.body;

    const revisionSchema = {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        summary: { type: 'STRING' },
        keyConcepts: { type: 'ARRAY', items: { type: 'STRING' } },
        formulas: { type: 'ARRAY', items: { type: 'STRING' } },
        examQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['title', 'summary', 'keyConcepts', 'formulas', 'examQuestions'],
    };

    const promptText = `Synthesize a one-page smart revision sheet for this entire project. Group by Key Concepts, Definitions/Formulas, and Likely Exam Questions. Strictly grounded in the provided notes.`;

    const geminiRaw = await callGemini({
      promptText: `${promptText}\n\nContext:\n${JSON.stringify(context?.pages || [])}`,
      images,
      responseSchema: revisionSchema,
      temperature: 0.2,
    });

    if (geminiRaw) {
      try {
        const parsed = JSON.parse(geminiRaw);
        return res.json(parsed);
      } catch (e) {
        console.warn('Failed parsing revision sheet JSON:', e);
      }
    }

    const fallback = simulateGroundedAI({
      feature: 'revision_sheet',
      context,
    });
    return res.json(fallback);
  } catch (err) {
    console.error('Revision sheet error:', err);
    res.status(500).json({ error: 'Failed to generate revision sheet' });
  }
});

// Handwriting to Typed Text Transcription
app.post('/api/ai/transcribe-handwriting', async (req, res) => {
  try {
    const { images = [], context = {} } = req.body;

    const transcriptionSchema = {
      type: 'OBJECT',
      properties: {
        blocks: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              type: { type: 'STRING', enum: ['heading', 'paragraph', 'list', 'formula', 'table'] },
              text: { type: 'STRING' },
              confidence: { type: 'NUMBER' },
              uncertainWords: { type: 'ARRAY', items: { type: 'STRING' } },
            },
            required: ['type', 'text', 'confidence', 'uncertainWords'],
          },
        },
        isLegible: { type: 'BOOLEAN' },
        legibilityNote: { type: 'STRING' },
      },
      required: ['blocks', 'isLegible'],
    };

    const promptText = `Transcribe all handwritten notes and text from the provided canvas image snapshot with high fidelity. Group into semantic blocks (heading, paragraph, list, formula, table). Include confidence score between 0 and 1, and flag any uncertainWords. If handwriting is illegible or blurry, set isLegible: false and state clearly in legibilityNote instead of guessing.`;

    const geminiRaw = await callGemini({
      promptText,
      images,
      responseSchema: transcriptionSchema,
      temperature: 0.1,
    });

    if (geminiRaw) {
      try {
        const parsed = JSON.parse(geminiRaw);
        return res.json(parsed);
      } catch (e) {
        console.warn('Failed parsing handwriting JSON:', e);
      }
    }

    const fallback = simulateGroundedAI({
      feature: 'transcribe_handwriting',
      context,
    });
    return res.json(fallback);
  } catch (err) {
    console.error('Handwriting transcription error:', err);
    res.status(500).json({ error: 'Failed to transcribe handwriting' });
  }
});

// Feynman Mode (Teach it back) evaluation
app.post('/api/ai/feynman', async (req, res) => {
  try {
    const { topic, explanation, audience = 'peer', context, personaPrompt = '' } = req.body;

    const feynmanSchema = {
      type: 'OBJECT',
      properties: {
        topic: { type: 'STRING' },
        scores: {
          type: 'OBJECT',
          properties: {
            accuracy: { type: 'NUMBER' },
            completeness: { type: 'NUMBER' },
            clarity: { type: 'NUMBER' },
            ownWords: { type: 'NUMBER' },
            overall: { type: 'NUMBER' },
          },
          required: ['accuracy', 'completeness', 'clarity', 'ownWords', 'overall'],
        },
        coveredPoints: { type: 'ARRAY', items: { type: 'STRING' } },
        missingPoints: { type: 'ARRAY', items: { type: 'STRING' } },
        misconceptions: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              studentClaim: { type: 'STRING' },
              actualNoteFact: { type: 'STRING' },
              citation: { type: 'STRING' },
            },
            required: ['studentClaim', 'actualNoteFact', 'citation'],
          },
        },
        verdict: { type: 'STRING' },
        followUpQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
        isTopicInNotes: { type: 'BOOLEAN' },
      },
      required: ['topic', 'scores', 'coveredPoints', 'missingPoints', 'misconceptions', 'verdict', 'followUpQuestions', 'isTopicInNotes'],
    };

    const systemInstruction = composePersonaPrompt(
      personaPrompt || `You are an inquisitive student acting as audience: ${audience}. Evaluate the user's explanation strictly against their notes.`
    );

    const promptText = `Evaluate the student's explanation of the topic "${topic}":
Explanation: "${explanation}"

Grounding constraint: Evaluate accuracy and completeness ONLY against the student's notes provided below. Every covered point, missing point and misconception MUST cite the exact [Page N]. If the topic is not in the notes, flag isTopicInNotes: false and state that notes don't cover this.`;

    const geminiRaw = await callGemini({
      systemInstruction,
      promptText: `${promptText}\n\nNotes Context:\n${JSON.stringify(context?.pages || [])}`,
      responseSchema: feynmanSchema,
      temperature: 0.2,
    });

    if (geminiRaw) {
      try {
        const parsed = JSON.parse(geminiRaw);
        return res.json(parsed);
      } catch (e) {
        console.warn('Failed parsing Feynman JSON:', e);
      }
    }

    const fallback = simulateGroundedAI({
      feature: 'feynman',
      prompt: explanation,
      context,
      options: { topic, audience },
    });
    return res.json(fallback);
  } catch (err) {
    console.error('Feynman evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate Feynman explanation' });
  }
});

// Mind Map Generator
app.post('/api/ai/mindmap', async (req, res) => {
  try {
    const { context } = req.body;

    const mindmapSchema = {
      type: 'OBJECT',
      properties: {
        nodes: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              id: { type: 'STRING' },
              label: { type: 'STRING' },
              summary: { type: 'STRING' },
              level: { type: 'NUMBER' },
              pageRefs: { type: 'ARRAY', items: { type: 'NUMBER' } },
              parentId: { type: 'STRING' },
            },
            required: ['id', 'label', 'summary', 'level', 'pageRefs'],
          },
        },
        edges: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              from: { type: 'STRING' },
              to: { type: 'STRING' },
              type: { type: 'STRING', enum: ['parent', 'relatedTo'] },
              label: { type: 'STRING' },
            },
            required: ['from', 'to', 'type'],
          },
        },
      },
      required: ['nodes', 'edges'],
    };

    const promptText = `Generate a hierarchical mind map structure strictly from the student's notes. Use only concepts present in the notes. Link children to parents and include relatedTo cross-links.`;

    const geminiRaw = await callGemini({
      promptText: `${promptText}\n\nContext:\n${JSON.stringify(context?.pages || [])}`,
      responseSchema: mindmapSchema,
      temperature: 0.2,
    });

    if (geminiRaw) {
      try {
        const parsed = JSON.parse(geminiRaw);
        return res.json(parsed);
      } catch (e) {
        console.warn('Failed parsing mindmap JSON:', e);
      }
    }

    const fallback = simulateGroundedAI({
      feature: 'mindmap',
      context,
    });
    return res.json(fallback);
  } catch (err) {
    console.error('Mindmap error:', err);
    res.status(500).json({ error: 'Failed to generate mind map' });
  }
});

// ========================
// QUIZ BATTLE ENDPOINTS
// ========================
app.post('/api/battle/create', (req, res) => {
  try {
    const { title, mode, questions, durationHours } = req.body;
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Questions are required to host a battle' });
    }
    const result = battle.createRoom({ title, mode, questions, durationHours });
    res.json(result);
  } catch (err) {
    console.error('Create battle error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/battle/:code/join', (req, res) => {
  try {
    const { nickname } = req.body;
    const result = battle.joinRoom(req.params.code, nickname);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/battle/:code/answer', (req, res) => {
  try {
    const { playerId, questionIndex, selectedOption, timeTakenMs } = req.body;
    const result = battle.submitAnswer({
      roomCode: req.params.code,
      playerId,
      questionIndex,
      selectedOption,
      timeTakenMs,
    });
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/battle/:code/start', (req, res) => {
  try {
    battle.startLiveBattle(req.params.code);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/battle/:code/next', (req, res) => {
  try {
    battle.advanceLiveQuestion(req.params.code);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/battle/:code/state', (req, res) => {
  try {
    const state = battle.getRoomState(req.params.code);
    if (!state) return res.status(404).json({ error: 'Room not found' });
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SSE Live room stream
app.get('/api/battle/:code/stream', (req, res) => {
  const roomCode = req.params.code.toUpperCase();
  const state = battle.getRoomState(roomCode);
  if (!state) return res.status(404).end('Room not found');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial state
  res.write(`data: ${JSON.stringify(state)}\n\n`);

  battle.subscribeToRoom(roomCode, req.query.playerId || null, res);
});

app.listen(PORT, () => {
  console.log(`StudyCanvas AI Express Proxy running on http://localhost:${PORT}`);
});
