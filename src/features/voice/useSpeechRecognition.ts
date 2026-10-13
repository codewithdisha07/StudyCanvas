import { useState, useEffect, useRef, useCallback } from 'react';


export function parseVoiceCommands(text: string): { parsedText: string; isNewPageCommand: boolean } {
  let isNewPageCommand = false;
  let result = text;

  if (/\bnew page\b/i.test(result)) {
    isNewPageCommand = true;
    result = result.replace(/\bnew page\b/gi, '');
  }

  result = result
    .replace(/\bnew line\b/gi, '\n')
    .replace(/\bfull stop\b/gi, '.')
    .replace(/\bperiod\b/gi, '.')
    .replace(/\bcomma\b/gi, ',')
    .replace(/\bquestion mark\b/gi, '?')
    .replace(/\bexclamation mark\b/gi, '!');

  return { parsedText: result.trim(), isNewPageCommand };
}

export function useSpeechRecognition() {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-IN');

  const recognitionRef = useRef<any>(null);
  const shouldContinueRef = useRef<boolean>(false);

  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as any) : {};
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      setIsSupported(true);
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += trans + ' ';
          } else {
            interim += trans;
          }
        }

        if (final) {
          const { parsedText } = parseVoiceCommands(final);
          setTranscript((prev) => (prev ? `${prev} ${parsedText}` : parsedText));
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          console.warn('Speech recognition error:', e.error);
          setError(e.error === 'not-allowed' ? 'Microphone permission denied.' : `Speech error: ${e.error}`);
        }
      };

      recognition.onend = () => {
        if (shouldContinueRef.current) {
          try {
            recognition.start();
          } catch (_) {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
    }

    return () => {
      shouldContinueRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
    };
  }, [selectedLanguage]);

  const startListening = useCallback(
    (lang?: string) => {
      if (!isSupported || !recognitionRef.current) {
        setError('Speech recognition is not supported in this browser (use Chrome or Edge).');
        return;
      }
      if (lang) {
        setSelectedLanguage(lang);
        recognitionRef.current.lang = lang;
      }
      setTranscript('');
      setInterimTranscript('');
      setError(null);
      shouldContinueRef.current = true;

      try {
        recognitionRef.current.start();
      } catch (_) {
        // Already started
      }
    },
    [isSupported]
  );

  const stopListening = useCallback(() => {
    shouldContinueRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    selectedLanguage,
    setSelectedLanguage,
    startListening,
    stopListening,
    resetTranscript,
  };
}
