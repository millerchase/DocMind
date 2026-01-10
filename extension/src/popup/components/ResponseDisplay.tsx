import { useState } from 'react';
import { RESULT_MESSAGES } from '../constants';
import type { Citation } from '../../shared/types';
import { CitationBadge } from './CitationBadge';

interface ResponseDisplayProps {
  answer: string;
  citations?: Citation[];
  highlightStatus?: Map<string, boolean>;
}

export function ResponseDisplay({ answer, citations, highlightStatus }: ResponseDisplayProps) {
  const [copied, setCopied] = useState(false);
  const isNoAnswer = !answer || answer === RESULT_MESSAGES.noAnswer;

  const handleCopy = async () => {
    if (!navigator.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent fail (expected on some browsers)
    }
  };

  return (
    <div
      className={`response ${isNoAnswer ? 'no-answer' : ''}`}
      role="region"
      aria-label="AI response"
    >
      <div className="response-header">
        <button
          type="button"
          onClick={handleCopy}
          className="copy-button"
          aria-label={copied ? 'Copied!' : 'Copy answer'}
          disabled={isNoAnswer}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="answer-text" aria-live="polite">{answer}</div>
      {citations && citations.length > 0 && (
        <div className="citations-list">
          {citations.map((c, i) => (
            <CitationBadge
              key={c.id}
              citation={c}
              index={i}
              clickable={highlightStatus?.get(c.id) ?? false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
