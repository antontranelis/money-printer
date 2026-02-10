import type { ReactNode } from 'react';

interface WizardCardProps {
  title: string;
  description?: string;
  tip?: string;
  children: ReactNode;
}

/**
 * Consistent card wrapper for wizard step content sections.
 */
export function WizardCard({ title, description, tip, children }: WizardCardProps) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-4 sm:p-6">
        <h3 className="card-title text-lg">{title}</h3>
        {description && <p className="text-sm text-base-content/70">{description}</p>}
        <div className="mt-2">{children}</div>
        {tip && (
          <div className="mt-3 text-xs text-base-content/50 bg-info/5 border border-info/20 rounded-lg p-3">
            <span className="font-semibold">Tipp:</span> {tip}
          </div>
        )}
      </div>
    </div>
  );
}
