import { useDocMind } from './hooks/useDocMind';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBanner } from './components/ErrorBanner';
import { StatusBar } from './components/StatusBar';
import { QuickActions } from './components/QuickActions';
import { QuestionInput } from './components/QuestionInput';
import { ResponseDisplay } from './components/ResponseDisplay';
import { LOADING_MESSAGES } from './constants';
import { Action } from '../shared/types';

export default function App() {
  const { state, runAction, retry, prefillQuestion, clearPrefill } = useDocMind();

  const handleAsk = (question: string) => {
    runAction('ask', question);
  };

  const handleQuickAction = (action: Action) => {
    runAction(action);
  };

  // Extracting state
  if (state.status === 'idle' || state.status === 'extracting') {
    return (
      <div className="container">
        <h1 className="title">DocMind</h1>
        <LoadingSpinner message={LOADING_MESSAGES.extracting} />
      </div>
    );
  }

  // Error state
  if (state.status === 'error') {
    return (
      <div className="container">
        <h1 className="title">DocMind</h1>
        <ErrorBanner error={state.error} onRetry={retry} />
      </div>
    );
  }

  // Querying state
  if (state.status === 'querying') {
    return (
      <div className="container">
        <h1 className="title">DocMind</h1>
        <StatusBar
          charCount={state.charCount}
          truncated={state.truncated}
          isPDF={state.isPDF}
        />
        <LoadingSpinner message={LOADING_MESSAGES.querying} />
      </div>
    );
  }

  // Extracted or Success state
  // @ts-expect-error - isBusy kept for future-proofing; currently always false due to early return
  const isBusy = state.status === 'querying';

  return (
    <div className="container">
      <h1 className="title">DocMind</h1>
      <StatusBar
        charCount={state.charCount}
        truncated={state.truncated}
        isPDF={state.isPDF}
      />

      {state.status === 'success' && (
        <ResponseDisplay
          answer={state.answer}
          citations={state.citations}
          highlightStatus={state.highlightStatus}
        />
      )}

      <QuestionInput
        onSubmit={handleAsk}
        disabled={isBusy}
        initialValue={prefillQuestion}
        onInitialValueUsed={clearPrefill}
      />
      <QuickActions onAction={handleQuickAction} disabled={isBusy} />
    </div>
  );
}
