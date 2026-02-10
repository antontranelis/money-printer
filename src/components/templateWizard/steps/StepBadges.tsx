import { useState, useRef, useEffect, useCallback } from 'react';
import { useTemplateWizardStore } from '../../../stores/templateWizardStore';
import { WizardCard } from '../shared/WizardCard';
import { ImageDropZone } from '../shared/ImageDropZone';

/**
 * Step 4: Upload badge images and place them via drag & drop on the design.
 */
export function StepBadges() {
  const badges = useTemplateWizardStore((s) => s.badges);
  const badgePositions = useTemplateWizardStore((s) => s.badgePositions);
  const layers = useTemplateWizardStore((s) => s.layers);
  const referenceFront = useTemplateWizardStore((s) => s.referenceFront);
  const referenceBack = useTemplateWizardStore((s) => s.referenceBack);
  const setBadgeImage = useTemplateWizardStore((s) => s.setBadgeImage);
  const updateBadgePosition = useTemplateWizardStore((s) => s.updateBadgePosition);
  const addBadgePosition = useTemplateWizardStore((s) => s.addBadgePosition);
  const removeBadgePosition = useTemplateWizardStore((s) => s.removeBadgePosition);

  const [previewValue, setPreviewValue] = useState(1);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Prefer cleaned background layer, fallback to reference
  const frontBg = layers.find((l) => l.id === 'front-background')?.image;
  const backBg = layers.find((l) => l.id === 'back-background')?.image;
  const currentImage = previewSide === 'front'
    ? (frontBg || referenceFront)
    : (backBg || referenceBack);

  const sidePositions = badgePositions
    .map((p, i) => ({ ...p, index: i }))
    .filter((p) => p.side === previewSide);

  const activeBadge = badges.find((b) => b.value === previewValue);

  // --- Drag & Resize ---
  const [dragging, setDragging] = useState<number | null>(null);
  const [resizing, setResizing] = useState<number | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ mouseX: 0, initialSize: 0 });
  const justFinishedDrag = useRef(false);

  const getScale = useCallback(() => {
    if (!canvasRef.current || !currentImage) return { x: 1, y: 1 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: currentImage.width / rect.width,
      y: currentImage.height / rect.height,
    };
  }, [currentImage]);

  const handleBadgeMouseDown = (e: React.MouseEvent, posIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedIndex(posIndex);
    setDragging(posIndex);

    const scale = getScale();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = badgePositions[posIndex];

    dragOffset.current = {
      x: (e.clientX - rect.left) * scale.x - pos.x,
      y: (e.clientY - rect.top) * scale.y - pos.y,
    };
  };

  const handleResizeMouseDown = (e: React.MouseEvent, posIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedIndex(posIndex);
    setResizing(posIndex);
    resizeStart.current = {
      mouseX: e.clientX,
      initialSize: badgePositions[posIndex].size,
    };
  };

  // Click on canvas to add new badge position
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      // Ignore click that follows a drag/resize (mouseup fires before click)
      if (justFinishedDrag.current) {
        justFinishedDrag.current = false;
        return;
      }
      if (dragging !== null || resizing !== null) return;
      if (!canvasRef.current || !currentImage) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const scale = getScale();
      const x = Math.round((e.clientX - rect.left) * scale.x);
      const y = Math.round((e.clientY - rect.top) * scale.y);

      addBadgePosition({ side: previewSide, x, y, size: 80 });
      setSelectedIndex(badgePositions.length);
    },
    [dragging, resizing, currentImage, previewSide, addBadgePosition, badgePositions.length, getScale],
  );

  useEffect(() => {
    if (dragging === null && resizing === null) return;

    const handleMove = (e: MouseEvent) => {
      if (dragging !== null) {
        if (!canvasRef.current || !currentImage) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const scale = getScale();
        const x = Math.round((e.clientX - rect.left) * scale.x - dragOffset.current.x);
        const y = Math.round((e.clientY - rect.top) * scale.y - dragOffset.current.y);
        updateBadgePosition(dragging, {
          x: Math.max(0, Math.min(currentImage.width, x)),
          y: Math.max(0, Math.min(currentImage.height, y)),
        });
      }
      if (resizing !== null) {
        const dx = e.clientX - resizeStart.current.mouseX;
        const scale = getScale();
        const newSize = Math.max(30, Math.round(resizeStart.current.initialSize + dx * scale.x));
        updateBadgePosition(resizing, { size: newSize });
      }
    };

    const handleUp = () => {
      justFinishedDrag.current = true;
      setDragging(null);
      setResizing(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, resizing, currentImage, updateBadgePosition, getScale]);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left: Badge uploads + controls */}
      <div className="lg:w-72 shrink-0 space-y-3">
        <WizardCard
          title="Wert-Badges"
          description="Lade Badge-Grafiken hoch (PNG mit Transparenz, quadratisch)."
          tip="Badges sollten quadratisch sein (z.B. 320x320 px) und im Stil deines Designs gestaltet."
        >
          <div className="grid grid-cols-3 gap-3">
            {badges.map((badge) => (
              <div key={badge.value} className="text-center">
                <label className="label justify-center py-0">
                  <span className="label-text text-xs font-medium">{badge.label}</span>
                </label>
                <ImageDropZone
                  label={`${badge.value}h`}
                  image={badge.image}
                  onImageSet={(img) => setBadgeImage(badge.value, img)}
                  compact
                />
              </div>
            ))}
          </div>
        </WizardCard>

        {/* Positions list */}
        <WizardCard title={`Positionen (${sidePositions.length})`}>
          <p className="text-xs text-base-content/50 mb-2">
            Klicke auf das Design um eine neue Position zu setzen. Ziehe Badges zum Verschieben.
          </p>
          {sidePositions.length === 0 ? (
            <p className="text-xs text-base-content/40">Keine Positionen auf dieser Seite</p>
          ) : (
            <div className="space-y-1">
              {sidePositions.map((pos, localIdx) => (
                <div
                  key={pos.index}
                  className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                    pos.index === selectedIndex ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-base-200'
                  }`}
                  onClick={() => setSelectedIndex(pos.index)}
                >
                  <span>
                    #{localIdx + 1} — {pos.x}, {pos.y} ({pos.size}px)
                  </span>
                  <button
                    className="btn btn-ghost btn-xs text-error px-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBadgePosition(pos.index);
                      if (selectedIndex === pos.index) setSelectedIndex(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </WizardCard>

        {/* Selected position properties */}
        {selectedIndex !== null && badgePositions[selectedIndex] && (
          <WizardCard title={`Position #${sidePositions.findIndex((p) => p.index === selectedIndex) + 1}`}>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="form-control flex-1">
                  <label className="label py-0"><span className="label-text text-xs">X</span></label>
                  <input
                    type="number"
                    className="input input-bordered input-xs w-full"
                    value={badgePositions[selectedIndex].x}
                    onChange={(e) => updateBadgePosition(selectedIndex, { x: Number(e.target.value) })}
                  />
                </div>
                <div className="form-control flex-1">
                  <label className="label py-0"><span className="label-text text-xs">Y</span></label>
                  <input
                    type="number"
                    className="input input-bordered input-xs w-full"
                    value={badgePositions[selectedIndex].y}
                    onChange={(e) => updateBadgePosition(selectedIndex, { y: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="form-control">
                <label className="label py-0"><span className="label-text text-xs">Groesse</span></label>
                <input
                  type="range"
                  className="range range-xs range-primary"
                  min={20}
                  max={300}
                  value={badgePositions[selectedIndex].size}
                  onChange={(e) => updateBadgePosition(selectedIndex, { size: Number(e.target.value) })}
                />
                <span className="text-xs text-base-content/50 text-right">{badgePositions[selectedIndex].size}px</span>
              </div>
            </div>
          </WizardCard>
        )}
      </div>

      {/* Right: Canvas preview */}
      <div className="flex-1 space-y-2">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="join">
            <button
              className={`btn btn-sm join-item ${previewSide === 'front' ? 'btn-primary' : ''}`}
              onClick={() => { setPreviewSide('front'); setSelectedIndex(null); }}
            >
              Vorderseite
            </button>
            <button
              className={`btn btn-sm join-item ${previewSide === 'back' ? 'btn-primary' : ''}`}
              onClick={() => { setPreviewSide('back'); setSelectedIndex(null); }}
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

        {currentImage ? (
          <div
            ref={canvasRef}
            className="relative border border-base-300 rounded-lg overflow-hidden select-none cursor-crosshair"
            style={{ aspectRatio: `${currentImage.width}/${currentImage.height}` }}
            onClick={handleCanvasClick}
          >
            <img
              src={currentImage.dataUrl}
              alt={previewSide}
              className="w-full h-full object-contain"
              draggable={false}
            />

            {/* Badge overlays */}
            {sidePositions.map((pos) => {
              const leftPct = (pos.x / currentImage.width) * 100;
              const topPct = (pos.y / currentImage.height) * 100;
              const sizePct = (pos.size / currentImage.width) * 100;
              const sizeYPct = (pos.size / currentImage.height) * 100;
              const isSelected = pos.index === selectedIndex;

              return (
                <div
                  key={pos.index}
                  className={`absolute flex items-center justify-center cursor-move transition-shadow ${
                    isSelected ? 'ring-2 ring-primary shadow-lg' : 'ring-1 ring-white/40'
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${sizePct}%`,
                    height: `${sizeYPct}%`,
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    borderRadius: '4px',
                  }}
                  onMouseDown={(e) => handleBadgeMouseDown(e, pos.index)}
                >
                  {activeBadge?.image ? (
                    <img
                      src={activeBadge.image.dataUrl}
                      alt=""
                      className="w-full h-full object-contain pointer-events-none"
                      draggable={false}
                    />
                  ) : (
                    <span className="text-white text-xs font-bold pointer-events-none">
                      {previewValue}h
                    </span>
                  )}

                  {/* Resize handle */}
                  {isSelected && (
                    <div
                      className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-tl cursor-se-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, pos.index)}
                    />
                  )}
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
