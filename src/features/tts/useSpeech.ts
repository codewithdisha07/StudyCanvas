import { useState, useEffect, useRef, useCallback } from 'react';
import { splitIntoSentences } from './sentenceSplitter';

export interface UseSpeechOptions {
  initialRate?: number;
  initialPitch?: number;
  onSentenceChange?: (index: number, sentence: string) => void;
  onFinish?: () => void;
}

export function useSpeech(options: UseSpeechOptions = {}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [rate, setRate] = useState<number>(options.initialRate ?? 1.0);
  const [pitch, setPitch] = useState<number>(options.initialPitch ?? 1.0);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);

  const isSpeakingRef = useRef<boolean>(false);
  const sentencesRef = useRef<string[]>([]);
  const currentIndexRef = useRef<number>(-1);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load available voices asynchronously
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        setVoices(v);
        // Default to English or system default
        const defaultVoice = v.find((voice) => voice.lang.startsWith('en')) || v[0];
        setSelectedVoice(defaultVoice);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    currentIndexRef.current = -1;
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSentenceIndex(-1);
  }, []);

  const speakCurrentSentence = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const idx = currentIndexRef.current;
    const sList = sentencesRef.current;

    if (idx < 0 || idx >= sList.length) {
      stop();
      options.onFinish?.();
      return;
    }

    window.speechSynthesis.cancel();

    const sentence = sList[idx];
    setCurrentSentenceIndex(idx);
    options.onSentenceChange?.(idx, sentence);

    const utterance = new SpeechSynthesisUtterance(sentence);
    utteranceRef.current = utterance;
    utterance.rate = rate;
    utterance.pitch = pitch;

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      if (!isSpeakingRef.current) return;
      if (currentIndexRef.current < sList.length - 1) {
        currentIndexRef.current += 1;
        speakCurrentSentence();
      } else {
        stop();
        options.onFinish?.();
      }
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('Speech synthesis error:', e);
      }
      stop();
    };

    window.speechSynthesis.speak(utterance);
  }, [rate, pitch, selectedVoice, stop, options]);

  const play = useCallback(
    (text: string, detectedLang?: string) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        alert('Text-to-speech is not supported in this browser.');
        return;
      }

      // Auto-pick voice if language is detected (e.g. Hindi, Marathi, English)
      if (detectedLang && voices.length > 0) {
        const matchingVoice = voices.find((v) =>
          v.lang.toLowerCase().startsWith(detectedLang.toLowerCase())
        );
        if (matchingVoice) {
          setSelectedVoice(matchingVoice);
        }
      }

      const sList = splitIntoSentences(text, detectedLang || 'en');
      if (sList.length === 0) return;

      sentencesRef.current = sList;
      setSentences(sList);
      currentIndexRef.current = 0;
      isSpeakingRef.current = true;
      setIsPlaying(true);
      setIsPaused(false);

      speakCurrentSentence();
    },
    [voices, speakCurrentSentence]
  );

  const pause = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, []);

  const next = useCallback(() => {
    if (currentIndexRef.current < sentencesRef.current.length - 1) {
      currentIndexRef.current += 1;
      speakCurrentSentence();
    }
  }, [speakCurrentSentence]);

  const prev = useCallback(() => {
    if (currentIndexRef.current > 0) {
      currentIndexRef.current -= 1;
      speakCurrentSentence();
    }
  }, [speakCurrentSentence]);

  return {
    voices,
    selectedVoice,
    setSelectedVoice,
    rate,
    setRate,
    pitch,
    setPitch,
    isPlaying,
    isPaused,
    sentences,
    currentSentenceIndex,
    play,
    pause,
    resume,
    stop,
    next,
    prev,
  };
}
