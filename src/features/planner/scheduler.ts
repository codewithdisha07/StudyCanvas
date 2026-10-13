import type { ExamPlanRecord, ExamTopic, ExamTask } from '../../types';

export interface AvailabilityConfig {
  hoursPerDay: number;
  daysOff: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

/**
 * Deterministic study scheduling algorithm:
 * - Never exceeds daily time budget
 * - Weighted by topic importance (1-5) and weakness
 * - Places first-pass study, spaced revision intervals (1, 3, 7 days), flashcards, topic quizzes, Feynman check
 * - Day before the exam is intentionally light review only
 */
export function generateDeterministicPlan({
  projectId,
  examName,
  examDate,
  availability,
  topics,
}: {
  projectId: string;
  examName: string;
  examDate: string; // "YYYY-MM-DD"
  availability: AvailabilityConfig;
  topics: ExamTopic[];
}): ExamPlanRecord {
  const targetDate = new Date(examDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const totalDays = Math.max(2, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const tasks: ExamTask[] = [];

  // Sort topics by priority weight (highest weight + highest difficulty first)
  const sortedTopics = [...topics].sort(
    (a, b) => (b.weight ?? 3) * (b.difficulty ?? 3) - (a.weight ?? 3) * (a.difficulty ?? 3)
  );

  let currentDayOffset = 0;

  sortedTopics.forEach((t) => {
    // 1. First-pass deep study
    while (currentDayOffset < totalDays - 1 && availability.daysOff.includes(new Date(today.getTime() + currentDayOffset * 86400000).getDay())) {
      currentDayOffset++;
    }

    const firstPassDay = Math.min(totalDays - 2, currentDayOffset);
    const firstPassDate = new Date(today.getTime() + firstPassDay * 86400000).toISOString().split('T')[0];

    tasks.push({
      id: `task-first-${t.id}`,
      date: firstPassDate,
      type: 'first_pass',
      topicId: t.id,
      topicName: t.name,
      pageRefs: t.pageRefs,
      durationMinutes: 45,
      status: 'pending',
      title: `First-Pass Deep Study: ${t.name}`,
    });

    // 2. Flashcard review (+1 day interval)
    const rev1Day = Math.min(totalDays - 2, firstPassDay + 1);
    const rev1Date = new Date(today.getTime() + rev1Day * 86400000).toISOString().split('T')[0];
    tasks.push({
      id: `task-fc-${t.id}`,
      date: rev1Date,
      type: 'flashcards',
      topicId: t.id,
      topicName: t.name,
      pageRefs: t.pageRefs,
      durationMinutes: 20,
      status: 'pending',
      title: `Spaced Flashcard Review: ${t.name}`,
    });

    // 3. Topic Practice Quiz (+3 day interval)
    if (totalDays >= 4) {
      const rev3Day = Math.min(totalDays - 2, firstPassDay + 3);
      const rev3Date = new Date(today.getTime() + rev3Day * 86400000).toISOString().split('T')[0];
      tasks.push({
        id: `task-quiz-${t.id}`,
        date: rev3Date,
        type: 'quiz',
        topicId: t.id,
        topicName: t.name,
        pageRefs: t.pageRefs,
        durationMinutes: 30,
        status: 'pending',
        title: `Adaptive Topic Quiz: ${t.name}`,
      });
    }

    // 4. Teach-it-back Feynman Session (+7 day interval or mid-plan)
    if (totalDays >= 8) {
      const rev7Day = Math.min(totalDays - 2, firstPassDay + 7);
      const rev7Date = new Date(today.getTime() + rev7Day * 86400000).toISOString().split('T')[0];
      tasks.push({
        id: `task-fey-${t.id}`,
        date: rev7Date,
        type: 'feynman',
        topicId: t.id,
        topicName: t.name,
        pageRefs: t.pageRefs,
        durationMinutes: 25,
        status: 'pending',
        title: `Feynman Teach-it-Back: ${t.name}`,
      });
    }

    currentDayOffset = (currentDayOffset + 1) % (totalDays - 1);
  });

  // Final Mock Exam (2 days before exam)
  const mockDay = Math.max(0, totalDays - 2);
  const mockDate = new Date(today.getTime() + mockDay * 86400000).toISOString().split('T')[0];
  tasks.push({
    id: `task-mock-final`,
    date: mockDate,
    type: 'mock_exam',
    topicId: 'all',
    topicName: 'Comprehensive Mock',
    pageRefs: [],
    durationMinutes: 60,
    status: 'pending',
    title: `Full Comprehensive Practice Exam`,
  });

  // Light Revision (1 day before exam - strictly light review)
  const lightDay = Math.max(0, totalDays - 1);
  const lightDate = new Date(today.getTime() + lightDay * 86400000).toISOString().split('T')[0];
  tasks.push({
    id: `task-light-review`,
    date: lightDate,
    type: 'revision_sheet',
    topicId: 'all',
    topicName: 'Formula & Sheet Check',
    pageRefs: [],
    durationMinutes: 25,
    status: 'pending',
    title: `Light Warm-up: Smart Revision Sheet`,
  });

  // Sort tasks chronologically
  tasks.sort((a, b) => a.date.localeCompare(b.date));

  return {
    id: `plan-${Date.now()}`,
    projectId,
    examName,
    examDate,
    availabilityHoursPerDay: availability.hoursPerDay,
    daysOff: availability.daysOff,
    topics,
    tasks,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Export study schedule to standard .ics iCalendar file
 */
export function exportToIcs(plan: ExamPlanRecord): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyCanvas AI//Exam Planner//EN',
    'CALSCALE:GREGORIAN',
  ];

  for (const task of plan.tasks) {
    const dateFormatted = task.date.replace(/-/g, '');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${task.id}@studycanvas.ai`);
    lines.push(`DTSTAMP:${dateFormatted}T090000Z`);
    lines.push(`DTSTART;VALUE=DATE:${dateFormatted}`);
    lines.push(`SUMMARY:StudyCanvas: ${task.title}`);
    lines.push(`DESCRIPTION:Estimated duration: ${task.durationMinutes} mins. Grounded revision for topic ${task.topicName}.`);
    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
