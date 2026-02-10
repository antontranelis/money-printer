import { create } from 'zustand';

// =============================================================================
// Types
// =============================================================================

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface UploadedImage {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
}

export interface LayerEntry {
  id: string;
  label: string;
  type: 'background' | 'frame' | 'profileArea' | 'valueArea' | 'qrArea' | 'infoArea' | 'custom';
  side: 'front' | 'back';
  image: UploadedImage | null;
  required: boolean;
}

export interface PlacedField {
  id: string;
  fieldType: 'name' | 'email' | 'phone' | 'description' | 'portrait' | 'website';
  side: 'front' | 'back';
  x: number;
  y: number;
  maxWidth: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  color: string;
  align: 'left' | 'center' | 'right';
  /** Only for portrait */
  clip?: 'ellipse' | 'circle' | 'rectangle';
  radiusX?: number;
  radiusY?: number;
}

export interface BadgeEntry {
  value: number;
  label: string;
  image: UploadedImage | null;
}

export interface BadgePosition {
  side: 'front' | 'back';
  x: number;
  y: number;
  size: number;
}

export interface ValidationCheck {
  id: string;
  label: string;
  status: 'pending' | 'pass' | 'warn' | 'fail';
  message?: string;
}

// =============================================================================
// Store State
// =============================================================================

interface TemplateWizardState {
  // Navigation
  currentStep: WizardStep;
  maxVisitedStep: WizardStep;

  // Step 1: Design
  templateName: string;
  designerName: string;
  referenceFront: UploadedImage | null;
  referenceBack: UploadedImage | null;
  /** Original combined image (front+back before splitting) for AI processing */
  referenceOriginal: string | null;

  // Step 2: Layers
  layers: LayerEntry[];

  // Step 3: Fields
  fields: PlacedField[];
  selectedFieldId: string | null;

  // Step 4: Badges
  badges: BadgeEntry[];
  badgePositions: BadgePosition[];

  // Step 5: Silver
  silverEnabled: boolean;
  silverMaskFront: UploadedImage | null;
  silverMaskBack: UploadedImage | null;

  // Step 6: Validation
  validationChecks: ValidationCheck[];
  isValidating: boolean;
}

interface TemplateWizardActions {
  // Navigation
  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Step 1
  setTemplateName: (name: string) => void;
  setDesignerName: (name: string) => void;
  setReferenceFront: (img: UploadedImage | null) => void;
  setReferenceBack: (img: UploadedImage | null) => void;
  setReferenceOriginal: (base64: string | null) => void;

  // Step 2
  setLayerImage: (layerId: string, img: UploadedImage | null) => void;

  // Step 3
  addField: (field: PlacedField) => void;
  updateField: (id: string, updates: Partial<PlacedField>) => void;
  removeField: (id: string) => void;
  setSelectedField: (id: string | null) => void;

  // Step 4
  setBadgeImage: (value: number, img: UploadedImage | null) => void;
  addBadgePosition: (pos: BadgePosition) => void;
  updateBadgePosition: (index: number, pos: Partial<BadgePosition>) => void;
  removeBadgePosition: (index: number) => void;

  // Step 5
  setSilverEnabled: (enabled: boolean) => void;
  setSilverMaskFront: (img: UploadedImage | null) => void;
  setSilverMaskBack: (img: UploadedImage | null) => void;

  // Step 6
  setValidationChecks: (checks: ValidationCheck[]) => void;
  setIsValidating: (v: boolean) => void;

  // Reset
  resetWizard: () => void;
}

// =============================================================================
// Default Layers
// =============================================================================

const DEFAULT_LAYERS: LayerEntry[] = [
  { id: 'front-background', label: 'Hintergrund (Vorne)', type: 'background', side: 'front', image: null, required: true },
  { id: 'front-frame', label: 'Rahmen (Vorne)', type: 'frame', side: 'front', image: null, required: false },
  { id: 'front-profileArea', label: 'Profil-Bereich (Vorne)', type: 'profileArea', side: 'front', image: null, required: false },
  { id: 'front-valueArea', label: 'Wert-Bereich (Vorne)', type: 'valueArea', side: 'front', image: null, required: false },
  { id: 'back-background', label: 'Hintergrund (Hinten)', type: 'background', side: 'back', image: null, required: true },
  { id: 'back-frame', label: 'Rahmen (Hinten)', type: 'frame', side: 'back', image: null, required: false },
  { id: 'back-qrArea', label: 'QR-Bereich (Hinten)', type: 'qrArea', side: 'back', image: null, required: false },
  { id: 'back-infoArea', label: 'Info-Bereich (Hinten)', type: 'infoArea', side: 'back', image: null, required: false },
];

