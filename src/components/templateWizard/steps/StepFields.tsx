import { useState, useRef, useCallback, useEffect } from 'react';
import { useTemplateWizardStore, type PlacedField } from '../../../stores/templateWizardStore';
import { WizardCard } from '../shared/WizardCard';

// Available field presets
const FIELD_PRESETS: Omit<PlacedField, 'id' | 'x' | 'y'>[] = [
  { fieldType: 'name', side: 'back', maxWidth: 350, fontSize: 28, fontFamily: 'Georgia, serif', fontWeight: 'bold', color: '#D4AF37', align: 'center' },
  { fieldType: 'email', side: 'back', maxWidth: 350, fontSize: 16, fontFamily: 'Georgia, serif', fontWeight: 'normal', color: '#C4A467', align: 'center' },
  { fieldType: 'phone', side: 'back', maxWidth: 350, fontSize: 16, fontFamily: 'Georgia, serif', fontWeight: 'normal', color: '#C4A467', align: 'center' },
  { fieldType: 'description', side: 'back', maxWidth: 350, fontSize: 14, fontFamily: 'Georgia, serif', fontWeight: 'normal', color: '#C4A467', align: 'center' },
  { fieldType: 'portrait', side: 'front', maxWidth: 200, fontSize: 0, fontFamily: '', fontWeight: 'normal', color: '', align: 'center', clip: 'ellipse', radiusX: 100, radiusY: 115 },
  { fieldType: 'website', side: 'back', maxWidth: 350, fontSize: 14, fontFamily: 'Georgia, serif', fontWeight: 'normal', color: '#C4A467', align: 'center' },
];

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  email: 'E-Mail',
  phone: 'Telefon',
  description: 'Beschreibung',
  portrait: 'Profilbild',
  website: 'Webseite',
};

const EXAMPLE_VALUES: Record<string, string> = {
  name: 'Max Mustermann',
  email: 'max@beispiel.de',
  phone: '+49 123 456789',
  description: 'Beschreibungstext hier...',
  portrait: '[Bild]',
  website: 'www.beispiel.de',
};

/**
 * Step 3: Place fields on the design canvas via click-to-place.
 */
