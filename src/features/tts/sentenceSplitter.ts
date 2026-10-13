/**
 * Splits text into discrete sentences using Intl.Segmenter with regex fallback.
 * Solves the Chrome SpeechSynthesis long-utterance cutoff bug.
 */
export function splitIntoSentences(text: string, locale = 'en'): string[] {
  if (!text || !text.trim()) return [];

  const cleaned = text.trim();

  // Try standard Intl.Segmenter
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new (Intl as any).Segmenter(locale, { granularity: 'sentence' });
      const segments: string[] = [];
      for (const seg of segmenter.segment(cleaned)) {
        const s = (seg as any).segment?.trim?.() || '';
        if (s.length > 0) {
          segments.push(s);
        }
      }
      if (segments.length > 0) {
        return segments;
      }
    } catch (_) {
      // Fallback to regex
    }
  }

  // Regex fallback matching punctuation (. ! ? \n)
  return cleaned
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
