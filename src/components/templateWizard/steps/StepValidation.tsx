import { useCallback, useEffect, useRef, useState } from 'react';
import { useTemplateWizardStore, type ValidationCheck } from '../../../stores/templateWizardStore';
import { WizardCard } from '../shared/WizardCard';
import type { TemplateV2, TemplateField, Layer, BadgeAssets } from '../../../templates/schema';

const EXAMPLE_VALUES: Record<string, string> = {
  name: 'Max Mustermann',
  email: 'max@beispiel.de',
  phone: '+49 123 456789',
  description: 'Beschreibungstext hier...',
  website: 'www.beispiel.de',
};

/**
 * Load an image from a data URL
 */
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Step 6: Validate template and generate export.
 */
export function StepValidation() {
  const {
    templateName,
    designerName,
    referenceFront,
    referenceBack,
    layers,
    fields,
    badges,
    badgePositions,
    silverEnabled,
    silverMaskFront,
    silverMaskBack,
    validationChecks,
    isValidating,
    setValidationChecks,
    setIsValidating,
  } = useTemplateWizardStore();

  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [previewValue, setPreviewValue] = useState(1);
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);

  // Determine background image (prefer cleaned layer, fallback to reference)
  const frontBg = layers.find((l) => l.id === 'front-background')?.image;
  const backBg = layers.find((l) => l.id === 'back-background')?.image;
  const frontImage = frontBg || referenceFront;
  const backImage = backBg || referenceBack;

  // Render preview onto canvas
  const renderPreview = useCallback(async (side: 'front' | 'back') => {
    const canvas = side === 'front' ? frontCanvasRef.current : backCanvasRef.current;
    const bgImage = side === 'front' ? frontImage : backImage;
    if (!canvas || !bgImage) return;

    const w = bgImage.width;
    const h = bgImage.height;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    // 1. Background layer
    const bg = await loadImg(bgImage.dataUrl);
    ctx.drawImage(bg, 0, 0, w, h);

    // 2. Additional layers (frame, profileArea, valueArea, qrArea, infoArea)
    const layerOrder = ['frame', 'profileArea', 'valueArea', 'qrArea', 'infoArea'];
    for (const type of layerOrder) {
      const layer = layers.find((l) => l.side === side && l.type === type);
      if (layer?.image) {
        const img = await loadImg(layer.image.dataUrl);
        ctx.drawImage(img, 0, 0, w, h);
      }
    }

    // 3. Badges
    const sideBadgePositions = badgePositions.filter((p) => p.side === side);
    const activeBadge = badges.find((b) => b.value === previewValue);
    for (const pos of sideBadgePositions) {
      if (activeBadge?.image) {
        const badgeImg = await loadImg(activeBadge.image.dataUrl);
        ctx.drawImage(badgeImg, pos.x - pos.size / 2, pos.y - pos.size / 2, pos.size, pos.size);
      } else {
        // Placeholder circle
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pos.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(pos.size * 0.3)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${previewValue}h`, pos.x, pos.y);
        ctx.restore();
      }
    }

    // 4. Fields
    const sideFields = fields.filter((f) => f.side === side);
    for (const field of sideFields) {
      if (field.fieldType === 'portrait') {
        // Ellipse placeholder
        const rx = field.radiusX || 100;
        const ry = field.radiusY || 115;
        ctx.save();
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.ellipse(field.x, field.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#D4AF37';
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        ctx.fillStyle = '#D4AF37';
        ctx.font = `${Math.round(rx * 0.25)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Profilbild', field.x, field.y);
        ctx.restore();
      } else {
        const text = EXAMPLE_VALUES[field.fieldType] || field.fieldType;
        ctx.save();
        ctx.fillStyle = field.color || '#D4AF37';
        ctx.font = `${field.fontWeight === 'bold' ? 'bold ' : ''}${field.fontSize}px ${field.fontFamily || 'Georgia, serif'}`;
        ctx.textAlign = field.align || 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, field.x, field.y, field.maxWidth || undefined);
        ctx.restore();
      }
    }
  }, [frontImage, backImage, layers, badgePositions, badges, previewValue, fields]);

  // Re-render when data changes
  useEffect(() => {
    renderPreview('front');
    renderPreview('back');
  }, [renderPreview]);

  const runValidation = useCallback(() => {
    setIsValidating(true);
    const checks: ValidationCheck[] = [];

    // 1. Metadata
    checks.push({
      id: 'name',
      label: 'Template-Name',
      status: templateName.trim().length > 0 ? 'pass' : 'fail',
      message: templateName.trim().length > 0 ? templateName : 'Kein Name angegeben',
    });
    checks.push({
      id: 'designer',
      label: 'Designer-Name',
      status: designerName.trim().length > 0 ? 'pass' : 'warn',
      message: designerName.trim().length > 0 ? designerName : 'Kein Designer angegeben',
    });

    // 2. Reference designs
    checks.push({
      id: 'ref-front',
      label: 'Referenz-Design Vorderseite',
      status: referenceFront ? 'pass' : 'warn',
      message: referenceFront ? `${referenceFront.width}×${referenceFront.height}` : 'Nicht vorhanden',
    });
    checks.push({
      id: 'ref-back',
      label: 'Referenz-Design Rückseite',
      status: referenceBack ? 'pass' : 'warn',
      message: referenceBack ? `${referenceBack.width}×${referenceBack.height}` : 'Nicht vorhanden',
    });

    // 3. Resolution
    if (referenceFront) {
      checks.push({
        id: 'resolution',
        label: 'Mindestauflösung (1622px)',
        status: referenceFront.width >= 1622 ? 'pass' : 'warn',
        message: `${referenceFront.width}px breit${referenceFront.width < 1622 ? ' — unter 300 DPI' : ''}`,
      });
    }

    // 4. Required layers
    const requiredLayers = layers.filter((l) => l.required);
    for (const layer of requiredLayers) {
      checks.push({
        id: `layer-${layer.id}`,
        label: `Pflicht-Layer: ${layer.label}`,
        status: layer.image ? 'pass' : 'fail',
        message: layer.image ? `${layer.image.width}×${layer.image.height}` : 'Nicht hochgeladen',
      });
    }

    // 5. Layer dimension consistency
    const uploadedLayers = layers.filter((l) => l.image);
    if (uploadedLayers.length > 1) {
      const firstDim = uploadedLayers[0].image!;
      const allMatch = uploadedLayers.every(
        (l) => l.image!.width === firstDim.width && l.image!.height === firstDim.height,
      );
      checks.push({
        id: 'layer-dims',
        label: 'Layer-Dimensionen konsistent',
        status: allMatch ? 'pass' : 'fail',
        message: allMatch
          ? `Alle ${uploadedLayers.length} Layer: ${firstDim.width}×${firstDim.height}`
          : 'Layer haben unterschiedliche Dimensionen',
      });
    }

    // 6. Fields
    checks.push({
      id: 'fields',
      label: 'Felder platziert',
      status: fields.length > 0 ? 'pass' : 'warn',
      message: `${fields.length} Feld(er) definiert`,
    });

    const hasName = fields.some((f) => f.fieldType === 'name');
    checks.push({
      id: 'field-name',
      label: 'Name-Feld vorhanden',
      status: hasName ? 'pass' : 'warn',
      message: hasName ? 'Platziert' : 'Empfohlen für personalisierte Gutscheine',
    });

    // 7. Badges
    const hasBadgeImages = badges.some((b) => b.image !== null);
    checks.push({
      id: 'badges',
      label: 'Wert-Badges',
      status: hasBadgeImages ? 'pass' : 'warn',
      message: hasBadgeImages
        ? `${badges.filter((b) => b.image).length} von ${badges.length} Badges hochgeladen`
        : 'Keine Badges hochgeladen (optional)',
    });

    // 8. Silver masks
    if (silverEnabled) {
      checks.push({
        id: 'silver-front',
        label: 'Silber-Maske Vorderseite',
        status: silverMaskFront ? 'pass' : 'fail',
        message: silverMaskFront ? `${silverMaskFront.width}×${silverMaskFront.height}` : 'Nicht vorhanden',
      });
      checks.push({
        id: 'silver-back',
        label: 'Silber-Maske Rückseite',
        status: silverMaskBack ? 'pass' : 'fail',
        message: silverMaskBack ? `${silverMaskBack.width}×${silverMaskBack.height}` : 'Nicht vorhanden',
      });
    }

    setValidationChecks(checks);
    setIsValidating(false);
  }, [
    templateName, designerName, referenceFront, referenceBack,
    layers, fields, badges, silverEnabled, silverMaskFront, silverMaskBack,
    setValidationChecks, setIsValidating,
  ]);

  // Run validation on mount
  useEffect(() => { runValidation(); }, [runValidation]);

  const errors = validationChecks.filter((c) => c.status === 'fail');
  const warnings = validationChecks.filter((c) => c.status === 'warn');
  const passes = validationChecks.filter((c) => c.status === 'pass');

  // Generate the template.json content
  const generateTemplateJson = useCallback((): TemplateV2 => {
    const w = referenceFront?.width || 1200;
    const h = referenceFront?.height || 590;

    // Build schema fields from placed fields
    const schemaFields: TemplateField[] = fields.map((f) => {
      const base = {
        id: f.fieldType,
        label: { de: f.fieldType.charAt(0).toUpperCase() + f.fieldType.slice(1) },
        required: f.fieldType === 'name',
      };

      switch (f.fieldType) {
        case 'name': return { ...base, type: 'text' as const, config: { maxLength: 50 } };
        case 'email': return { ...base, type: 'email' as const };
        case 'phone': return { ...base, type: 'tel' as const, config: { format: 'international' as const } };
        case 'description': return { ...base, type: 'textarea' as const, config: { rows: 3, maxLength: 200 } };
        case 'portrait': return { ...base, type: 'image' as const, config: { shape: f.clip || 'ellipse' as const, maxSize: 10, acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'] } };
        case 'website': return { ...base, type: 'url' as const };
        default: return { ...base, type: 'text' as const };
      }
    });

    // Build layers per side
    const buildSideLayers = (side: 'front' | 'back'): Layer[] => {
      const result: Layer[] = [];

      // Background
      const bgLayer = layers.find((l) => l.side === side && l.type === 'background');
      if (bgLayer?.image) {
        result.push({ type: 'background', source: side === 'front' ? 'front' : 'back' });
      }

      // Frame
      const frameLayer = layers.find((l) => l.side === side && l.type === 'frame');
      if (frameLayer?.image) {
        result.push({ type: 'frame', source: side === 'front' ? 'frontFrame' : 'backFrame' });
      }

      // Badges
      const sideBadgePositions = badgePositions.filter((p) => p.side === side);
      if (sideBadgePositions.length > 0 && badges.some((b) => b.image)) {
        result.push({
          type: 'badges',
          fieldId: 'hours',
          positions: sideBadgePositions.map((p) => ({
            x: p.x, y: p.y, size: p.size, anchor: 'center' as const,
          })),
        });
      }

      // Field layers
      const sideFields = fields.filter((f) => f.side === side);
      for (const f of sideFields) {
        if (f.fieldType === 'portrait') {
          result.push({
            type: 'field',
            fieldId: 'portrait',
            position: { x: f.x, y: f.y, anchor: 'center' },
            clip: f.clip || 'ellipse',
            size: { radiusX: f.radiusX || 100, radiusY: f.radiusY || 115 },
          });
        } else {
          result.push({
            type: 'field',
            fieldId: f.fieldType,
            position: { x: f.x, y: f.y, anchor: 'center' },
            style: {
              fontSize: f.fontSize,
              fontFamily: f.fontFamily,
              fontWeight: f.fontWeight,
              color: f.color,
            },
            maxWidth: f.maxWidth,
            align: f.align,
          });
        }
      }

      return result;
    };

    // Build badge assets
    const badgeAssets: BadgeAssets | undefined = badges.some((b) => b.image)
      ? {
          type: 'image',
          variants: badges.filter((b) => b.image).map((b) => ({
            value: b.value,
            image: `badges/${b.value}.png`,
            size: 80,
          })),
        }
      : undefined;

    return {
      id: templateName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'my-template',
      version: '1.0.0',
      name: templateName || 'Mein Template',
      type: 'time-voucher',
      description: '',
      designer: { name: designerName || 'Unbekannt' },
      created: new Date().toISOString(),
      status: 'development',
      assets: {
        front: `front.webp`,
        back: `back.webp`,
        ...(badgeAssets ? { badges: badgeAssets } : {}),
      },
      schema: {
        languages: ['de'],
        defaultLanguage: 'de',
        fields: schemaFields,
      },
      layout: {
        dimensions: { width: w, height: h, dpi: 300 },
        front: { layers: buildSideLayers('front') },
        back: { layers: buildSideLayers('back') },
        global: {
          hueShift: { enabled: false },
          fontFamily: 'Georgia, Times New Roman, serif',
          textColor: '#D4AF37',
        },
      },
      features: {
        hueShift: false,
        portraitEditing: fields.some((f) => f.fieldType === 'portrait')
          ? { backgroundRemoval: true, engraving: true, zoom: true, pan: true }
          : undefined,
        signature: false,
      },
      shop: {
        pricing: { basePriceMultiplier: 1.0 },
        tags: [],
        featured: false,
      },
    };
  }, [templateName, designerName, referenceFront, layers, fields, badges, badgePositions]);

  const handleDownloadJson = () => {
    const json = generateTemplateJson();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Determine preview dimensions for aspect ratio
  const previewImg = previewSide === 'front' ? frontImage : backImage;

  return (
    <div className="space-y-4">
      {/* Voucher Preview */}
      <WizardCard
        title="Gutschein-Vorschau"
        description="So sieht der fertige Gutschein mit Beispieldaten aus. Alle Layer, Felder und Badges werden zusammen angezeigt."
      >
        <div className="flex gap-2 items-center flex-wrap mb-3">
          <div className="join">
            <button
              className={`btn btn-sm join-item ${previewSide === 'front' ? 'btn-primary' : ''}`}
              onClick={() => setPreviewSide('front')}
            >
              Vorderseite
            </button>
            <button
              className={`btn btn-sm join-item ${previewSide === 'back' ? 'btn-primary' : ''}`}
              onClick={() => setPreviewSide('back')}
            >
              Ruckseite
            </button>
          </div>
          <div className="join">
            {badges.map((b) => (
              <button
                key={b.value}
                className={`btn btn-xs join-item ${previewValue === b.value ? 'btn-secondary' : ''}`}
                onClick={() => setPreviewValue(b.value)}
              >
                {b.value}h
              </button>
            ))}
          </div>
        </div>

        {previewImg ? (
          <div className="border border-base-300 rounded-lg overflow-hidden bg-base-200">
            <canvas
              ref={frontCanvasRef}
              className="w-full h-auto"
              style={{ display: previewSide === 'front' ? 'block' : 'none' }}
            />
            <canvas
              ref={backCanvasRef}
              className="w-full h-auto"
              style={{ display: previewSide === 'back' ? 'block' : 'none' }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed border-base-300">
            <p className="text-base-content/40 text-sm">
              Kein Hintergrund-Layer vorhanden — lade zuerst Layer in Schritt 2 hoch
            </p>
          </div>
        )}
      </WizardCard>

      <WizardCard
        title="Qualitätsprüfung"
        description="Automatische Überprüfung deines Template-Pakets."
      >
        <button
          className="btn btn-sm btn-primary mb-3"
          onClick={runValidation}
          disabled={isValidating}
        >
          {isValidating ? <span className="loading loading-spinner loading-xs" /> : null}
          Erneut prüfen
        </button>

        <div className="space-y-1">
          {validationChecks.map((check) => (
            <div key={check.id} className="flex items-center gap-2 text-sm">
              <span className={`text-lg ${
                check.status === 'pass' ? 'text-success' :
                check.status === 'warn' ? 'text-warning' :
                check.status === 'fail' ? 'text-error' : 'text-base-content/30'
              }`}>
                {check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : check.status === 'fail' ? '✗' : '○'}
              </span>
              <span className="flex-1">{check.label}</span>
              {check.message && (
                <span className="text-xs text-base-content/50">{check.message}</span>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 p-3 rounded-lg bg-base-200">
          {errors.length === 0 ? (
            <p className="text-success font-medium">
              Keine Fehler gefunden! {warnings.length > 0 ? `(${warnings.length} Hinweise)` : ''}
            </p>
          ) : (
            <p className="text-error font-medium">
              {errors.length} Fehler, {warnings.length} Hinweise — bitte korrigieren
            </p>
          )}
          <p className="text-xs text-base-content/50 mt-1">{passes.length} von {validationChecks.length} Checks bestanden</p>
        </div>
      </WizardCard>

      {/* Export */}
      <WizardCard
        title="Template exportieren"
        description="Lade das generierte template.json herunter. Zusammen mit deinen Layer-Dateien und Badges bildet es das Template-Paket."
      >
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary btn-sm" onClick={handleDownloadJson}>
            template.json herunterladen
          </button>
        </div>

        <details className="mt-3">
          <summary className="text-xs text-base-content/60 cursor-pointer">template.json Vorschau</summary>
          <pre className="mt-2 text-xs bg-base-200 rounded-lg p-3 overflow-x-auto max-h-64 overflow-y-auto">
            {JSON.stringify(generateTemplateJson(), null, 2)}
          </pre>
        </details>
      </WizardCard>
    </div>
  );
}
