import { useState, FormEvent } from 'react';
import { PLACEHOLDERS } from '../constants';

interface QuestionInputProps {
  onSubmit: (question: string) => void;
  disabled: boolean;
}

export function QuestionInput({ onSubmit, disabled }: QuestionInputProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setQuestion('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="question-form">
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={PLACEHOLDERS.questionInput}
        disabled={disabled}
        className="question-input"
        aria-label="Ask a question about this page"
        autoFocus
      />
      <button
        type="submit"
        disabled={disabled || !question.trim()}
        className="submit-button"
      >
        Ask
      </button>
    </form>
  );
}
