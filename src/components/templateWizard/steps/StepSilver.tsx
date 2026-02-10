import { useState } from 'react';
import { useTemplateWizardStore } from '../../../stores/templateWizardStore';
import { WizardCard } from '../shared/WizardCard';
import { ImageDropZone } from '../shared/ImageDropZone';

/**
 * Step 5: Optional silver mask upload.
 */
export function StepSilver() {
  const silverEnabled = useTemplateWizardStore((s) => s.silverEnabled);
  const silverMaskFront = useTemplateWizardStore((s) => s.silverMaskFront);
  const silverMaskBack = useTemplateWizardStore((s) => s.silverMaskBack);
  const referenceFront = useTemplateWizardStore((s) => s.referenceFront);
  const referenceBack = useTemplateWizardStore((s) => s.referenceBack);
  const setSilverEnabled = useTemplateWizardStore((s) => s.setSilverEnabled);
  const setSilverMaskFront = useTemplateWizardStore((s) => s.setSilverMaskFront);
  const setSilverMaskBack = useTemplateWizardStore((s) => s.setSilverMaskBack);

  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [overlayOpacity, setOverlayOpacity] = useState(50);

  const currentImage = previewSide === 'front' ? referenceFront : referenceBack;
  const currentMask = previewSide === 'front' ? silverMaskFront : silverMaskBack;

  return (
    <div className="space-y-4">
      <WizardCard
        title="Silberdruck (Optional)"
        description="Silberdruck gibt deinem Gutschein eine hochwertige, metallische Veredelung. Bestimmte Bereiche des Designs werden mit echtem Silber gedruckt."
      >
        <div className="flex items-center gap-3">
          <label className="label cursor-pointer gap-2">
            <span className="label-text">Silberdruck aktivieren</span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={silverEnabled}
              onChange={(e) => setSilverEnabled(e.target.checked)}
            />
          </label>
        </div>

        {!silverEnabled && (
          <p className="text-sm text-base-content/50 mt-2">
            Du kannst diesen Schritt überspringen, wenn dein Design keinen Silberdruck benötigt.
          </p>
        )}
      </WizardCard>

      {silverEnabled && (
        <>
          <WizardCard
            title="Was ist eine Silber-Maske?"
            description="Eine Silber-Maske ist ein Schwarz/Weiß-Bild mit den gleichen Dimensionen wie dein Design."
            tip="Weiß = hier wird Silber gedruckt. Schwarz = normaler Druck. Typische Silber-Elemente: Rahmen, Ornamente, Zierlinien. Nicht silbern: Porträtbereich, große Flächen."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label"><span className="label-text font-medium">Maske Vorderseite</span></label>
                <ImageDropZone
                  label="Silber-Maske (Vorne)"
                  image={silverMaskFront}
                  onImageSet={setSilverMaskFront}
                />
              </div>
              <div>
                <label className="label"><span className="label-text font-medium">Maske Rückseite</span></label>
                <ImageDropZone
                  label="Silber-Maske (Hinten)"
                  image={silverMaskBack}
                  onImageSet={setSilverMaskBack}
                />
              </div>
            </div>
          </WizardCard>

          {/* Overlay preview */}
          {currentMask && currentImage && (
            <WizardCard title="Vorschau: Silber-Overlay">
              <div className="flex gap-2 mb-2">
                <div className="join">
                  <button
                    className={`btn btn-xs join-item ${previewSide === 'front' ? 'btn-primary' : ''}`}
                    onClick={() => setPreviewSide('front')}
                  >
                    Vorne
                  </button>
                  <button
                    className={`btn btn-xs join-item ${previewSide === 'back' ? 'btn-primary' : ''}`}
                    onClick={() => setPreviewSide('back')}
                  >
                    Hinten
                  </button>
                </div>
                <label className="flex items-center gap-1 text-xs">
                  Overlay:
                  <input
                    type="range"
                    className="range range-xs range-primary w-24"
                    min={0}
                    max={100}
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                  />
                  {overlayOpacity}%
                </label>
              </div>

              <div
                className="relative border border-base-300 rounded-lg overflow-hidden"
                style={{ aspectRatio: `${currentImage.width}/${currentImage.height}` }}
              >
                <img
                  src={currentImage.dataUrl}
                  alt="Design"
                  className="w-full h-full object-contain"
                />
                <img
                  src={currentMask.dataUrl}
                  alt="Silber-Maske"
                  className="absolute inset-0 w-full h-full object-contain mix-blend-screen"
                  style={{ opacity: overlayOpacity / 100 }}
                />
              </div>
            </WizardCard>
          )}
        </>
      )}
    </div>
  );
}