const DEFAULT_BADGES: BadgeEntry[] = [
  { value: 1, label: '1 Stunde', image: null },
  { value: 5, label: '5 Stunden', image: null },
  { value: 10, label: '10 Stunden', image: null },
];

const DEFAULT_BADGE_POSITIONS: BadgePosition[] = [
  { side: 'front', x: 68, y: 62, size: 80 },
  { side: 'front', x: 1132, y: 62, size: 80 },
  { side: 'front', x: 68, y: 528, size: 80 },
  { side: 'front', x: 1132, y: 528, size: 80 },
  { side: 'back', x: 68, y: 62, size: 80 },
  { side: 'back', x: 1132, y: 62, size: 80 },
  { side: 'back', x: 68, y: 528, size: 80 },
  { side: 'back', x: 1132, y: 528, size: 80 },
];

// =============================================================================
// Initial State
// =============================================================================

const initialState: TemplateWizardState = {
  currentStep: 1,
  maxVisitedStep: 1,
  templateName: '',
  designerName: '',
  referenceFront: null,
  referenceBack: null,
  referenceOriginal: null,
  layers: DEFAULT_LAYERS,
  fields: [],
  selectedFieldId: null,
  badges: DEFAULT_BADGES,
  badgePositions: DEFAULT_BADGE_POSITIONS,
  silverEnabled: false,
  silverMaskFront: null,
  silverMaskBack: null,
  validationChecks: [],
  isValidating: false,
};

// =============================================================================
// Store
// =============================================================================

export const useTemplateWizardStore = create<TemplateWizardState & TemplateWizardActions>()(
  (set) => ({
    ...initialState,

    setStep: (step) =>
      set((s) => ({
        currentStep: step,
        maxVisitedStep: Math.max(s.maxVisitedStep, step) as WizardStep,
      })),

    nextStep: () =>
      set((s) => {
        const next = Math.min(s.currentStep + 1, 6) as WizardStep;
        return { currentStep: next, maxVisitedStep: Math.max(s.maxVisitedStep, next) as WizardStep };
      }),

    prevStep: () =>
      set((s) => ({
        currentStep: Math.max(s.currentStep - 1, 1) as WizardStep,
      })),

    setTemplateName: (name) => set({ templateName: name }),
    setDesignerName: (name) => set({ designerName: name }),
    setReferenceFront: (img) => set({ referenceFront: img }),
    setReferenceBack: (img) => set({ referenceBack: img }),
    setReferenceOriginal: (base64) => set({ referenceOriginal: base64 }),

    setLayerImage: (layerId, img) =>
      set((s) => ({
        layers: s.layers.map((l) => (l.id === layerId ? { ...l, image: img } : l)),
      })),

    addField: (field) => set((s) => ({ fields: [...s.fields, field] })),
    updateField: (id, updates) =>
      set((s) => ({
        fields: s.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      })),
    removeField: (id) =>
      set((s) => ({
        fields: s.fields.filter((f) => f.id !== id),
        selectedFieldId: s.selectedFieldId === id ? null : s.selectedFieldId,
      })),
    setSelectedField: (id) => set({ selectedFieldId: id }),

    setBadgeImage: (value, img) =>
      set((s) => ({
        badges: s.badges.map((b) => (b.value === value ? { ...b, image: img } : b)),
      })),
    addBadgePosition: (pos) => set((s) => ({ badgePositions: [...s.badgePositions, pos] })),
    updateBadgePosition: (index, pos) =>
      set((s) => ({
        badgePositions: s.badgePositions.map((p, i) => (i === index ? { ...p, ...pos } : p)),
      })),
    removeBadgePosition: (index) =>
      set((s) => ({ badgePositions: s.badgePositions.filter((_, i) => i !== index) })),

    setSilverEnabled: (enabled) => set({ silverEnabled: enabled }),
    setSilverMaskFront: (img) => set({ silverMaskFront: img }),
    setSilverMaskBack: (img) => set({ silverMaskBack: img }),

    setValidationChecks: (checks) => set({ validationChecks: checks }),
    setIsValidating: (v) => set({ isValidating: v }),

    resetWizard: () => set(initialState),
  }),
);
