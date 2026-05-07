import type { ReactNode } from 'react';
import { uiTokens } from '../../../shared/lib/ui-tokens';

/**
 * ------------------------------------------------------
 * Action Button Props
 * ------------------------------------------------------
 */
type ActionButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

/**
 * ------------------------------------------------------
 * Reusable Action Button
 * ------------------------------------------------------
 */
export function ActionButton({
  children,
  onClick,
  disabled,
  className,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${uiTokens.actionButton}${className ? ` ${className}` : ''}`}
    >
      {children}
    </button>
  );
}
