import { useState } from 'react';
import { useTemplateWizardStore, type UploadedImage } from '../../../stores/templateWizardStore';
import { useGeminiStore } from '../../../stores/geminiStore';
import { useVoucherGalleryStore } from '../../../stores/voucherGalleryStore';
import { WizardCard } from '../shared/WizardCard';
import { ImageDropZone } from '../shared/ImageDropZone';

/**
 * Convert a base64 string (without data: prefix) to an UploadedImage
 * by loading it into an Image element to get dimensions.
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

/**
 * Step 1: Upload reference design + set metadata.
 * Supports importing from Prompt Generator (Gemini) and Gallery.
 */
export function StepDesign() {
  const templateName = useTemplateWizardStore((s) => s.templateName);
  const designerName = useTemplateWizardStore((s) => s.designerName);
  const referenceFront = useTemplateWizardStore((s) => s.referenceFront);
  const referenceBack = useTemplateWizardStore((s) => s.referenceBack);
  const setTemplateName = useTemplateWizardStore((s) => s.setTemplateName);
  const setDesignerName = useTemplateWizardStore((s) => s.setDesignerName);
  const setReferenceFront = useTemplateWizardStore((s) => s.setReferenceFront);
  const setReferenceBack = useTemplateWizardStore((s) => s.setReferenceBack);
  const setReferenceOriginal = useTemplateWizardStore((s) => s.setReferenceOriginal);

  // Import sources
  const processedImages = useGeminiStore((s) => s.processedImages);
  const galleryVouchers = useVoucherGalleryStore((s) => s.vouchers);
  const isGalleryLoading = useVoucherGalleryStore((s) => s.isLoading);

  const [isImporting, setIsImporting] = useState(false);

  const hasGeminiImages = processedImages?.frontBase64 && processedImages?.backBase64;
  const hasGalleryItems = galleryVouchers.length > 0;
  const hasImportSources = hasGeminiImages || hasGalleryItems;

  const importFromGemini = async () => {
    if (!processedImages?.frontBase64 || !processedImages?.backBase64) return;
    setIsImporting(true);
    try {
      const [front, back] = await Promise.all([
        base64ToUploadedImage(processedImages.frontBase64, 'gemini-front.png'),
        base64ToUploadedImage(processedImages.backBase64, 'gemini-back.png'),
      ]);
      setReferenceFront(front);
      setReferenceBack(back);
      setReferenceOriginal(processedImages.originalBase64 || null);
    } catch (e) {
      console.warn('Import from Gemini failed:', e);
    }
    setIsImporting(false);
  };

  const importFromGallery = async (voucher: typeof galleryVouchers[0]) => {
    if (!voucher.frontBase64 || !voucher.backBase64) return;
    setIsImporting(true);
    try {
      const [front, back] = await Promise.all([
        base64ToUploadedImage(voucher.frontBase64, `${voucher.id}-front.png`),
        base64ToUploadedImage(voucher.backBase64, `${voucher.id}-back.png`),
      ]);
      setReferenceFront(front);
      setReferenceBack(back);
      setReferenceOriginal(voucher.originalBase64 || null);
    } catch (e) {
      console.warn('Import from gallery failed:', e);
    }
    setIsImporting(false);
  };

  return (
    <div className="space-y-4">
      <WizardCard
        title="Template-Informationen"
        description="Gib deinem Template einen Namen. Dieser wird im Shop angezeigt."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label"><span className="label-text">Template-Name</span></label>
            <input
              className="input input-bordered w-full"
              placeholder="z.B. Spiritual Natur Blätter"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Designer</span></label>
            <input
              className="input input-bordered w-full"
              placeholder="Dein Name"
              value={designerName}
              onChange={(e) => setDesignerName(e.target.value)}
            />
          </div>
        </div>
      </WizardCard>

      {/* Import from existing sources */}
      {hasImportSources && (
        <WizardCard
          title="Aus bestehendem Design übernehmen"
          description="Übernimm Vorder- und Rückseite direkt aus dem Prompt Generator oder der Galerie."
        >
          <div className="space-y-3">
            {/* Prompt Generator (Gemini) */}
            {hasGeminiImages && (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-base-200/50">
                <div className="flex gap-2 flex-1 min-w-0">
                  <img
                    src={`data:image/png;base64,${processedImages!.frontBase64}`}
                    alt="Gemini Front"
                    className="h-16 rounded border border-base-300 object-contain"
                  />
                  <img
                    src={`data:image/png;base64,${processedImages!.backBase64}`}
                    alt="Gemini Back"
                    className="h-16 rounded border border-base-300 object-contain"
                  />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-base-content/60">Prompt Generator</span>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={importFromGemini}
                    disabled={isImporting}
                  >
                    {isImporting ? <span className="loading loading-spinner loading-xs" /> : 'Übernehmen'}
                  </button>
                </div>
              </div>
            )}

            {/* Gallery items */}
            {hasGalleryItems && !isGalleryLoading && (
              <div>
                <div className="text-sm font-medium text-base-content/70 mb-2">Galerie</div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {galleryVouchers.map((v) => (
                    <button
                      key={v.id}
                      className="flex-shrink-0 group relative rounded-lg border border-base-300 hover:border-primary transition-colors overflow-hidden"
                      onClick={() => importFromGallery(v)}
                      disabled={isImporting || !v.frontBase64}
                      title="Design übernehmen"
                    >
                      <img
                        src={v.thumbnailBase64
                          ? `data:image/jpeg;base64,${v.thumbnailBase64}`
                          : `data:image/png;base64,${v.frontBase64}`}
                        alt="Galerie-Design"
                        className="h-20 w-auto object-contain"
                      />
                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors flex items-center justify-center">
                        <span className="text-xs bg-black/60 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          Übernehmen
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </WizardCard>
      )}

      <WizardCard
        title="Referenz-Design hochladen"
        description="Oder lade dein Design manuell hoch — mit Beispieldaten (z.B. 'Max Mustermann', '1 Stunde')."
        tip="Mindestauflösung: 1622×886 px (300 DPI). Empfohlen: 3400×1670 px (600 DPI). Format: PNG oder WebP."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label"><span className="label-text font-medium">Vorderseite</span></label>
            <ImageDropZone
              label="Vorderseite hochladen"
              image={referenceFront}
              onImageSet={setReferenceFront}
            />
            {referenceFront && referenceFront.width < 1622 && (
              <p className="text-xs text-warning mt-1">
                Auflösung ({referenceFront.width}px) unter dem Minimum (1622px)
              </p>
            )}
          </div>
          <div>
            <label className="label"><span className="label-text font-medium">Rückseite</span></label>
            <ImageDropZone
              label="Rückseite hochladen"
              image={referenceBack}
              onImageSet={setReferenceBack}
            />
          </div>
        </div>
      </WizardCard>

      {/* Summary */}
      {referenceFront && (
        <div className="text-sm text-base-content/60">
          Dimensionen: {referenceFront.width}×{referenceFront.height} px
          {referenceFront.width >= 1622 && ' — Auflösung OK'}
        </div>
      )}
    </div>
  );
}
