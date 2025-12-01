import { ErrorCode } from '../../shared/types';
import { getErrorMessage } from '../constants';

interface ErrorBannerProps {
  error: ErrorCode;
  onRetry: () => void;
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert" aria-live="assertive">
      <p>{getErrorMessage(error)}</p>
      <button type="button" onClick={onRetry} className="retry-button">
        Try Again
      </button>
    </div>
  );
}
