'use client';

import { useState, useEffect } from 'react';
import type { IndustryData } from '@/lib/types';
import { getRecommendedRoles } from '@/lib/role-utils';

interface Props {
  data: IndustryData;
  onComplete: (roleIds: string[]) => void;
  onSkip: () => void;
}

type Answers = { persona: string; education: string; goal: string };

const STEPS = [
  {
    key: 'persona' as const,
    question: 'What describes you best?',
    options: [
      { value: 'student',  label: 'Student or new to this industry',    emoji: '🎓' },
      { value: 'growing',  label: 'Working here, looking to grow',       emoji: '📈' },
      { value: 'changer',  label: 'Career changer from another field',   emoji: '🔄' },
      { value: 'advisor',  label: 'Workforce advisor or educator',        emoji: '🧭' },
    ],
  },
  {
    key: 'education' as const,
    question: "What's your highest education?",
    options: [
      { value: 'hs',       label: 'High school diploma or GED',          emoji: '📋' },
      { value: '2yr',      label: "Associate's degree or vocational",     emoji: '🏫' },
      { value: '4yr',      label: "Bachelor's degree",                    emoji: '🎓' },
      { value: 'graduate', label: "Master's or PhD",                      emoji: '🔬' },
    ],
  },
  {
    key: 'goal' as const,
    question: 'What matters most to you?',
    options: [
      { value: 'salary',    label: 'Higher earning potential',            emoji: '💰' },
      { value: 'stability', label: 'Job stability and demand',            emoji: '🏗️' },
      { value: 'leadership',label: 'Moving into leadership',              emoji: '🚀' },
      { value: 'technical', label: 'Deep technical mastery',              emoji: '⚙️' },
    ],
  },
];

const STORAGE_KEY = 'wizard-completed';

export default function GetStartedWizard({ data, onComplete, onSkip }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});

  // Check localStorage — only show if first visit.
  // setVisible is deferred via setTimeout so the setState call is not synchronous
  // inside the effect body (satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const id = setTimeout(() => setVisible(true), 0);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  function choose(value: string) {
    const updated = { ...answers, [current.key]: value } as Partial<Answers>;
    setAnswers(updated);

    if (isLast) {
      // Done — compute recommendations
      localStorage.setItem(STORAGE_KEY, '1');
      const full = updated as Answers;
      const ids = getRecommendedRoles(data, full);
      setVisible(false);
      onComplete(ids);
    } else {
      setStep(s => s + 1);
    }
  }

  function handleSkip() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
    onSkip();
  }

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${((step) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-7">
          {/* Step indicator */}
          <div className="flex items-center gap-1 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                  i <= step ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 id="wizard-title" className="text-xl font-bold text-gray-900 mb-5">
            {current.question}
          </h2>

          {/* Option buttons */}
          <div className="flex flex-col gap-2">
            {current.options.map(opt => (
              <button
                key={opt.value}
                onClick={() => choose(opt.value)}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border-2 border-gray-100
                           text-left font-semibold text-gray-800 hover:border-blue-300 hover:bg-blue-50
                           transition-all duration-150 focus:outline-none focus-visible:ring-2
                           focus-visible:ring-blue-500"
              >
                <span className="text-xl" aria-hidden="true">{opt.emoji}</span>
                <span className="text-sm">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Skip */}
          <button
            onClick={handleSkip}
            className="w-full mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded py-1"
          >
            Skip — show me all roles
          </button>
        </div>
      </div>
    </div>
  );
}
