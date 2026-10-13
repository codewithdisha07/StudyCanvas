import React, { useEffect } from 'react';
import { Mic, MicOff, Plus, X, Globe, Copy, Check } from 'lucide-react';
import { useSpeechRecognition } from './useSpeechRecognition';

interface VoiceDictationModalProps {
  onInsertTextBox: (text: string) => void;
  onAddNewPage: (title: string, text: string) => void;
  onClose: () => void;
}

const SUPPORTED_LANGS = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'hi-IN', label: 'हिंदी (Hindi)' },
  { code: 'mr-IN', label: 'मराठी (Marathi)' },
];

export const VoiceDictationModal: React.FC<VoiceDictationModalProps> = ({
  onInsertTextBox,
  onAddNewPage,
  onClose,
}) => {
  const {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    selectedLanguage,
    setSelectedLanguage,
    startListening,
    stopListening,
  } = useSpeechRecognition();

  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    if (isSupported) {
      startListening(selectedLanguage);
    }
    return () => {
      stopListening();
    };
  }, [selectedLanguage]);

  const fullDisplay = `${transcript} ${interimTranscript}`.trim();

  const handleCopy = () => {
    if (fullDisplay) {
      navigator.clipboard.writeText(fullDisplay);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleInsert = () => {
    if (fullDisplay) {
      onInsertTextBox(fullDisplay);
      onClose();
    }
  };

  const handleCreatePage = () => {
    if (fullDisplay) {
      onAddNewPage('Voice Dictated Notes', fullDisplay);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Voice Dictation to Canvas"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Dictate to Study Canvas
              </h3>
              <p className="text-[11px] text-slate-500">
                Speak formulas or notes. Say "new line" or "full stop" for punctuation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
            aria-label="Close Voice Dictation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Language Picker */}
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">Language:</span>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
          >
            {SUPPORTED_LANGS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Live Transcript Box */}
        <div className="min-h-[140px] max-h-[220px] overflow-y-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100 leading-relaxed font-sans select-text">
          {error ? (
            <div className="text-rose-500 flex items-center gap-1.5">{error}</div>
          ) : fullDisplay ? (
            <span className="whitespace-pre-wrap">{fullDisplay}</span>
          ) : (
            <span className="text-slate-400 italic">Listening... Start speaking your notes.</span>
          )}
        </div>

        {/* Visualizer Status */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-rose-500 animate-ping' : 'bg-slate-400'}`} />
            <span>{isListening ? 'Microphone Active' : 'Microphone Paused'}</span>
          </div>

          <button
            type="button"
            onClick={() => (isListening ? stopListening() : startListening())}
            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
          >
            {isListening ? 'Pause Mic' : 'Resume Mic'}
          </button>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!fullDisplay}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl disabled:opacity-30 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreatePage}
              disabled={!fullDisplay}
              className="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-xl disabled:opacity-40 transition"
            >
              Add as New Page
            </button>
            <button
              type="button"
              onClick={handleInsert}
              disabled={!fullDisplay}
              className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-40 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Insert on Canvas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
