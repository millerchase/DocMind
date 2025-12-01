import { STATUS_MESSAGES } from '../constants';

interface StatusBarProps {
  charCount: number;
  truncated: boolean;
  isPDF: boolean;
}

export function StatusBar({ charCount, truncated, isPDF }: StatusBarProps) {
  return (
    <div className="status-bar" aria-live="polite">
      <span className="char-count">
        {STATUS_MESSAGES.charCount(charCount)}
        {isPDF && ' (PDF)'}
      </span>
      {truncated && (
        <span className="truncation-notice" role="note">
          {STATUS_MESSAGES.truncated}
        </span>
      )}
    </div>
  );
}