export function StepFields() {
  const fields = useTemplateWizardStore((s) => s.fields);
  const selectedFieldId = useTemplateWizardStore((s) => s.selectedFieldId);
  const referenceFront = useTemplateWizardStore((s) => s.referenceFront);
  const referenceBack = useTemplateWizardStore((s) => s.referenceBack);
  const layers = useTemplateWizardStore((s) => s.layers);
  const addField = useTemplateWizardStore((s) => s.addField);
  const updateField = useTemplateWizardStore((s) => s.updateField);
  const removeField = useTemplateWizardStore((s) => s.removeField);
  const setSelectedField = useTemplateWizardStore((s) => s.setSelectedField);

  const [activeSide, setActiveSide] = useState<'front' | 'back'>('back');
  const [placingField, setPlacingField] = useState<string | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Track container width for proportional font sizing
  useEffect(() => {
    if (!canvasRef.current) return;
    const obs = new ResizeObserver(([entry]) => setCanvasWidth(entry.contentRect.width));
    obs.observe(canvasRef.current);
    return () => obs.disconnect();
  }, []);

  // Prefer cleaned background layer from Step 2, fallback to reference image
  const frontBg = layers.find((l) => l.id === 'front-background')?.image;
  const backBg = layers.find((l) => l.id === 'back-background')?.image;
  const currentImage = activeSide === 'front'
    ? (frontBg || referenceFront)
    : (backBg || referenceBack);
  const sideFields = fields.filter((f) => f.side === activeSide);
  const selectedField = fields.find((f) => f.id === selectedFieldId);

  // Usable field types (each can only be placed once)
  const usedFieldTypes = new Set(fields.map((f) => f.fieldType));
  const availablePresets = FIELD_PRESETS.filter((p) => !usedFieldTypes.has(p.fieldType));

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!placingField || !canvasRef.current || !currentImage) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = currentImage.width / rect.width;
      const scaleY = currentImage.height / rect.height;
      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);

      const preset = FIELD_PRESETS.find((p) => p.fieldType === placingField);
      if (!preset) return;

      const id = `${preset.fieldType}-${Date.now()}`;
      addField({ ...preset, id, x, y, side: activeSide });
      setSelectedField(id);
      setPlacingField(null);
    },
    [placingField, currentImage, activeSide, addField, setSelectedField],
  );

  // Drag state for moving placed fields
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleFieldMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    setSelectedField(fieldId);
    setDragging(fieldId);

    if (!canvasRef.current || !currentImage) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = currentImage.width / rect.width;
    const scaleY = currentImage.height / rect.height;
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    dragOffset.current = {
      x: (e.clientX - rect.left) * scaleX - field.x,
      y: (e.clientY - rect.top) * scaleY - field.y,
    };
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      if (!canvasRef.current || !currentImage) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = currentImage.width / rect.width;
      const scaleY = currentImage.height / rect.height;
      const x = Math.round((e.clientX - rect.left) * scaleX - dragOffset.current.x);
      const y = Math.round((e.clientY - rect.top) * scaleY - dragOffset.current.y);
      updateField(dragging, {
        x: Math.max(0, Math.min(currentImage.width, x)),
        y: Math.max(0, Math.min(currentImage.height, y)),
      });
    };

    const handleUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, currentImage, updateField]);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left: Field list + properties */}
      <div className="lg:w-72 shrink-0 space-y-3">
        <WizardCard
          title="Felder hinzufügen"
          description="Wähle ein Feld und klicke auf das Design, um es zu platzieren."
        >
          <div className="flex flex-wrap gap-1.5">
            {availablePresets.map((preset) => (
              <button
                key={preset.fieldType}
                className={`btn btn-xs ${placingField === preset.fieldType ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setPlacingField(placingField === preset.fieldType ? null : preset.fieldType)}
              >
                + {FIELD_LABELS[preset.fieldType]}
              </button>
            ))}
            {availablePresets.length === 0 && (
              <p className="text-xs text-base-content/50">Alle Felder platziert</p>
            )}
          </div>
        </WizardCard>

        {/* Placed fields list */}
        <WizardCard title={`Platzierte Felder (${fields.length})`}>
          {fields.length === 0 ? (
            <p className="text-xs text-base-content/50">Noch keine Felder platziert</p>
          ) : (
            <div className="space-y-1">
              {fields.map((f) => (
                <div
                  key={f.id}
                  className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                    f.id === selectedFieldId ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-base-200'
                  }`}
                  onClick={() => { setSelectedField(f.id); setActiveSide(f.side); }}
                >
                  <span>
                    {FIELD_LABELS[f.fieldType]} <span className="text-base-content/40">({f.side})</span>
                  </span>
                  <button
                    className="btn btn-ghost btn-xs text-error px-1"
                    onClick={(e) => { e.stopPropagation(); removeField(f.id); }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </WizardCard>

        {/* Selected field properties */}
        {selectedField && selectedField.fieldType !== 'portrait' && (
          <WizardCard title={`${FIELD_LABELS[selectedField.fieldType]} — Eigenschaften`}>
            <div className="space-y-2">
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs">Schriftgröße</span></label>
                <input
                  type="range"
                  className="range range-xs range-primary"
                  min={10}
                  max={72}
                  value={selectedField.fontSize}
                  onChange={(e) => updateField(selectedField.id, { fontSize: Number(e.target.value) })}
                />
                <span className="text-xs text-base-content/50 text-right">{selectedField.fontSize}px</span>
              </div>
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs">Farbe</span></label>
                <input
                  type="color"
                  className="w-8 h-6 rounded cursor-pointer"
                  value={selectedField.color}
                  onChange={(e) => updateField(selectedField.id, { color: e.target.value })}
                />
              </div>
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs">Schrift</span></label>
                <select
                  className="select select-bordered select-xs w-full"
                  value={selectedField.fontWeight}
                  onChange={(e) => updateField(selectedField.id, { fontWeight: e.target.value as 'normal' | 'bold' })}
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Fett</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs">Ausrichtung</span></label>
                <div className="join w-full">
                  {(['left', 'center', 'right'] as const).map((a) => (
                    <button
                      key={a}
                      className={`btn btn-xs join-item flex-1 ${selectedField.align === a ? 'btn-primary' : ''}`}
                      onClick={() => updateField(selectedField.id, { align: a })}
                    >
                      {a === 'left' ? '←' : a === 'right' ? '→' : '↔'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs">Max. Breite</span></label>
                <input
                  type="number"
                  className="input input-bordered input-xs w-full"
                  value={selectedField.maxWidth}
                  onChange={(e) => updateField(selectedField.id, { maxWidth: Number(e.target.value) })}
                />
              </div>
              <div className="text-xs text-base-content/40 mt-1">
                Position: {selectedField.x}, {selectedField.y}
              </div>
            </div>
          </WizardCard>
        )}

        {selectedField && selectedField.fieldType === 'portrait' && (
          <WizardCard title="Profilbild — Eigenschaften">
            <div className="space-y-2">
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs">Form</span></label>
                <select
                  className="select select-bordered select-xs w-full"
                  value={selectedField.clip || 'ellipse'}
                  onChange={(e) => updateField(selectedField.id, { clip: e.target.value as 'ellipse' | 'circle' | 'rectangle' })}
                >
                  <option value="ellipse">Ellipse</option>
                  <option value="circle">Kreis</option>
                  <option value="rectangle">Rechteck</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs">Radius X</span></label>
                <input
                  type="number"
                  className="input input-bordered input-xs w-full"
                  value={selectedField.radiusX || 100}
                  onChange={(e) => updateField(selectedField.id, { radiusX: Number(e.target.value) })}
                />
              </div>
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs">Radius Y</span></label>
                <input
                  type="number"
                  className="input input-bordered input-xs w-full"
                  value={selectedField.radiusY || 115}
                  onChange={(e) => updateField(selectedField.id, { radiusY: Number(e.target.value) })}
                />
              </div>
              <div className="text-xs text-base-content/40 mt-1">
                Position: {selectedField.x}, {selectedField.y}
              </div>
            </div>
          </WizardCard>
        )}
      </div>

      {/* Right: Canvas preview */}
      <div className="flex-1 space-y-2">
        <div className="flex gap-2 items-center">
          <div className="join">
            <button
              className={`btn btn-sm join-item ${activeSide === 'front' ? 'btn-primary' : ''}`}
              onClick={() => setActiveSide('front')}
            >
              Vorderseite
            </button>
            <button
              className={`btn btn-sm join-item ${activeSide === 'back' ? 'btn-primary' : ''}`}
              onClick={() => setActiveSide('back')}
            >
              Rückseite
            </button>
          </div>
          {placingField && (
            <span className="text-sm text-primary animate-pulse">
              Klicke auf das Design um &quot;{FIELD_LABELS[placingField]}&quot; zu platzieren
            </span>
          )}
        </div>

        {currentImage ? (
          <div
            ref={canvasRef}
            className={`relative border border-base-300 rounded-lg overflow-hidden select-none ${
              placingField ? 'cursor-crosshair' : ''
            }`}
            style={{ aspectRatio: `${currentImage.width}/${currentImage.height}` }}
            onClick={handleCanvasClick}
          >
            <img
              src={currentImage.dataUrl}
              alt={activeSide}
              className="w-full h-full object-contain"
              draggable={false}
            />

            {/* Field overlays */}
            {sideFields.map((f) => {
              const scaleX = 100 / currentImage.width;
              const scaleY = 100 / currentImage.height;
              const left = f.x * scaleX;
              const top = f.y * scaleY;

              return (
                <div
                  key={f.id}
                  className={`absolute flex items-center justify-center pointer-events-auto cursor-move transition-shadow ${
                    f.id === selectedFieldId ? 'ring-2 ring-primary shadow-lg' : 'ring-1 ring-white/40'
                  }`}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    transform: 'translate(-50%, -50%)',
                    minWidth: '60px',
                    padding: f.fieldType === 'portrait' ? '0' : '2px 8px',
                    backgroundColor: f.fieldType === 'portrait' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.5)',
                    borderRadius: f.fieldType === 'portrait' && f.clip === 'ellipse' ? '50%' : '4px',
                    width: f.fieldType === 'portrait' ? `${(f.radiusX || 100) * 2 * scaleX}%` : undefined,
                    height: f.fieldType === 'portrait' ? `${(f.radiusY || 115) * 2 * scaleY}%` : undefined,
                  }}
                  onMouseDown={(e) => handleFieldMouseDown(e, f.id)}
                >
                  <span
                    className="whitespace-nowrap"
                    style={{
                      color: f.fieldType === 'portrait' ? '#fff' : f.color,
                      fontWeight: f.fontWeight,
                      fontFamily: f.fontFamily || 'Georgia, serif',
                      fontSize: canvasWidth > 0 ? `${f.fontSize * (canvasWidth / currentImage.width)}px` : '10px',
                    }}
                  >
                    {EXAMPLE_VALUES[f.fieldType]}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 rounded-lg border-2 border-dashed border-base-300">
            <p className="text-base-content/40 text-sm">
              Lade zuerst ein Referenz-Design hoch (Schritt 1)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
