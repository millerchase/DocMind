import { RESULT_MESSAGES } from '../constants';

interface ResponseDisplayProps {
  answer: string;
}

export function ResponseDisplay({ answer }: ResponseDisplayProps) {
  const isNoAnswer = answer === RESULT_MESSAGES.noAnswer;

  return (
    <div
      className={`response ${isNoAnswer ? 'no-answer' : ''}`}
      role="region"
      aria-label="AI response"
      aria-live="polite"
    >
      <div className="answer-text">{answer}</div>
    </div>
  );
}
