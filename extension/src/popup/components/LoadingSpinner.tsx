interface LoadingSpinnerProps {
  message: string;
}

export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="loading" role="status" aria-live="polite" aria-busy="true">
      <div className="spinner" />
      <span>{message}</span>
    </div>
  );
}
