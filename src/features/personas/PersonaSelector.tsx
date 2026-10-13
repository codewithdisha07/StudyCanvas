import React, { useState } from 'react';
import { STUDY_PERSONAS, type StudyPersona } from './personaConfig';
import { ChevronDown } from 'lucide-react';

interface PersonaSelectorProps {
  currentPersona: StudyPersona;
  onSelectPersona: (persona: StudyPersona) => void;
}

export const PersonaSelector: React.FC<PersonaSelectorProps> = ({
  currentPersona,
  onSelectPersona,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700 transition"
        title="Select AI Study Buddy Persona"
      >
        <span className="text-sm">{currentPersona.avatar}</span>
        <span className="hidden sm:inline">{currentPersona.name}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 w-64 p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-40 flex flex-col gap-1">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
              Study Buddy Persona
            </div>
            {STUDY_PERSONAS.map((p) => {
              const isSelected = p.id === currentPersona.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectPersona(p);
                    setIsOpen(false);
                  }}
                  className={`flex items-start gap-2.5 p-2 rounded-xl text-left transition ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-medium'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-xl leading-none mt-0.5">{p.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold flex items-center justify-between">
                      {p.name}
                      {isSelected && <span className="text-[10px] text-indigo-500">Active</span>}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2 mt-0.5">
                      {p.tagline}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
