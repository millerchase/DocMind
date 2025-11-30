import { Action } from '../../shared/types';
import { QUICK_ACTIONS } from '../constants';

interface QuickActionsProps {
  onAction: (action: Action) => void;
  disabled: boolean;
}

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className="quick-actions" role="group" aria-label="Quick actions">
      {QUICK_ACTIONS.map(({ action, label }) => (
        <button
          type="button"
          key={action}
          onClick={() => onAction(action)}
          disabled={disabled}
          className="quick-action-button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
