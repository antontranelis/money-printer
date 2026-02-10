import { useEffect, useState, useCallback } from 'react';
import { useVoucherGalleryStore } from '../stores/voucherGalleryStore';
import { useBillStore } from '../stores/billStore';
import { downloadBase64Image, generateVoucherPdf, downloadBlob, validateVoucherImage, type VoucherValidationResult } from '../services/voucherImageProcessor';
import { getStorageEstimate } from '../stores/opfsStorage';
import type { SavedVoucher, VoucherVersion } from '../types/voucherGallery';

/**
 * Format bytes to human-readable string (KB, MB, GB)
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const labels = {
  de: {
    title: 'Gespeicherte Gutscheine',
    empty: 'Noch keine Gutscheine gespeichert',
    emptyHint: 'Generierte Gutscheine werden automatisch hier gespeichert.',
    loading: 'Laden...',
    delete: 'Löschen',
    deleteAll: 'Alle löschen',
    deleteAllConfirm: 'Wirklich alle Gutscheine löschen?',
    download: 'Herunterladen',
    downloadFront: 'Vorderseite',
    downloadBack: 'Rückseite',
    downloadPdf: 'PDF',
    downloadOriginal: 'Original',
    close: 'Schließen',
    created: 'Erstellt',
    value: 'Wert',
    person: 'Für',
    style: 'Stil',
    spiritual: 'Spirituell',
    business: 'Business',
    count: 'Gutscheine',
    filterAll: 'Alle',
    filterValid: 'Valide',
    filterInvalid: 'Fehlerhaft',
    filterStyle: 'Stil',
    filterValidation: 'Validierung',
    downloadAllZip: 'Alle als ZIP',
    downloadingZip: 'Erstelle ZIP...',
    originalPrompt: 'Original-Prompt',
    refinementHistory: 'Änderungshistorie',
    noPrompt: 'Kein Prompt gespeichert',
    noRefinements: 'Keine Änderungen',
    copyPrompt: 'Kopieren',
    copied: 'Kopiert!',
    generationConfig: 'Generierungs-Parameter',
    noConfig: 'Keine Parameter gespeichert',
    colorSchemeLabel: 'Farbschema',
    centralMotifLabel: 'Zentrales Motiv',
    moodLabel: 'Stimmung',
    energyLabel: 'Energie',
    visualStyleLabel: 'Visueller Stil',
    sourcesLabel: 'Spirituelle Quellen',
    textStyleLabel: 'Text-Stil',
    textClarityLabel: 'Text-Klarheit',
    feelingsLabel: 'Gefühle',
    industryLabel: 'Branche',
    toneLabel: 'Tonalität',
    ctaStyleLabel: 'CTA-Stil',
    businessDesignStyleLabel: 'Design-Stil',
    businessValuesLabel: 'Unternehmenswerte',
    valueDisplayLabel: 'Wert-Anzeige',
    valuePositionLabel: 'Wert-Position',
    backSideStyleLabel: 'Rückseiten-Stil',
    qrCodeLabel: 'QR-Code',
    enabled: 'Aktiviert',
    disabled: 'Deaktiviert',
    versions: 'Versionen',
    version: 'Version',
    initialVersion: 'Original',
    noVersions: 'Keine Versionshistorie',
    validationTitle: 'Validierung',
    validationPassed: 'Alle Prüfungen bestanden',
    validationFailed: 'Einige Prüfungen fehlgeschlagen',
    checkBlackBackground: 'Schwarzer Hintergrund',
    checkEqualSize: 'Gleiche Größe (Vorder-/Rückseite)',
    checkNoBlackBorders: 'Keine schwarzen Ränder',
    frontHeight: 'Vorderseite Höhe',
    backHeight: 'Rückseite Höhe',
    validating: 'Validiere...',
    storageUsed: 'Speicher',
    storageOf: 'von',
  },
  en: {
    title: 'Saved Vouchers',
    empty: 'No vouchers saved yet',
    emptyHint: 'Generated vouchers will be automatically saved here.',
    loading: 'Loading...',
    delete: 'Delete',
    deleteAll: 'Delete All',
    deleteAllConfirm: 'Really delete all vouchers?',
    download: 'Download',
    downloadFront: 'Front',
    downloadBack: 'Back',
    downloadPdf: 'PDF',
    downloadOriginal: 'Original',
    close: 'Close',
    created: 'Created',
    value: 'Value',
    person: 'For',
    style: 'Style',
    spiritual: 'Spiritual',
    business: 'Business',
    count: 'vouchers',
    filterAll: 'All',
    filterValid: 'Valid',
    filterInvalid: 'Invalid',
    filterStyle: 'Style',
    filterValidation: 'Validation',
    downloadAllZip: 'All as ZIP',
    downloadingZip: 'Creating ZIP...',
    originalPrompt: 'Original Prompt',
    refinementHistory: 'Refinement History',
    noPrompt: 'No prompt saved',
    noRefinements: 'No refinements',
    copyPrompt: 'Copy',
    copied: 'Copied!',
    generationConfig: 'Generation Parameters',
    noConfig: 'No parameters saved',
    colorSchemeLabel: 'Color Scheme',
    centralMotifLabel: 'Central Motif',
    moodLabel: 'Mood',
    energyLabel: 'Energy',
    visualStyleLabel: 'Visual Style',
    sourcesLabel: 'Spiritual Sources',
    textStyleLabel: 'Text Style',
    textClarityLabel: 'Text Clarity',
    feelingsLabel: 'Feelings',
    industryLabel: 'Industry',
    toneLabel: 'Tone',
    ctaStyleLabel: 'CTA Style',
    businessDesignStyleLabel: 'Design Style',
    businessValuesLabel: 'Business Values',
    valueDisplayLabel: 'Value Display',
    valuePositionLabel: 'Value Position',
    backSideStyleLabel: 'Back Side Style',
    qrCodeLabel: 'QR Code',
    enabled: 'Enabled',
    disabled: 'Disabled',
    versions: 'Versions',
    version: 'Version',
    initialVersion: 'Original',
    noVersions: 'No version history',
    validationTitle: 'Validation',
    validationPassed: 'All checks passed',
    validationFailed: 'Some checks failed',
    checkBlackBackground: 'Black background',
    checkEqualSize: 'Equal size (front/back)',
    checkNoBlackBorders: 'No black borders',
    frontHeight: 'Front height',
    backHeight: 'Back height',
    validating: 'Validating...',
    storageUsed: 'Storage',
    storageOf: 'of',
  },
};

export function VoucherGallery() {
  const appLanguage = useBillStore((state) => state.appLanguage);
  const t = labels[appLanguage];

  const vouchers = useVoucherGalleryStore((state) => state.vouchers);
  const isLoading = useVoucherGalleryStore((state) => state.isLoading);
  const isInitialized = useVoucherGalleryStore((state) => state.isInitialized);
  const loadVouchers = useVoucherGalleryStore((state) => state.loadVouchers);
  const removeVoucher = useVoucherGalleryStore((state) => state.removeVoucher);
  const clearAll = useVoucherGalleryStore((state) => state.clearAll);
  const migrateLegacyVouchers = useVoucherGalleryStore((state) => state.migrateLegacyVouchers);

  const [selectedVoucher, setSelectedVoucher] = useState<SavedVoucher | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  // Index for viewing version history (0 = latest/current, higher = older versions)
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
  // Validation state for selected voucher
  const [validationResult, setValidationResult] = useState<VoucherValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  // Filter state
  const [styleFilter, setStyleFilter] = useState<'all' | 'spiritual' | 'business'>('all');
  const [validationFilter, setValidationFilter] = useState<'all' | 'valid' | 'invalid'>('all');
  // ZIP download state
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  // Delete all state
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  // Aspect ratios for thumbnails (voucherId -> aspect ratio as width/height)
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({});
  // Storage info
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);

  const handleCopyPrompt = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      loadVouchers();
    }
  }, [isInitialized, loadVouchers]);

  // Load storage info
  useEffect(() => {
    const updateStorageInfo = async () => {
      const estimate = await getStorageEstimate();
      setStorageInfo(estimate);
    };
    updateStorageInfo();
    // Update when vouchers change
  }, [vouchers.length]);

  // Migrate legacy vouchers without validation result
  useEffect(() => {
    if (isInitialized && vouchers.length > 0) {
      const hasLegacyVouchers = vouchers.some((v) => !v.validationResult);
      if (hasLegacyVouchers) {
        migrateLegacyVouchers();
      }
    }
  }, [isInitialized, vouchers, migrateLegacyVouchers]);

  // Calculate aspect ratios for thumbnails
  useEffect(() => {
    vouchers.forEach((voucher) => {
      if (aspectRatios[voucher.id] !== undefined) return;

      const img = new Image();
      img.onload = () => {
        setAspectRatios((prev) => ({
          ...prev,
          [voucher.id]: img.width / img.height,
        }));
      };
      img.src = `data:image/jpeg;base64,${voucher.thumbnailBase64}`;
    });
  }, [vouchers, aspectRatios]);

  // Filter vouchers based on style and validation filters
  const filteredVouchers = vouchers.filter((voucher) => {
    // Style filter
    if (styleFilter !== 'all' && voucher.styleContext !== styleFilter) {
      return false;
    }
    // Validation filter (uses stored validation result)
    if (validationFilter !== 'all') {
      const isValid = voucher.validationResult?.isValid;
      if (isValid === undefined) {
        // Legacy voucher without validation - show when filtering by validation status
        return false;
      }
      if (validationFilter === 'valid' && !isValid) return false;
      if (validationFilter === 'invalid' && isValid) return false;
    }
    return true;
  });

  // Validate voucher when selected or version changes
  useEffect(() => {
    if (!selectedVoucher) {
      setValidationResult(null);
      return;
    }

    const versions: VoucherVersion[] = selectedVoucher.versions && selectedVoucher.versions.length > 0
      ? selectedVoucher.versions
      : [{
          timestamp: selectedVoucher.createdAt,
          prompt: '',
          originalBase64: selectedVoucher.originalBase64,
          frontBase64: selectedVoucher.frontBase64,
          backBase64: selectedVoucher.backBase64,
        }];

    const reversedVersions = [...versions].reverse();

    // For the current version (index 0), use the stored validation result
    if (selectedVersionIndex === 0 && selectedVoucher.validationResult) {
      // Convert stored result to full validation result (without dimensions)
      setValidationResult({
        isValid: selectedVoucher.validationResult.isValid,
        hasBlackBackground: selectedVoucher.validationResult.hasBlackBackground,
        sidesAreEqualSize: selectedVoucher.validationResult.sidesAreEqualSize,
        hasNoBlackBorders: selectedVoucher.validationResult.hasNoBlackBorders,
        frontDimensions: { width: 0, height: 0 },
        backDimensions: { width: 0, height: 0 },
        message: selectedVoucher.validationResult.isValid ? 'Validation passed' : 'Validation failed',
      });
      setIsValidating(false);
      return;
    }

    // For older versions, validate on-demand
    const currentVersion = reversedVersions[selectedVersionIndex] || reversedVersions[0];
    setIsValidating(true);
    setValidationResult(null);
    validateVoucherImage(currentVersion.originalBase64).then((result) => {
      setValidationResult(result);
      setIsValidating(false);
    });
  }, [selectedVoucher, selectedVersionIndex]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await removeVoucher(id);
    if (selectedVoucher?.id === id) {
      setSelectedVoucher(null);
    }
  }, [removeVoucher, selectedVoucher]);

  const handleDeleteAll = useCallback(async () => {
    setIsDeletingAll(true);
    try {
      await clearAll();
      setSelectedVoucher(null);
      setShowDeleteAllConfirm(false);
    } finally {
      setIsDeletingAll(false);
    }
  }, [clearAll]);

  const handleDownloadFront = useCallback((voucherId: string, frontBase64: string) => {
    downloadBase64Image(frontBase64, `voucher-front-${voucherId}.png`);
  }, []);

  const handleDownloadBack = useCallback((voucherId: string, backBase64: string) => {
    downloadBase64Image(backBase64, `voucher-back-${voucherId}.png`);
  }, []);

  const handleDownloadOriginal = useCallback((voucherId: string, originalBase64: string) => {
    downloadBase64Image(originalBase64, `voucher-original-${voucherId}.png`);
  }, []);

  const handleDownloadPdf = useCallback(async (voucherId: string, frontBase64: string, backBase64: string, originalBase64: string) => {
    try {
      // Get dimensions from the front image
      const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => resolve({ width: 1200, height: 1800 }); // Fallback
        img.src = `data:image/png;base64,${frontBase64}`;
      });

      const pdfBlob = await generateVoucherPdf({
        frontBase64,
        backBase64,
        originalBase64,
        dimensions,
      });
      downloadBlob(pdfBlob, `voucher-${voucherId}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    }
  }, []);

  const handleDownloadAllZip = useCallback(async () => {
    if (filteredVouchers.length === 0) return;

    setIsDownloadingZip(true);
    try {
      // Dynamically import JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Add each voucher's images to the ZIP
      for (let i = 0; i < filteredVouchers.length; i++) {
        const voucher = filteredVouchers[i];
        const folderName = `voucher-${i + 1}-${voucher.styleContext}`;
        const folder = zip.folder(folderName);

        if (folder) {
          // Add front image
          folder.file('front.png', voucher.frontBase64, { base64: true });
          // Add back image
          folder.file('back.png', voucher.backBase64, { base64: true });
          // Add original image
          folder.file('original.png', voucher.originalBase64, { base64: true });
        }
      }

      // Generate and download the ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vouchers-${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to create ZIP:', error);
    }
    setIsDownloadingZip(false);
  }, [filteredVouchers]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(appLanguage === 'de' ? 'de-DE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
        <span className="ml-2">{t.loading}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">{t.title}</h2>
          {/* Storage Info */}
          {storageInfo && storageInfo.quota > 0 && (
            <div className="flex items-center gap-2">
              <div className="text-xs text-base-content/60">
                {t.storageUsed}: {formatBytes(storageInfo.usage)} {t.storageOf} {formatBytes(storageInfo.quota)}
              </div>
              <progress
                className={`progress w-24 h-2 ${
                  storageInfo.usage / storageInfo.quota > 0.9
                    ? 'progress-error'
                    : storageInfo.usage / storageInfo.quota > 0.7
                    ? 'progress-warning'
                    : 'progress-success'
                }`}
                value={storageInfo.usage}
                max={storageInfo.quota}
              />
            </div>
          )}
        </div>
        {vouchers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-base-content/60">
              {filteredVouchers.length}/{vouchers.length} {t.count}
            </span>
            {/* ZIP Download Button */}
            <button
              className="btn btn-outline btn-sm"
              onClick={handleDownloadAllZip}
              disabled={isDownloadingZip || filteredVouchers.length === 0}
            >
              {isDownloadingZip ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  {t.downloadingZip}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t.downloadAllZip}
                </>
              )}
            </button>
            {showDeleteAllConfirm ? (
              <div className="flex gap-2">
                <button
                  className="btn btn-error btn-sm"
                  onClick={handleDeleteAll}
                  disabled={isDeletingAll}
                >
                  {isDeletingAll ? (
                    <>
                      <span className="loading loading-spinner loading-xs" />
                      {t.loading}
                    </>
                  ) : (
                    t.deleteAllConfirm
                  )}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowDeleteAllConfirm(false)}
                  disabled={isDeletingAll}
                >
                  {t.close}
                </button>
              </div>
            ) : (
              <button
                className="btn btn-ghost btn-sm text-error"
                onClick={() => setShowDeleteAllConfirm(true)}
              >
                {t.deleteAll}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      {vouchers.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {/* Style Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/60">{t.filterStyle}:</span>
            <div className="join">
              <button
                className={`btn btn-xs join-item ${styleFilter === 'all' ? 'btn-active' : ''}`}
                onClick={() => setStyleFilter('all')}
              >
                {t.filterAll}
              </button>
              <button
                className={`btn btn-xs join-item ${styleFilter === 'spiritual' ? 'btn-active btn-secondary' : ''}`}
                onClick={() => setStyleFilter('spiritual')}
              >
                {t.spiritual}
              </button>
              <button
                className={`btn btn-xs join-item ${styleFilter === 'business' ? 'btn-active btn-primary' : ''}`}
                onClick={() => setStyleFilter('business')}
              >
                {t.business}
              </button>
            </div>
          </div>

          {/* Validation Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/60">{t.filterValidation}:</span>
            <div className="join">
              <button
                className={`btn btn-xs join-item ${validationFilter === 'all' ? 'btn-active' : ''}`}
                onClick={() => setValidationFilter('all')}
              >
                {t.filterAll}
              </button>
              <button
                className={`btn btn-xs join-item ${validationFilter === 'valid' ? 'btn-active btn-success' : ''}`}
                onClick={() => setValidationFilter('valid')}
              >
                {t.filterValid}
              </button>
              <button
                className={`btn btn-xs join-item ${validationFilter === 'invalid' ? 'btn-active btn-warning' : ''}`}
                onClick={() => setValidationFilter('invalid')}
              >
                {t.filterInvalid}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {vouchers.length === 0 && (
        <div className="text-center py-12 bg-base-200 rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 mx-auto text-base-content/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="mt-4 text-base-content/60">{t.empty}</p>
          <p className="text-sm text-base-content/40">{t.emptyHint}</p>
        </div>
      )}

      {/* Thumbnail Grid */}
      {vouchers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 items-start">
          {filteredVouchers.map((voucher) => {
            const isValid = voucher.validationResult?.isValid;
            const aspectRatio = aspectRatios[voucher.id];
            return (
              <div
                key={voucher.id}
                className="relative group cursor-pointer rounded-lg overflow-hidden border border-base-300 hover:border-primary transition-colors bg-base-200"
                style={{ aspectRatio: aspectRatio ? `${aspectRatio}` : '2/3' }}
                onClick={() => setSelectedVoucher(voucher)}
              >
                <img
                  src={`data:image/jpeg;base64,${voucher.thumbnailBase64}`}
                  alt="Voucher thumbnail"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm">{t.download}</span>
                </div>
                {/* Delete button on hover */}
                <button
                  className="absolute top-1 right-1 btn btn-circle btn-xs btn-error opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleDelete(voucher.id, e)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
                {/* Badges row */}
                <div className="absolute bottom-1 left-1 right-1 flex justify-between">
                  {/* Style badge */}
                  <span className={`badge badge-xs ${voucher.styleContext === 'spiritual' ? 'badge-secondary' : 'badge-primary'}`}>
                    {voucher.styleContext === 'spiritual' ? t.spiritual : t.business}
                  </span>
                  {/* Validation badge */}
                  {isValid === true ? (
                    <span className="badge badge-xs badge-success">✓</span>
                  ) : isValid === false ? (
                    <span className="badge badge-xs badge-warning">!</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedVoucher && (() => {
        // Get versions array (fallback to single version from voucher data for backwards compatibility)
        const versions: VoucherVersion[] = selectedVoucher.versions && selectedVoucher.versions.length > 0
          ? selectedVoucher.versions
          : [{
              timestamp: selectedVoucher.createdAt,
              prompt: '',
              originalBase64: selectedVoucher.originalBase64,
              frontBase64: selectedVoucher.frontBase64,
              backBase64: selectedVoucher.backBase64,
            }];

        // Versions are stored oldest-first, so reverse for display (newest first)
        const reversedVersions = [...versions].reverse();
        const currentVersion = reversedVersions[selectedVersionIndex] || reversedVersions[0];
        const totalVersions = reversedVersions.length;

        return (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={() => {
                setSelectedVoucher(null);
                setSelectedVersionIndex(0);
              }}
            >
              ✕
            </button>

            <div className="space-y-4">
              {/* Version Navigation */}
              {totalVersions > 1 && (
                <div className="flex items-center justify-between bg-base-200 rounded-lg p-3">
                  <button
                    className="btn btn-sm btn-ghost"
                    disabled={selectedVersionIndex >= totalVersions - 1}
                    onClick={() => setSelectedVersionIndex(selectedVersionIndex + 1)}
                  >
                    ← {appLanguage === 'de' ? 'Älter' : 'Older'}
                  </button>
                  <div className="text-center">
                    <span className="font-medium">
                      {t.version} {totalVersions - selectedVersionIndex} / {totalVersions}
                    </span>
                    {selectedVersionIndex === 0 && (
                      <span className="badge badge-primary badge-sm ml-2">
                        {appLanguage === 'de' ? 'Aktuell' : 'Current'}
                      </span>
                    )}
                    {currentVersion.prompt && (
                      <p className="text-xs text-base-content/60 mt-1 max-w-md truncate">
                        "{currentVersion.prompt}"
                      </p>
                    )}
                  </div>
                  <button
                    className="btn btn-sm btn-ghost"
                    disabled={selectedVersionIndex <= 0}
                    onClick={() => setSelectedVersionIndex(selectedVersionIndex - 1)}
                  >
                    {appLanguage === 'de' ? 'Neuer' : 'Newer'} →
                  </button>
                </div>
              )}

              {/* Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">{t.downloadFront}</h4>
                  <img
                    src={`data:image/png;base64,${currentVersion.frontBase64}`}
                    alt="Front"
                    className="w-full rounded-lg border border-base-300"
                  />
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-2">{t.downloadBack}</h4>
                  <img
                    src={`data:image/png;base64,${currentVersion.backBase64}`}
                    alt="Back"
                    className="w-full rounded-lg border border-base-300"
                  />
                </div>
              </div>

              {/* Validation Result - Collapsible */}
              {isValidating ? (
                <div className="flex items-center gap-2 py-2">
                  <span className="loading loading-spinner loading-sm"></span>
                  <span className="text-sm">{t.validating}</span>
                </div>
              ) : validationResult && (
                <div className={`collapse collapse-arrow ${validationResult.isValid ? 'bg-success/10' : 'bg-warning/10'}`}>
                  <input type="checkbox" />
                  <div className="collapse-title font-medium text-sm py-2 flex items-center gap-2">
                    {validationResult.isValid ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-success shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-warning shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    <span>{t.validationTitle}: {validationResult.isValid ? t.validationPassed : t.validationFailed}</span>
                  </div>
                  <div className="collapse-content">
                    <div className="text-xs space-y-0.5">
                      <div className="flex items-center gap-2">
                        {validationResult.hasBlackBackground ? (
                          <span className="text-success">✓</span>
                        ) : (
                          <span className="text-error">✗</span>
                        )}
                        <span>{t.checkBlackBackground}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {validationResult.sidesAreEqualSize ? (
                          <span className="text-success">✓</span>
                        ) : (
                          <span className="text-error">✗</span>
                        )}
                        <span>{t.checkEqualSize}</span>
                        {!validationResult.sidesAreEqualSize && validationResult.frontDimensions && validationResult.backDimensions && (
                          <span className="opacity-70">
                            ({t.frontHeight}: {validationResult.frontDimensions.height}px, {t.backHeight}: {validationResult.backDimensions.height}px)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {validationResult.hasNoBlackBorders ? (
                          <span className="text-success">✓</span>
                        ) : (
                          <span className="text-error">✗</span>
                        )}
                        <span>{t.checkNoBlackBorders}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="bg-base-200 rounded-lg p-3 text-sm space-y-1">
                <div className="flex gap-4 flex-wrap">
                  <span>
                    <strong>{t.created}:</strong> {formatDate(selectedVoucher.createdAt)}
                  </span>
                  <span>
                    <strong>{t.style}:</strong>{' '}
                    {selectedVoucher.styleContext === 'spiritual' ? t.spiritual : t.business}
                  </span>
                  {selectedVoucher.voucherValue && (
                    <span>
                      <strong>{t.value}:</strong> {selectedVoucher.voucherValue}
                    </span>
                  )}
                  {selectedVoucher.personName && (
                    <span>
                      <strong>{t.person}:</strong> {selectedVoucher.personName}
                    </span>
                  )}
                </div>
              </div>

              {/* Original Prompt */}
              <div className="collapse collapse-arrow bg-base-200">
                <input type="checkbox" />
                <div className="collapse-title font-medium text-sm">
                  {t.originalPrompt}
                </div>
                <div className="collapse-content">
                  {selectedVoucher.originalPrompt ? (
                    <div className="space-y-2">
                      <pre className="text-xs whitespace-pre-wrap bg-base-300 p-2 rounded max-h-48 overflow-y-auto">
                        {selectedVoucher.originalPrompt}
                      </pre>
                      <button
                        className="btn btn-xs btn-ghost"
                        onClick={() => handleCopyPrompt(selectedVoucher.originalPrompt!)}
                      >
                        {copiedPrompt ? t.copied : t.copyPrompt}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-base-content/60">{t.noPrompt}</p>
                  )}
                </div>
              </div>

              {/* Version History */}
              <div className="collapse collapse-arrow bg-base-200">
                <input type="checkbox" />
                <div className="collapse-title font-medium text-sm">
                  {t.versions}
                  {totalVersions > 1 && (
                    <span className="badge badge-sm ml-2">{totalVersions}</span>
                  )}
                </div>
                <div className="collapse-content">
                  {totalVersions > 1 ? (
                    <div className="space-y-2">
                      {reversedVersions.map((version, index) => (
                        <button
                          key={index}
                          className={`w-full text-left bg-base-300 p-2 rounded text-xs hover:bg-base-content/10 transition-colors ${
                            index === selectedVersionIndex ? 'ring-2 ring-primary' : ''
                          }`}
                          onClick={() => setSelectedVersionIndex(index)}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">
                              {t.version} {totalVersions - index}
                              {index === 0 && (
                                <span className="badge badge-primary badge-xs ml-2">
                                  {appLanguage === 'de' ? 'Aktuell' : 'Current'}
                                </span>
                              )}
                              {index === totalVersions - 1 && (
                                <span className="badge badge-ghost badge-xs ml-2">
                                  {t.initialVersion}
                                </span>
                              )}
                            </span>
                            <span className="text-base-content/60">
                              {formatDate(version.timestamp)}
                            </span>
                          </div>
                          {version.prompt && (
                            <div className="mt-1 text-base-content/70 truncate">
                              "{version.prompt}"
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-base-content/60">{t.noVersions}</p>
                  )}
                </div>
              </div>

              {/* Generation Parameters */}
              <div className="collapse collapse-arrow bg-base-200">
                <input type="checkbox" />
                <div className="collapse-title font-medium text-sm">
                  {t.generationConfig}
                </div>
                <div className="collapse-content">
                  {selectedVoucher.generationConfig ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><strong>{t.colorSchemeLabel}:</strong> {selectedVoucher.generationConfig.colorScheme}</div>
                      <div><strong>{t.centralMotifLabel}:</strong> {selectedVoucher.generationConfig.centralMotif}</div>
                      {selectedVoucher.styleContext === 'spiritual' ? (
                        <>
                          <div><strong>{t.moodLabel}:</strong> {selectedVoucher.generationConfig.mood}</div>
                          <div><strong>{t.energyLabel}:</strong> {selectedVoucher.generationConfig.energy}</div>
                          <div><strong>{t.visualStyleLabel}:</strong> {selectedVoucher.generationConfig.visualStyle}</div>
                          <div><strong>{t.textStyleLabel}:</strong> {selectedVoucher.generationConfig.textStyle}</div>
                          <div><strong>{t.textClarityLabel}:</strong> {selectedVoucher.generationConfig.textClarity}</div>
                          <div className="col-span-2"><strong>{t.sourcesLabel}:</strong> {selectedVoucher.generationConfig.sources?.join(', ')}</div>
                          <div className="col-span-2"><strong>{t.feelingsLabel}:</strong> {selectedVoucher.generationConfig.feelings?.join(', ')}</div>
                        </>
                      ) : (
                        <>
                          <div><strong>{t.industryLabel}:</strong> {selectedVoucher.generationConfig.industry}</div>
                          <div><strong>{t.toneLabel}:</strong> {selectedVoucher.generationConfig.tone}</div>
                          <div><strong>{t.ctaStyleLabel}:</strong> {selectedVoucher.generationConfig.ctaStyle}</div>
                          <div><strong>{t.businessDesignStyleLabel}:</strong> {selectedVoucher.generationConfig.businessDesignStyle}</div>
                          <div className="col-span-2"><strong>{t.businessValuesLabel}:</strong> {selectedVoucher.generationConfig.businessValues?.join(', ')}</div>
                        </>
                      )}
                      <div><strong>{t.valueDisplayLabel}:</strong> {selectedVoucher.generationConfig.valueDisplay}</div>
                      <div><strong>{t.valuePositionLabel}:</strong> {selectedVoucher.generationConfig.valuePosition}</div>
                      <div><strong>{t.backSideStyleLabel}:</strong> {selectedVoucher.generationConfig.backSideStyle}</div>
                      <div><strong>{t.qrCodeLabel}:</strong> {selectedVoucher.generationConfig.qrCodeEnabled ? t.enabled : t.disabled}</div>
                    </div>
                  ) : (
                    <p className="text-xs text-base-content/60">{t.noConfig}</p>
                  )}
                </div>
              </div>

              {/* Download buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleDownloadPdf(
                    selectedVoucher.id,
                    currentVersion.frontBase64,
                    currentVersion.backBase64,
                    currentVersion.originalBase64
                  )}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  {t.downloadPdf}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleDownloadFront(selectedVoucher.id, currentVersion.frontBase64)}
                >
                  {t.downloadFront}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleDownloadBack(selectedVoucher.id, currentVersion.backBase64)}
                >
                  {t.downloadBack}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDownloadOriginal(selectedVoucher.id, currentVersion.originalBase64)}
                >
                  {t.downloadOriginal}
                </button>
                <button
                  className="btn btn-error btn-sm ml-auto"
                  onClick={(e) => handleDelete(selectedVoucher.id, e)}
                >
                  {t.delete}
                </button>
              </div>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => {
              setSelectedVoucher(null);
              setSelectedVersionIndex(0);
            }}>close</button>
          </form>
        </dialog>
        );
      })()}
    </div>
  );
}
