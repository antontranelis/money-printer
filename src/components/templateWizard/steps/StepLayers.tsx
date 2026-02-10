import { useState } from 'react';
import { useTemplateWizardStore, type UploadedImage } from '../../../stores/templateWizardStore';
import { useGeminiStore } from '../../../stores/geminiStore';
import { refineImageWithGemini } from '../../../services/geminiImageGenerator';
import { processVoucherImage } from '../../../services/voucherImageProcessor';
import { WizardCard } from '../shared/WizardCard';
import { ImageDropZone } from '../shared/ImageDropZone';

const TEXT_REMOVAL_PROMPT_DE = `Entferne ALLE Texte, Zahlen, Wertangaben, Seriennummern und Beschriftungen aus diesem Gutschein-Bild.
Ersetze die entfernten Textstellen nahtlos mit dem umliegenden Hintergrund/Muster/Design.
Behalte alle dekorativen Elemente, Rahmen, Ornamente, Muster und das gesamte visuelle Design bei.
Das Ergebnis soll wie ein sauberes Template aussehen — nur die Dekoration, keine Texte.
WICHTIG: Behalte exakt das gleiche Format, die gleiche Auflösung und den gleichen Bildausschnitt bei.`;

/**
 * Convert a base64 string (without data: prefix) to an UploadedImage.
 */
function base64ToUploadedImage(base64: string, name: string): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        dataUrl: `data:image/png;base64,${base64}`,
        name,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
    img.src = `data:image/png;base64,${base64}`;
  });
}

type CleaningStatus = 'idle' | 'cleaning' | 'splitting' | 'done' | 'error';

/**
 * Step 2: Upload and assign layer images.
 *
 * Shows front and back layers grouped by side with toggle visibility.
 * Includes AI text removal feature to generate clean background layers.
 */
