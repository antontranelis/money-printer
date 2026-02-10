import type { WizardStep } from '../../stores/templateWizardStore';

const STEPS: { step: WizardStep; label: string; icon: string }[] = [
  { step: 1, label: 'Design', icon: '1' },
  { step: 2, label: 'Layer', icon: '2' },
  { step: 3, label: 'Felder', icon: '3' },
  { step: 4, label: 'Badges', icon: '4' },
  { step: 5, label: 'Silber', icon: '5' },
  { step: 6, label: 'Prüfung', icon: '6' },
];

interface WizardStepperProps {
  currentStep: WizardStep;
  maxVisitedStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
}

export function WizardStepper({ currentStep, onStepClick }: WizardStepperProps) {
  return (
    <ul className="steps steps-horizontal w-full">
      {STEPS.map(({ step, label }) => {
        const isActive = step === currentStep;
        const isDone = step < currentStep;

        return (
          <li
            key={step}
            className={`step cursor-pointer ${isDone ? 'step-success' : isActive ? 'step-primary' : ''}`}
            onClick={() => onStepClick(step)}
          >
            <span
              className={`text-xs sm:text-sm transition-colors hover:text-primary ${isActive ? 'font-bold' : ''}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
