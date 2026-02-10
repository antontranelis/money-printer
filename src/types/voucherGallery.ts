import type { PrintGeneratorConfig } from './printGenerator';

/** Stored validation result for a voucher */
export interface StoredValidationResult {
  isValid: boolean;
  hasBlackBackground: boolean;
  sidesAreEqualSize: boolean;
  hasNoBlackBorders: boolean;
  /** Dimensions of front side */
  frontDimensions?: { width: number; height: number };
  /** Dimensions of back side */
  backDimensions?: { width: number; height: number };
}

/** A single version in the voucher's history */
export interface VoucherVersion {
  /** Timestamp when this version was created */
  timestamp: number;
  /** The refinement prompt used (empty for initial generation) */
  prompt: string;
  /** Original Gemini output for this version */
  originalBase64: string;
  /** Processed front side for this version */
  frontBase64: string;
  /** Processed back side for this version */
  backBase64: string;
}

/** @deprecated Use VoucherVersion instead - kept for backwards compatibility */
export interface RefinementEntry {
  /** Timestamp when this refinement was made */
  timestamp: number;
  /** The refinement prompt used */
  prompt: string;
}

export interface SavedVoucher {
  id: string;
  createdAt: number;
  /** Original Gemini output (both sides combined) */
  originalBase64: string;
  /** Processed front side */
  frontBase64: string;
  /** Processed back side */
  backBase64: string;
  /** Thumbnail (smaller version for gallery view) */
  thumbnailBase64: string;
  /** Style context used (kept for backwards compatibility) */
  styleContext: 'spiritual' | 'business';
  /** Voucher value text (kept for backwards compatibility) */
  voucherValue?: string;
  /** Person name if set (kept for backwards compatibility) */
  personName?: string;
  /** Color scheme used (kept for backwards compatibility) */
  colorScheme?: string;
  /** Original generation prompt text */
  originalPrompt?: string;
  /** History of refinement prompts applied - @deprecated use versions instead */
  refinementHistory?: RefinementEntry[];
  /** Complete configuration used for generation (excluding large binary data) */
  generationConfig?: Omit<PrintGeneratorConfig, 'logoImage' | 'portraitImage'>;
  /** Version history with all image versions */
  versions?: VoucherVersion[];
  /** Cached validation result (computed on save/update) */
  validationResult?: StoredValidationResult;
}