export function StepLayers() {
  const layers = useTemplateWizardStore((s) => s.layers);
  const referenceFront = useTemplateWizardStore((s) => s.referenceFront);
  const referenceBack = useTemplateWizardStore((s) => s.referenceBack);
  const referenceOriginal = useTemplateWizardStore((s) => s.referenceOriginal);
  const setLayerImage = useTemplateWizardStore((s) => s.setLayerImage);

  const apiKey = useGeminiStore((s) => s.apiKey);
  const selectedModelOption = useGeminiStore((s) => s.selectedModelOption);

  const [cleaningStatus, setCleaningStatus] = useState<CleaningStatus>('idle');
  const [cleaningError, setCleaningError] = useState<string | null>(null);

  const frontLayers = layers.filter((l) => l.side === 'front');
  const backLayers = layers.filter((l) => l.side === 'back');

  const uploadedCount = layers.filter((l) => l.image !== null).length;
  const requiredMissing = layers.filter((l) => l.required && !l.image).length;

  const canClean = apiKey && referenceOriginal;
  const isCleaning = cleaningStatus === 'cleaning' || cleaningStatus === 'splitting';

  const cleanTextsWithGemini = async () => {
    if (!apiKey || !referenceOriginal) return;
    setCleaningError(null);

    try {
      // Send original combined image to Gemini for text removal
      setCleaningStatus('cleaning');
      const originalBase64 = referenceOriginal.includes(',')
        ? referenceOriginal.split(',')[1]
        : referenceOriginal;

      const result = await refineImageWithGemini({
        apiKey,
        currentImage: originalBase64,
        refinementPrompt: TEXT_REMOVAL_PROMPT_DE,
        promptLanguage: 'de',
        modelOptionId: selectedModelOption,
      });

      if (!result.success || !result.imageBase64) {
        throw new Error(result.error || 'Keine Antwort von Gemini');
      }

      // Split the cleaned result into front/back using processVoucherImage
      setCleaningStatus('splitting');
      const processed = await processVoucherImage({
        imageBase64: result.imageBase64,
      });

      const [frontImg, backImg] = await Promise.all([
        base64ToUploadedImage(processed.frontBase64, 'front-background-clean.png'),
        base64ToUploadedImage(processed.backBase64, 'back-background-clean.png'),
      ]);

      setLayerImage('front-background', frontImg);
      setLayerImage('back-background', backImg);

      setCleaningStatus('done');
    } catch (e) {
      setCleaningStatus('error');
      setCleaningError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    }
  };

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <WizardCard
        title="Layer-System"
        description="Dein Design besteht aus mehreren transparenten Schichten (Layern), die übereinander gelegt werden. Jeder Layer ist eine separate PNG-Datei mit transparentem Hintergrund. Nur der Hintergrund-Layer ist Pflicht."
        tip="Alle Layer müssen die gleichen Pixel-Dimensionen haben. Verwende PNG mit Alpha-Kanal (Transparenz) für alle Layer außer dem Hintergrund."
      >
        <div className="text-sm text-base-content/60">
          {uploadedCount} von {layers.length} Layer hochgeladen
          {requiredMissing > 0 && (
            <span className="text-error"> — {requiredMissing} Pflicht-Layer fehlen</span>
          )}
        </div>
      </WizardCard>

      {/* AI Text Removal */}
      {referenceOriginal && (
        <WizardCard
          title="Hintergrund per KI erzeugen"
          description="Gemini entfernt alle Texte, Wertangaben und Seriennummern aus deinem Original-Design und erzeugt saubere Hintergrund-Layer (Vorder- und Rückseite)."
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="btn btn-sm btn-secondary"
              onClick={cleanTextsWithGemini}
              disabled={!canClean || isCleaning}
            >
              {isCleaning ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  {cleaningStatus === 'cleaning' ? 'Texte entfernen...' : 'Aufteilen...'}
                </>
              ) : cleaningStatus === 'done' ? (
                'Nochmal generieren'
              ) : (
                'Texte per KI entfernen'
              )}
            </button>
            {!apiKey && (
              <span className="text-xs text-warning">Gemini API-Key benötigt (Prompt Generator)</span>
            )}
            {cleaningStatus === 'done' && (
              <span className="text-xs text-success">Hintergrund-Layer erzeugt</span>
            )}
            {cleaningError && (
              <span className="text-xs text-error">{cleaningError}</span>
            )}
          </div>
        </WizardCard>
      )}

      {/* Front layers */}
      <WizardCard title="Vorderseite">
        {referenceFront && (
          <div className="mb-3">
            <p className="text-xs text-base-content/50 mb-1">Referenz-Design:</p>
            <img
              src={referenceFront.dataUrl}
              alt="Referenz Vorderseite"
              className="max-h-28 rounded border border-base-300 opacity-60"
            />
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {frontLayers.map((layer) => (
            <div key={layer.id}>
              <label className="label py-0.5">
                <span className="label-text text-xs">
                  {layer.label}
                  {layer.required && <span className="text-error ml-0.5">*</span>}
                </span>
              </label>
              <ImageDropZone
                label={layer.label.split(' (')[0]}
                image={layer.image}
                onImageSet={(img) => setLayerImage(layer.id, img)}
                compact
              />
            </div>
          ))}
        </div>
      </WizardCard>

      {/* Back layers */}
      <WizardCard title="Rückseite">
        {referenceBack && (
          <div className="mb-3">
            <p className="text-xs text-base-content/50 mb-1">Referenz-Design:</p>
            <img
              src={referenceBack.dataUrl}
              alt="Referenz Rückseite"
              className="max-h-28 rounded border border-base-300 opacity-60"
            />
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {backLayers.map((layer) => (
            <div key={layer.id}>
              <label className="label py-0.5">
                <span className="label-text text-xs">
                  {layer.label}
                  {layer.required && <span className="text-error ml-0.5">*</span>}
                </span>
              </label>
              <ImageDropZone
                label={layer.label.split(' (')[0]}
                image={layer.image}
                onImageSet={(img) => setLayerImage(layer.id, img)}
                compact
              />
            </div>
          ))}
        </div>
      </WizardCard>
    </div>
  );
}
