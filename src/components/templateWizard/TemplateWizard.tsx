import { useTemplateWizardStore, type WizardStep } from '../../stores/templateWizardStore';
import { WizardStepper } from './WizardStepper';
import { StepDesign } from './steps/StepDesign';
import { StepLayers } from './steps/StepLayers';
import { StepFields } from './steps/StepFields';
import { StepBadges } from './steps/StepBadges';
import { StepSilver } from './steps/StepSilver';
import { StepValidation } from './steps/StepValidation';

const STEP_TITLES: Record<WizardStep, string> = {
  1: 'Design hochladen',
  2: 'Layer zuordnen',
  3: 'Felder platzieren',
  4: 'Wert-Badges',
  5: 'Silber-Maske',
  6: 'Prüfung & Export',
};

const STEP_DESCRIPTIONS: Record<WizardStep, string> = {
  1: 'Lade dein fertiges Referenz-Design hoch und gib deinem Template einen Namen.',
  2: 'Lade die einzelnen Layer (Hintergrund, Rahmen, etc.) als separate PNG-Dateien hoch.',
  3: 'Platziere die personalisierbaren Felder (Name, E-Mail, etc.) auf dem Design.',
  4: 'Lade kunstvoll gestaltete Badge-Grafiken für die Gutscheinwerte (1h, 5h, 10h) hoch.',
  5: 'Optional: Definiere welche Bereiche mit Silber veredelt werden sollen.',
  6: 'Überprüfe dein Template-Paket und exportiere die template.json Datei.',
};

function StepContent({ step }: { step: WizardStep }) {
  switch (step) {
    case 1: return <StepDesign />;
    case 2: return <StepLayers />;
    case 3: return <StepFields />;
    case 4: return <StepBadges />;
    case 5: return <StepSilver />;
    case 6: return <StepValidation />;
  }
}

export function TemplateWizard() {
  const currentStep = useTemplateWizardStore((s) => s.currentStep);
  const maxVisitedStep = useTemplateWizardStore((s) => s.maxVisitedStep);
  const setStep = useTemplateWizardStore((s) => s.setStep);
  const nextStep = useTemplateWizardStore((s) => s.nextStep);
  const prevStep = useTemplateWizardStore((s) => s.prevStep);
  const resetWizard = useTemplateWizardStore((s) => s.resetWizard);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-currency">Template-Assistent</h2>
          <p className="text-sm text-base-content/60">Erstelle Schritt für Schritt ein Template-Paket für den Shop</p>
        </div>
        <button
          className="btn btn-ghost btn-xs text-error"
          onClick={() => {
            if (confirm('Alle Eingaben zurücksetzen?')) resetWizard();
          }}
        >
          Zurücksetzen
        </button>
      </div>

      {/* Stepper */}
      <WizardStepper
        currentStep={currentStep}
        maxVisitedStep={maxVisitedStep}
        onStepClick={setStep}
      />

      {/* Step title */}
      <div className="text-center">
        <h3 className="text-lg font-semibold">
          Schritt {currentStep}: {STEP_TITLES[currentStep]}
        </h3>
        <p className="text-sm text-base-content/60 max-w-xl mx-auto">
          {STEP_DESCRIPTIONS[currentStep]}
        </p>
      </div>

      {/* Step content */}
      <StepContent step={currentStep} />

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button
          className="btn btn-ghost"
          onClick={prevStep}
          disabled={currentStep === 1}
        >
          Zurück
        </button>

        {currentStep < 6 ? (
          <button className="btn btn-primary" onClick={nextStep}>
            Weiter
          </button>
        ) : (
          <div /> // Validation step has its own export buttons
        )}
      </div>
    </div>
  );
}
